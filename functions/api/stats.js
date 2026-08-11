import { json } from "./_utils.js";

/* GET /api/stats?days=30            — the full report for a period
   GET /api/stats?live=1             — just the real-time slice, polled often
   Behind the admin session guard in _middleware.js. */

const rows = async (env, sql, ...binds) => {
  const r = await env.DB.prepare(sql).bind(...binds).all();
  return r.results || [];
};
const one = async (env, sql, ...binds) => (await env.DB.prepare(sql).bind(...binds).first()) || {};

/* Anyone seen in the last five minutes counts as on the site now. */
async function live(env) {
  const now = await one(
    env,
    `SELECT COUNT(*) AS visitors, COALESCE(SUM(pageviews), 0) AS pageviews
       FROM visits WHERE last_seen >= datetime('now', '-5 minutes')`
  );
  const pages = await rows(
    env,
    `SELECT COALESCE(last_path, entry_path) AS path, COUNT(*) AS n
       FROM visits WHERE last_seen >= datetime('now', '-5 minutes')
      GROUP BY path ORDER BY n DESC LIMIT 8`
  );
  const recent = await rows(
    env,
    `SELECT type, path, country, region, device, ts, value
       FROM events
      WHERE ts >= datetime('now', '-30 minutes')
        AND type IN ('pageview','phone_click','enquiry_submit','email_click','quote_cta')
      ORDER BY id DESC LIMIT 25`
  );
  const today = await one(
    env,
    `SELECT COUNT(DISTINCT visitor) AS visitors,
            COUNT(DISTINCT session) AS sessions,
            SUM(CASE WHEN type = 'pageview'       THEN 1 ELSE 0 END) AS pageviews,
            SUM(CASE WHEN type = 'phone_click'    THEN 1 ELSE 0 END) AS calls,
            SUM(CASE WHEN type = 'enquiry_submit' THEN 1 ELSE 0 END) AS enquiries
       FROM events WHERE day = date('now')`
  );
  const last60 = await rows(
    env,
    `SELECT strftime('%H:%M', ts) AS minute, COUNT(*) AS n
       FROM events
      WHERE type = 'pageview' AND ts >= datetime('now', '-60 minutes')
      GROUP BY minute ORDER BY minute`
  );
  return { now, pages, recent, today, last60 };
}

