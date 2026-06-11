import { json, readBody } from "./_utils.js";

/* GET /api/settings — all settings as a key→value object */
export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  const settings = {};
  for (const r of results || []) settings[r.key] = r.value;
  return json({ settings });
}

/* PUT /api/settings — upsert a batch of key→value pairs */
export async function onRequestPut(context) {
  const { request, env } = context;
  const { settings } = await readBody(request);
  if (!settings || typeof settings !== "object")
    return json({ error: "Missing settings object." }, 400);

  const stmts = Object.entries(settings).map(([key, value]) =>
    env.DB.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')`
    ).bind(key, value == null ? "" : String(value))
  );
  if (stmts.length) await env.DB.batch(stmts);

  return json({ ok: true });
}
