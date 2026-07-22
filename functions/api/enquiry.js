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

const SENDER = "jeff@onpointservices.co.nz"; // SPF-authorised for smtp2go on this domain

/* PUT /api/enquiry?id=123  {is_read:true}   — mark read/unread
   PUT /api/enquiry?all=1   {is_read:true}   — mark all */
export async function onRequestPut(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const body = await readBody(request);
  const isRead = body.is_read ? 1 : 0;
  if (url.searchParams.get("all")) {
    await env.DB.prepare("UPDATE enquiries SET is_read = ?").bind(isRead).run();
    return json({ ok: true });
  }
  const id = url.searchParams.get("id");
  if (!id) return err("Missing id.");
  await env.DB.prepare("UPDATE enquiries SET is_read = ? WHERE id = ?").bind(isRead, id).run();
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
  // Sends via SMTP2GO (already SPF-authorised for this domain). The API key is a
  // Cloudflare Pages secret (SMTP2GO_API_KEY). If unset, this no-ops — the
  // enquiry is already saved in D1 and visible in the admin Enquiries tab.
  if (!env.SMTP2GO_API_KEY) return;
  const to =
    (await getSetting(env, "notification_email")) ||
    (await getSetting(env, "email")) ||
    "jeff@onpointservices.co.nz";

  const safe = (s) => String(s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
  const subject = `New website enquiry from ${e.name || "no name"}`;
  const text =
    `New enquiry from the On Point website\n\n` +
    `Name:  ${e.name || "-"}\n` +
    `Email: ${e.email || "-"}\n` +
    `Phone: ${e.phone || "-"}\n` +
    `Page:  ${e.source || "-"}\n\n` +
    `${e.message || "(no message)"}\n`;
  const html =
    `<h2 style="margin:0 0 12px">New website enquiry</h2>` +
    `<p style="margin:0 0 4px"><strong>Name:</strong> ${safe(e.name) || "-"}</p>` +
    `<p style="margin:0 0 4px"><strong>Email:</strong> ${safe(e.email) || "-"}</p>` +
    `<p style="margin:0 0 4px"><strong>Phone:</strong> ${safe(e.phone) || "-"}</p>` +
    `<p style="margin:0 0 12px"><strong>Page:</strong> ${safe(e.source) || "-"}</p>` +
    `<p style="white-space:pre-wrap;border-top:1px solid #ddd;padding-top:12px">${safe(e.message) || "(no message)"}</p>`;

  const body = {
    api_key: env.SMTP2GO_API_KEY,
    sender: SENDER,
    to: [to],
    subject,
    text_body: text,
    html_body: html,
  };
  // Reply straight to the enquirer when they left an email
  if (e.email) body.custom_headers = [{ header: "Reply-To", value: e.email }];

  await fetch("https://api.smtp2go.com/v3/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
}

async function getSetting(env, key) {
  const row = await env.DB.prepare("SELECT value FROM settings WHERE key = ?")
    .bind(key)
    .first();
  return row ? row.value : "";
}
