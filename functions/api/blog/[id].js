import { json, err, slugify, readBody } from "../_utils.js";

/* GET /api/blog/:id */
export async function onRequestGet(context) {
  const { env, params } = context;
  const post = await env.DB.prepare("SELECT * FROM blog_posts WHERE id = ?")
    .bind(params.id)
    .first();
  if (!post) return err("Post not found.", 404);
  return json({ post });
}

/* PUT /api/blog/:id */
export async function onRequestPut(context) {
  const { request, env, params } = context;
  const post = await readBody(request);

  const existing = await env.DB.prepare("SELECT id, slug FROM blog_posts WHERE id = ?")
    .bind(params.id)
    .first();
  if (!existing) return err("Post not found.", 404);

  let slug = slugify(post.slug || post.title) || existing.slug;
  const clash = await env.DB.prepare(
    "SELECT id FROM blog_posts WHERE slug = ? AND id != ?"
  )
    .bind(slug, params.id)
    .first();
  if (clash) slug = `${slug}-${params.id}`;

  await env.DB.prepare(
    `UPDATE blog_posts SET slug=?, title=?, excerpt=?, body=?, cover_image=?,
       author=?, category=?, seo_title=?, seo_description=?, published=?, published_at=?,
       updated_at=datetime('now')
     WHERE id=?`
  )
    .bind(
      slug,
      post.title || "Untitled",
      post.excerpt || null,
      post.body || "",
      post.cover_image || null,
      post.author || "On Point Services",
      post.category || null,
      post.seo_title || null,
      post.seo_description || null,
      post.published ? 1 : 0,
      post.published_at || (post.published ? new Date().toISOString().slice(0, 10) : null),
      params.id
    )
    .run();

  return json({ ok: true, slug });
}

/* DELETE /api/blog/:id */
export async function onRequestDelete(context) {
  const { env, params } = context;
  await env.DB.prepare("DELETE FROM blog_posts WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}
