import { json, err } from "../_utils.js";

/* DELETE /api/media/:id — remove the DB record and the R2 object */
export async function onRequestDelete(context) {
  const { env, params } = context;
  const row = await env.DB.prepare("SELECT url FROM media WHERE id = ?")
    .bind(params.id)
    .first();
  if (!row) return err("Media item not found.", 404);

  // Only attempt R2 delete for objects we host under /media/
  if (row.url && row.url.startsWith("/media/")) {
    const key = row.url.slice("/media/".length);
    try {
      await env.MEDIA.delete(key);
    } catch {
      /* ignore — still remove the DB record */
    }
  }
  await env.DB.prepare("DELETE FROM media WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}
