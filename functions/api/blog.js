import { json, err, slugify, readBody } from "./_utils.js";

/* GET /api/blog — list posts */
export async function onRequestGet(context) {
  const { env } = context;
  const { results } = await env.DB.prepare(
    `SELECT id, slug, title, category, author, published, published_at, updated_at
     FROM blog_posts ORDER BY COALESCE(published_at, updated_at) DESC`
  ).all();
  return json({ posts: results || [] });
}

/* POST /api/blog — create from title */
export async function onRequestPost(context) {
  const { request, env } = context;
  const { title } = await readBody(request);
  if (!title) return err("A title is required.");

  let base = slugify(title) || "post";
  let slug = base;
  let i = 2;
  while (
    await env.DB.prepare("SELECT id FROM blog_posts WHERE slug = ?").bind(slug).first()
  ) {
    slug = `${base}-${i++}`;
  }

  const res = await env.DB.prepare(
    "INSERT INTO blog_posts (slug, title, published) VALUES (?, ?, 0)"
  )
    .bind(slug, title)
    .run();

  return json({ id: res.meta.last_row_id, slug });
}
