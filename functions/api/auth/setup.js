import { json, err, hashPassword, createSession, readBody } from "../_utils.js";

/* First-run owner creation. Only works while there are zero users. */
export async function onRequestPost(context) {
  const { request, env } = context;
  const existing = await env.DB.prepare("SELECT COUNT(*) n FROM users").first();
  if (existing && existing.n > 0)
    return err("Setup has already been completed.", 403);

  const { name, email, password } = await readBody(request);
  if (!email || !password) return err("Email and password are required.");
  if (String(password).length < 8)
    return err("Password must be at least 8 characters.");

  const hash = await hashPassword(password);
  const res = await env.DB.prepare(
    "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, 'admin')"
  )
    .bind(String(email).trim().toLowerCase(), name || "Admin", hash)
    .run();

  const user = {
    id: res.meta.last_row_id,
    email: String(email).trim().toLowerCase(),
    name: name || "Admin",
    role: "admin",
  };
  const cookie = await createSession(env, user);
  return json({ user }, 200, { "Set-Cookie": cookie });
}
