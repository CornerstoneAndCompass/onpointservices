import { json, err, readBody } from "./_utils.js";

/* GET /api/redirects — list */
export async function onRequestGet(context) {
  const { results } = await context.env.DB.prepare(
    "SELECT id, from_path, to_path, created_at FROM redirects ORDER BY created_at DESC"
  ).all();
  return json({ redirects: results || [] });
}

/* POST /api/redirects — create/update {from_path, to_path} */
export async function onRequestPost(context) {
  const body = await readBody(context.request);
  let from = String(body.from_path || "").trim();
  let to = String(body.to_path || "").trim();
  if (!from || !to) return err("Both the old path and the destination are required.");
  if (!from.startsWith("/")) from = "/" + from;
  if (!to.startsWith("/") && !/^https?:\/\//i.test(to)) to = "/" + to;
  if (from === to) return err("The old path and destination cannot be the same.");

  try {
    await context.env.DB.prepare(
      `INSERT INTO redirects (from_path, to_path) VALUES (?, ?)
       ON CONFLICT(from_path) DO UPDATE SET to_path = excluded.to_path`
    )
      .bind(from.slice(0, 512), to.slice(0, 512))
      .run();
    // If this path was in the 404 log, clear it — it's handled now.
    await context.env.DB.prepare("DELETE FROM not_found_log WHERE path = ?").bind(from).run();
  } catch (e) {
    return err("Could not save the redirect.");
  }
  return json({ ok: true, from_path: from, to_path: to });
}
