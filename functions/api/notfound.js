import { json } from "./_utils.js";

/* GET /api/notfound — list logged 404s, most-hit first */
export async function onRequestGet(context) {
  const { results } = await context.env.DB.prepare(
    "SELECT path, hits, last_referer, last_seen FROM not_found_log ORDER BY hits DESC, last_seen DESC LIMIT 300"
  ).all();
  return json({ notfound: results || [] });
}

/* DELETE /api/notfound?path=/x  (or ?all=1 to clear the log) */
export async function onRequestDelete(context) {
  const url = new URL(context.request.url);
  if (url.searchParams.get("all")) {
    await context.env.DB.prepare("DELETE FROM not_found_log").run();
  } else {
    const path = url.searchParams.get("path");
    if (path) await context.env.DB.prepare("DELETE FROM not_found_log WHERE path = ?").bind(path).run();
  }
  return json({ ok: true });
}
