/* ============================================================
   Google reviews sync — Places API (New)
   Reviews + overall rating are cached in the `settings` table and
   refreshed lazily (stale-while-revalidate) on public page views.
   No cron is needed: Cloudflare Pages has no scheduled triggers, so
   the first request past the TTL kicks a non-blocking background
   refresh via context.waitUntil().

   Config (all non-secret except the key):
     - env.GOOGLE_MAPS_API_KEY  (Cloudflare Pages secret) — required
     - settings.google_place_id     — the Google Place ID, OR
     - settings.google_place_query  — a business name to resolve an ID from
   Cache written back into settings:
     - google_reviews_json      — compact { rating, count, maps_uri, reviews[] }
     - google_reviews_synced_at — ISO timestamp of the last attempt
     - google_reviews_error     — last error message ("" when healthy)
   ============================================================ */

// Verified public Google Place ID for "On Point Services" (Landscaper,
// Auckland — onpointservices.co.nz, +64 21 225 5533). Used when no
// google_place_id setting is present, so the feature works with only the
// API key configured. Override any time via a google_place_id setting.
const DEFAULT_PLACE_ID = "ChIJgZy42W__-CIRqg9bep5teTU";

const DETAILS_FIELDS = "id,displayName,rating,userRatingCount,googleMapsUri,reviews";
const FRESH_TTL_MS = 12 * 60 * 60 * 1000; // once we have data, refresh ~twice a day
const RETRY_MS = 5 * 60 * 1000; // before the first success, retry every 5 min

function toMap(rows) {
  const s = {};
  for (const r of rows || []) s[r.key] = r.value;
  return s;
}

function putStmt(env, key, value) {
  return env.DB.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`
  ).bind(key, value == null ? "" : String(value));
}

/* Fire a background refresh iff configured and the cache is missing/stale.
   Accepts the raw settings rows ([{key,value}]). Never throws, never blocks. */
export function maybeRefreshReviews(context, settingsRows) {
  try {
    const { env } = context;
    if (!env || !env.GOOGLE_MAPS_API_KEY) return;
    const s = toMap(settingsRows);
    const placeId = s.google_place_id || DEFAULT_PLACE_ID;
    const query = s.google_place_query; // optional: resolve a different listing by name
    if (!placeId && !query) return;

    const hasData = !!s.google_reviews_json;
    const last = Date.parse(s.google_reviews_synced_at || "") || 0;
    const cooldown = hasData ? FRESH_TTL_MS : RETRY_MS;
    if (Date.now() - last < cooldown) return;

    context.waitUntil(refreshGoogleReviews(env, { placeId, query }).catch(() => {}));
  } catch {
    /* a cache check must never break a page render */
  }
}

/* Resolve a Place ID from a free-text business name (Text Search New). */
async function resolvePlaceId(env, query) {
  const res = await fetch("https://places.googleapis.com/v1/places:searchText", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY,
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress",
    },
    body: JSON.stringify({ textQuery: query, regionCode: "NZ", maxResultCount: 1 }),
  });
  if (!res.ok) return "";
  const data = await res.json();
  return (data.places && data.places[0] && data.places[0].id) || "";
}

/* Fetch place details + reviews and write the compact cache into settings.
   Records the attempt timestamp on both success and failure so a
   misconfiguration can't hammer the API on every page view. */
export async function refreshGoogleReviews(env, opts = {}) {
  const stampAttempt = () => putStmt(env, "google_reviews_synced_at", new Date().toISOString());

  try {
    let placeId = opts.placeId;
    if (!placeId && opts.query) {
      placeId = await resolvePlaceId(env, opts.query);
      if (placeId) await putStmt(env, "google_place_id", placeId).run();
    }
    if (!placeId) {
      await env.DB.batch([stampAttempt(), putStmt(env, "google_reviews_error", "No place id or query configured")]);
      return { ok: false, error: "no-place" };
    }

    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: {
        "X-Goog-Api-Key": env.GOOGLE_MAPS_API_KEY,
        "X-Goog-FieldMask": DETAILS_FIELDS,
      },
    });

    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 300);
      await env.DB.batch([stampAttempt(), putStmt(env, "google_reviews_error", `HTTP ${res.status} ${detail}`)]);
      return { ok: false, error: `HTTP ${res.status}` };
    }

    const p = await res.json();
    const compact = {
      place_name: (p.displayName && p.displayName.text) || "",
      maps_uri: p.googleMapsUri || "",
      rating: p.rating || null,
      count: p.userRatingCount || 0,
      reviews: (p.reviews || []).map((r) => ({
        author: (r.authorAttribution && r.authorAttribution.displayName) || "",
        author_uri: (r.authorAttribution && r.authorAttribution.uri) || "",
        photo: (r.authorAttribution && r.authorAttribution.photoUri) || "",
        rating: r.rating || 0,
        text: (r.text && r.text.text) || "",
        when: r.relativePublishTimeDescription || "",
        time: r.publishTime || "",
      })),
    };

    await env.DB.batch([
      putStmt(env, "google_reviews_json", JSON.stringify(compact)),
      putStmt(env, "google_reviews_synced_at", new Date().toISOString()),
      putStmt(env, "google_reviews_error", ""),
    ]);
    return { ok: true, place_id: placeId, count: compact.reviews.length, rating: compact.rating };
  } catch (e) {
    try {
      await env.DB.batch([stampAttempt(), putStmt(env, "google_reviews_error", String((e && e.message) || e).slice(0, 300))]);
    } catch {}
    return { ok: false, error: "exception" };
  }
}