async function report(env, days) {
  const since = `-${days} days`;
  const prevFrom = `-${days * 2} days`;

  const kpis = await one(
    env,
    `SELECT COUNT(DISTINCT visitor) AS visitors,
            COUNT(DISTINCT session) AS sessions,
            SUM(CASE WHEN type = 'pageview'       THEN 1 ELSE 0 END) AS pageviews,
            SUM(CASE WHEN type = 'phone_click'    THEN 1 ELSE 0 END) AS calls,
            SUM(CASE WHEN type = 'email_click'    THEN 1 ELSE 0 END) AS emails,
            SUM(CASE WHEN type = 'enquiry_submit' THEN 1 ELSE 0 END) AS enquiries,
            SUM(CASE WHEN type = 'quote_cta'      THEN 1 ELSE 0 END) AS quote_clicks
       FROM events WHERE day >= date('now', ?)`,
    since
  );
  const prev = await one(
    env,
    `SELECT COUNT(DISTINCT visitor) AS visitors,
            SUM(CASE WHEN type = 'pageview'       THEN 1 ELSE 0 END) AS pageviews,
            SUM(CASE WHEN type = 'phone_click'    THEN 1 ELSE 0 END) AS calls,
            SUM(CASE WHEN type = 'enquiry_submit' THEN 1 ELSE 0 END) AS enquiries
       FROM events WHERE day >= date('now', ?) AND day < date('now', ?)`,
    prevFrom,
    since
  );
  const dwell = await one(
    env,
    `SELECT CAST(AVG(dwell) AS INTEGER) AS avg_ms
       FROM events WHERE type = 'dwell' AND dwell > 1000 AND day >= date('now', ?)`,
    since
  );

  const daily = await rows(
    env,
    `SELECT day,
            COUNT(DISTINCT visitor) AS visitors,
            SUM(CASE WHEN type = 'pageview'       THEN 1 ELSE 0 END) AS pageviews,
            SUM(CASE WHEN type = 'phone_click'    THEN 1 ELSE 0 END) AS calls,
            SUM(CASE WHEN type = 'enquiry_submit' THEN 1 ELSE 0 END) AS enquiries
       FROM events WHERE day >= date('now', ?)
      GROUP BY day ORDER BY day`,
    since
  );

  const sources = await rows(
    env,
    `SELECT COALESCE(source, 'direct') AS source,
            COUNT(*) AS visits,
            SUM(called)   AS calls,
            SUM(enquired) AS enquiries
       FROM visits WHERE day >= date('now', ?)
      GROUP BY source ORDER BY visits DESC`,
    since
  );
  const referrers = await rows(
    env,
    `SELECT ref_host, COUNT(*) AS visits FROM visits
      WHERE day >= date('now', ?) AND ref_host IS NOT NULL
      GROUP BY ref_host ORDER BY visits DESC LIMIT 10`,
    since
  );
  const campaigns = await rows(
    env,
    `SELECT campaign, COUNT(*) AS visits, SUM(enquired) AS enquiries FROM visits
      WHERE day >= date('now', ?) AND campaign IS NOT NULL
      GROUP BY campaign ORDER BY visits DESC LIMIT 10`,
    since
  );

  // Per-page views, engaged time and how far down people actually get.
  const pages = await rows(
    env,
    `SELECT path,
            SUM(CASE WHEN type = 'pageview' THEN 1 ELSE 0 END) AS views,
            COUNT(DISTINCT session) AS sessions,
            CAST(AVG(CASE WHEN type = 'dwell' AND dwell > 1000 THEN dwell END) AS INTEGER) AS avg_ms
       FROM events
      WHERE day >= date('now', ?) AND path IS NOT NULL AND path NOT LIKE '/admin%'
      GROUP BY path HAVING views > 0 ORDER BY views DESC LIMIT 20`,
    since
  );
  const scroll = await rows(
    env,
    `SELECT path,
            CAST(AVG(json_extract(value, '$.depth')) AS INTEGER) AS avg_depth
       FROM events
      WHERE type = 'scroll' AND day >= date('now', ?) AND path IS NOT NULL
      GROUP BY path ORDER BY avg_depth ASC LIMIT 20`,
    since
  );

  const devices = await rows(
    env,
    `SELECT COALESCE(device, 'unknown') AS device, COUNT(*) AS visits, SUM(enquired) AS enquiries
       FROM visits WHERE day >= date('now', ?) GROUP BY device ORDER BY visits DESC`,
    since
  );
  const places = await rows(
    env,
    `SELECT COALESCE(region, country, 'Unknown') AS place, COUNT(*) AS visits
       FROM visits WHERE day >= date('now', ?) GROUP BY place ORDER BY visits DESC LIMIT 10`,
    since
  );

  // Which pages people are standing on when they tap the phone number.
  const callPages = await rows(
    env,
    `SELECT path, COUNT(*) AS calls FROM events
      WHERE type = 'phone_click' AND day >= date('now', ?) AND path IS NOT NULL
      GROUP BY path ORDER BY calls DESC LIMIT 10`,
    since
  );

  const blog = await rows(
    env,
    `SELECT e.path,
            SUM(CASE WHEN e.type = 'pageview' THEN 1 ELSE 0 END) AS views,
            CAST(AVG(CASE WHEN e.type = 'dwell' AND e.dwell > 1000 THEN e.dwell END) AS INTEGER) AS avg_ms
       FROM events e
      WHERE e.day >= date('now', ?) AND e.path LIKE '/blog/%'
      GROUP BY e.path ORDER BY views DESC LIMIT 10`,
    since
  );

  // A visit is "engaged" once it gets past one page or reads halfway down.
  const funnel = await one(
    env,
    `SELECT COUNT(*) AS visits,
            SUM(CASE WHEN pageviews > 1 OR max_scroll >= 50 THEN 1 ELSE 0 END) AS engaged,
            SUM(CASE WHEN called = 1 OR emailed = 1 OR enquired = 1 THEN 1 ELSE 0 END) AS leads,
            SUM(enquired) AS enquiries,
            SUM(CASE WHEN pageviews <= 1 AND max_scroll < 50 THEN 1 ELSE 0 END) AS bounced
       FROM visits WHERE day >= date('now', ?)`,
    since
  );

  // "returning" is a reserved word in SQLite (the RETURNING clause), so the
  // count of repeat visitors cannot be aliased to it.
  const returning = await one(
    env,
    `SELECT COUNT(*) AS total,
            SUM(CASE WHEN n > 1 THEN 1 ELSE 0 END) AS repeats
       FROM (SELECT visitor, COUNT(DISTINCT id) AS n FROM visits
              WHERE day >= date('now', ?) GROUP BY visitor)`,
    since
  );

  // The CMS already logs every enquiry; showing them beside the traffic is the
  // whole point of the dashboard.
  const enquiries = await rows(
    env,
    `SELECT created_at, name, source FROM enquiries
      WHERE created_at >= datetime('now', ?) ORDER BY id DESC LIMIT 10`,
    since
  );

  return {
    days,
    kpis,
    prev,
    dwell,
    daily,
    sources,
    referrers,
    campaigns,
    pages,
    scroll,
    devices,
    places,
    callPages,
    blog,
    funnel,
    returning,
    enquiries,
  };
}

export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  try {
    if (url.searchParams.get("live")) return json(await live(env));
    const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get("days") || "30", 10) || 30));
    return json({ ...(await report(env, days)), live: await live(env) });
  } catch (e) {
    return json({ error: "Could not build the report: " + (e && e.message ? e.message : "unknown") }, 500);
  }
}
