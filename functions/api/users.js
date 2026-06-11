import { json, err, hashPassword, readBody } from "./_utils.js";

/* GET /api/users — list (no hashes) */
export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    "SELECT id, email, name, role, created_at FROM users ORDER BY created_at"
  ).all();
  return json({ users: results || [] });
}

/* POST /api/users — add a user */
export async function onRequestPost(context) {
  const { request, env } = context;
  const { name, email, password } = await readBody(request);
  if (!email || !password) return err("Email and password are required.");
  if (String(password).length < 8)
    return err("Password must be at least 8 characters.");

  const clean = String(email).trim().toLowerCase();
  const exists = await env.DB.prepare("SELECT id FROM users WHERE email = ?")
    .bind(clean)
    .first();
  if (exists) return err("A user with that email already exists.");

  const hash = await hashPassword(password);
  const res = await env.DB.prepare(
    "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'admin')"
  )
    .bind(clean, name || "Admin", hash)
    .run();

  return json({ id: res.meta.last_row_id });
}
