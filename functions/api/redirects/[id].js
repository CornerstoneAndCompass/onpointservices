import { json } from "../_utils.js";

/* DELETE /api/redirects/:id */
export async function onRequestDelete(context) {
  await context.env.DB.prepare("DELETE FROM redirects WHERE id = ?").bind(context.params.id).run();
  return json({ ok: true });
}
