import { json, err, readBody } from "./_utils.js";

/* GET /api/enquiry — list (auth, newest first) */
export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    "SELECT id, name, email, phone, message, source, is_read, created_at FROM enquiries ORDER BY created_at DESC"
  ).all();
  return json({ enquiries: results || [] });
}

/* POST /api/enquiry — PUBLIC contact-form submission.
   Stores reliably in D1 so nothing is ever lost, then best-effort email. */
export async function onRequestPost(context) {
  const { request, env } = context;
  const body = await readBody(request);
  const name = (body.name || "").toString().slice(0, 200);
  const email = (body.email || "").toString().slice(0, 200);
  const phone = (body.phone || "").toString().slice(0, 60);
  const message = (body.message || "").toString().slice(0, 5000);
  const source = (body.source || "website").toString().slice(0, 120);

  if (!name && !email && !phone && !message)
    return err("Please add your details before sending.");

  await env.DB.prepare(
    "INSERT INTO enquiries (name, email, phone, message, source) VALUES (?, ?, ?, ?, ?)"
  )
    .bind(name || null, email || null, phone || null, message || null, source)
    .run();

  // Best-effort notification — never block or fail the submission on this.
  context.waitUntil(notify(env, { name, email, phone, message, source }).catch(() => {}));

  return json({ ok: true });
}

/* DELETE /api/enquiry?id=123 */
export async function onRequestDelete(context) {
  const { request, env } = context;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return err("Missing id.");
  await env.DB.prepare("DELETE FROM enquiries WHERE id = ?").bind(id).run();
  return json({ ok: true });
}

async function notify(env, e) {
  // Uses a Cloudflare Email send binding if one is configured (env.SEND_EMAIL).
  // Falls back silently — the enquiry is already saved and visible in the admin.
  if (!env.SEND_EMAIL) return;
  const to =
    (await getSetting(env, "notification_email")) ||
    (await getSetting(env, "email")) ||
    "";
  if (!to) return;
  try {
    const { EmailMessage } = await import("cloudflare:email");
    const raw =
      `From: On Point Website <noreply@onpointservices.co.nz>\r\n` +
      `To: ${to}\r\n` +
      `Reply-To: ${e.email || "noreply@onpointservices.co.nz"}\r\n` +
      `Subject: New enquiry from ${e.name || "website"}\r\n\r\n` +
      `Name: ${e.name}\nEmail: ${e.email}\nPhone: ${e.phone}\nPage: ${e.source}\n\n${e.message}\n`;
    await env.SEND_EMAIL.send(new EmailMessage("noreply@onpointservices.co.nz", to, raw));
  } catch {
    /* email not configured — ignore */
  }
}

async function getSetting(env, key) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?")
    .bind(key)
    .first();
  return row ? row.value : "";
}
