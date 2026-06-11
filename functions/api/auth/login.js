import { json, err, verifyPassword, createSession, readBody } from "../_utils.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  const { email, password } = await readBody(request);
  if (!email || !password) return err("Email and password are required.");

  const user = await env.DB.prepare(
    "SELECT id, email, name, role, password_hash FROM users WHERE email = ?"
  )
    .bind(String(email).trim().toLowerCase())
    .first();

  if (!user || !(await verifyPassword(password, user.password_hash)))
    return err("Incorrect email or password.", 401);

  const cookie = await createSession(env, user);
  return json(
    { user: { id: user.id, email: user.email, name: user.name, role: user.role } },
    200,
    { "Set-Cookie": cookie }
  );
}
