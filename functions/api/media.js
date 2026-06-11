import { json, err, slugify } from "./_utils.js";

/* GET /api/media — list library items, newest first */
export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    "SELECT id, url, alt, label, created_at FROM media ORDER BY created_at DESC, id DESC"
  ).all();
  return json({ media: results || [] });
}

/* POST /api/media — upload an image to R2 and record it.
   Accepts multipart/form-data (file, alt, label) or JSON {url, alt, label}
   for registering an already-hosted image. */
export async function onRequestPost(context) {
  const { request, env } = context;
  const ct = request.headers.get("Content-Type") || "";

  if (ct.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") return err("No file provided.");
    if (!file.type || !file.type.startsWith("image/"))
      return err("Only image files are allowed.");
    if (file.size > 15 * 1024 * 1024) return err("Image is larger than 15MB.");

    const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const base = slugify(file.name.replace(/\.[^.]+$/, "")) || "image";
    const key = `${Date.now()}-${base}.${ext}`;

    await env.MEDIA.put(key, file.stream(), {
      httpMetadata: { contentType: file.type },
    });

    const url = `/media/${key}`;
    const alt = (form.get("alt") || "").toString().slice(0, 300);
    const label = (form.get("label") || file.name || "").toString().slice(0, 200);

    const res = await env.DB.prepare(
      "INSERT INTO media (url, alt, label) VALUES (?, ?, ?)"
    )
      .bind(url, alt, label)
      .run();

    return json({ id: res.meta.last_row_id, url, alt, label });
  }

  // JSON registration of an external/already-hosted URL
  let body = {};
  try {
    body = await request.json();
  } catch {
    return err("Invalid request.");
  }
  if (!body.url) return err("A file or url is required.");
  const res = await env.DB.prepare(
    "INSERT INTO media (url, alt, label) VALUES (?, ?, ?)"
  )
    .bind(String(body.url), (body.alt || "").slice(0, 300), (body.label || "").slice(0, 200))
    .run();
  return json({ id: res.meta.last_row_id, url: body.url, alt: body.alt || "", label: body.label || "" });
}
