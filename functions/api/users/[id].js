import { json, err, hashPassword, readBody } from "../_utils.js";

/* PUT /api/users/:id — set a new password */
export async function onRequestPut(context) {
  const { request, env, params } = context;
  const { password } = await readBody(request);
  if (!password || String(password).length < 8)
    return err("Password must be at least 8 characters.");

  const user = await env.DB.prepare("SELECT id FROM users WHERE id = ?")
    .bind(params.id)
    .first();
  if (!user) return err("User not found.", 404);

  const hash = await hashPassword(password);
  await env.DB.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .bind(hash, params.id)
    .run();
  return json({ ok: true });
}

/* DELETE /api/users/:id — never allow deleting the last user */
export async function onRequestDelete(context) {
  const { env, params, data } = context;
  const count = await env.DB.prepare("SELECT COUNT(*) n FROM users").first();
  if (count && count.n <= 1) return err("Cannot delete the only remaining user.", 400);
  if (data.user && String(data.user.id) === String(params.id))
    return err("You cannot delete your own account.", 400);

  await env.DB.prepare("DELETE FROM users WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}
