import { json } from "./_utils.js";

/* POST /api/track — public beacon sink for js/analytics.js.
   Enriches each batch server-side (country, region, device, acquisition), writes
   the events and rolls the visit row. Never returns an error to the browser:
   a broken analytics call must not surface on the website. */

const TYPES = new Set([
  "pageview", "dwell", "scroll", "phone_click", "email_click",
  "enquiry_submit", "quote_cta", "social_click", "outbound",
]);

const BOT = /(bot|crawler|spider|crawl|slurp|bingpreview|facebookexternalhit|headless|lighthouse|pingdom|uptime|monitor|preview|curl|wget|python-requests|gptbot|claudebot)/i;

const cap = (s, n) => (typeof s === "string" && s.trim() ? s.trim().slice(0, n) : null);

function deviceFromUA(ua) {
  const u = ua.toLowerCase();
  if (/ipad|tablet|playbook|silk/.test(u) || (/android/.test(u) && !/mobile/.test(u))) return "tablet";
  if (/mobi|iphone|ipod|windows phone/.test(u)) return "mobile";
  return "desktop";
}

function hostOf(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, "").slice(0, 64);
  } catch {
    return null;
  }
}

const SEARCH = /^(www\.)?(google|bing|duckduckgo|yahoo|ecosia|brave|baidu|yandex|startpage)\./i;
const SOCIAL = /(facebook|instagram|fb|linkedin|twitter|^t\.co$|x\.com|tiktok|pinterest|reddit|youtube|neighbourly)/i;

/* Where did this visit come from? utm wins when present, otherwise the referrer
   host decides. No referrer and no utm means direct. */
function classify(refHost, utm) {
  const m = (utm.medium || "").toLowerCase();
  const s = (utm.source || "").toLowerCase();
  if (m === "cpc" || m === "ppc" || m === "paid" || /gclid|adwords/.test(s)) return { source: "paid", medium: m || "cpc" };
  if (m === "email" || s === "email" || /mailchimp|klaviyo/.test(s)) return { source: "email", medium: "email" };
  if (s || m) {
    if (SOCIAL.test(s)) return { source: "social", medium: m || "social" };
    if (SEARCH.test(s + ".")) return { source: "search", medium: m || "organic" };
    return { source: "referral", medium: m || "referral" };
  }
  if (!refHost) return { source: "direct", medium: "none" };
  if (SEARCH.test(refHost)) return { source: "search", medium: "organic" };
  if (SOCIAL.test(refHost)) return { source: "social", medium: "social" };
  return { source: "referral", medium: "referral" };
}

async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    await ingest(await readBody(request), request, env, context);
  } catch {
    /* analytics must never break a page */
  }
  return json({ ok: true });
}

async function ingest(body, request, env, context) {
  const visitor = cap(body && body.visitor, 64);
  const session = cap(body && body.session, 64);
  if (!visitor || !session || !Array.isArray(body.events)) return;

  const ua = request.headers.get("user-agent") || "";
  if (BOT.test(ua)) return;

  const events = body.events.filter((e) => e && TYPES.has(e.type)).slice(0, 40);
  if (!events.length) return;

  const day = new Date().toISOString().slice(0, 10);
  const device = deviceFromUA(ua);
  const country = (request.headers.get("cf-ipcountry") || "").slice(0, 2).toUpperCase().replace(/[^A-Z]/g, "") || null;
  const region = cap(request.cf && request.cf.region, 60);

  const entry = events.find((e) => e.entry);
  const refHost = entry ? hostOf(entry.ref) : null;
  const utm = (entry && entry.utm) || {};
  const acq = entry ? classify(refHost, utm) : null;

  // First write wins, but backfill anything still null: a batch can arrive
  // before the one carrying the entry event, and losing the referrer is forever.
  await env.DB.prepare(
    `INSERT INTO visits (id, visitor, day, entry_path, last_path, ref_host, source, medium, campaign, country, region, device)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET
       entry_path = COALESCE(visits.entry_path, excluded.entry_path),
       ref_host   = COALESCE(visits.ref_host,   excluded.ref_host),
       source     = COALESCE(visits.source,     excluded.source),
       medium     = COALESCE(visits.medium,     excluded.medium),
       campaign   = COALESCE(visits.campaign,   excluded.campaign),
       country    = COALESCE(visits.country,    excluded.country),
       region     = COALESCE(visits.region,     excluded.region),
       device     = COALESCE(visits.device,     excluded.device)`
  )
    .bind(
      session, visitor, day,
      entry ? cap(entry.path, 300) : null,
      cap(events[events.length - 1].path, 300),
      refHost,
      acq ? acq.source : null,
      acq ? acq.medium : null,
      cap(utm.campaign, 80),
      country, region, device
    )
    .run();

  // Acquisition is decided once per visit, then denormalised onto every event
  // so reports never need to join back to visits.
  const v = await env.DB.prepare("SELECT source, medium, campaign, ref_host FROM visits WHERE id = ?")
    .bind(session)
    .first();

  const has = (t) => (events.some((e) => e.type === t) ? 1 : 0);
  const pageviews = events.filter((e) => e.type === "pageview").length;
  const lastPath = cap((events.filter((e) => e.path).pop() || {}).path, 300);
  const depths = events
    .filter((e) => e.type === "scroll" && e.value && typeof e.value.depth === "number")
    .map((e) => e.value.depth);
  const maxScroll = depths.length ? Math.min(100, Math.max.apply(null, depths)) : 0;

  const insert = env.DB.prepare(
    `INSERT INTO events (day, type, visitor, session, path, ref_host, source, medium, campaign, country, region, device, dwell, value)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );

  const stmts = [
    env.DB.prepare(
      `UPDATE visits SET
         pageviews  = pageviews + ?,
         max_scroll = MAX(max_scroll, ?),
         called     = MAX(called, ?),
         emailed    = MAX(emailed, ?),
         enquired   = MAX(enquired, ?),
         last_path  = COALESCE(?, last_path),
         last_seen  = datetime('now')
       WHERE id = ?`
    ).bind(pageviews, maxScroll, has("phone_click"), has("email_click"), has("enquiry_submit"), lastPath, session),
    ...events.map((e) =>
      insert.bind(
        day, e.type, visitor, session,
        cap(e.path, 300),
        v ? v.ref_host : null,
        v ? v.source : null,
        v ? v.medium : null,
        v ? v.campaign : null,
        country, region, device,
        typeof e.dwell === "number" && isFinite(e.dwell)
          ? Math.max(0, Math.min(Math.round(e.dwell), 3600000))
          : null,
        e.value ? JSON.stringify(e.value).slice(0, 400) : null
      )
    ),
  ];

  await env.DB.batch(stmts);

  // Keep the event stream bounded without needing a cron. Roughly one request
  // in 500 pays for the sweep, which at this site's volume is a few a month.
  if (Math.random() < 0.002) {
    context.waitUntil(
      env.DB.prepare("DELETE FROM events WHERE day < date('now', '-400 days')").run().catch(() => {})
    );
  }
}
