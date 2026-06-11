import { json } from "../_utils.js";

export async function onRequestGet(context) {
  const { env, data } = context;
  if (data.user) return json({ user: data.user });
  const row = await env.DB.prepare("SELECT COUNT(*) n FROM users").first();
  const needsSetup = !row || row.n === 0;
  return json({ user: null, needsSetup });
}
