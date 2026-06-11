import { json, err, slugify, readBody } from "./_utils.js";

/* GET /api/pages — list all pages with section counts */
export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    `SELECT p.id, p.slug, p.title, p.nav_label, p.nav_order, p.published,
            (SELECT COUNT(*) FROM sections s WHERE s.page_id = p.id) AS section_count
     FROM pages p
     ORDER BY p.nav_order, p.title`
  ).all();
  return json({ pages: results || [] });
}

/* POST /api/pages — create a new page from a title */
export async function onRequestPost(context) {
  const { request, env } = context;
  const { title } = await readBody(request);
  if (!title) return err("A title is required.");

  let base = slugify(title) || "page";
  let slug = base;
  let i = 2;
  while (await env.DB.prepare("SELECT id FROM pages WHERE slug = ?").bind(slug).first()) {
    slug = `${base}-${i++}`;
  }

  const res = await env.DB.prepare(
    "INSERT INTO pages (slug, title, nav_order, published) VALUES (?, ?, 90, 0)"
  )
    .bind(slug, title)
    .run();

  return json({ id: res.meta.last_row_id, slug });
}
