import { json, err, slugify, slugifyPath, readBody } from "../_utils.js";

/* GET /api/pages/:id — page meta + ordered sections (data parsed) */
export async function onRequestGet(context) {
  const { env, params } = context;
  const page = await env.DB.prepare("SELECT * FROM pages WHERE id = ?")
    .bind(params.id)
    .first();
  if (!page) return err("Page not found.", 404);

  const { results } = await env.DB.prepare(
    "SELECT id, type, sort_order, enabled, data FROM sections WHERE page_id = ? ORDER BY sort_order"
  )
    .bind(params.id)
    .all();

  const sections = (results || []).map((s) => {
    let data = {};
    try {
      data = JSON.parse(s.data || "{}");
    } catch {
      data = {};
    }
    return { type: s.type, enabled: s.enabled, data };
  });

  return json({ page, sections });
}

/* PUT /api/pages/:id — save page meta + replace all sections */
export async function onRequestPut(context) {
  const { request, env, params } = context;
  const { page, sections } = await readBody(request);
  if (!page) return err("Missing page data.");

  const existing = await env.DB.prepare("SELECT id, slug FROM pages WHERE id = ?")
    .bind(params.id)
    .first();
  if (!existing) return err("Page not found.", 404);

  // Slug: home page (existing '') stays ''. Otherwise slugifyPath (preserves
  // slashes for nested pages like services/garden-maintenance), keep unique.
  let slug = existing.slug;
  if (existing.slug !== "") {
    slug = slugifyPath(page.slug || page.title) || existing.slug;
    const clash = await env.DB.prepare(
      "SELECT id FROM pages WHERE slug = ? AND id != ?"
    )
      .bind(slug, params.id)
      .first();
    if (clash) slug = `${slug}-${params.id}`;
  } else if (page.slug && page.slug !== "") {
    // allow turning the home page into a normal page only if explicitly changed
    slug = slugifyPath(page.slug);
  }

  await env.DB.prepare(
    `UPDATE pages SET slug=?, title=?, nav_label=?, nav_order=?,
       seo_title=?, seo_description=?, seo_og_image=?, noindex=?, published=?,
       updated_at=datetime('now')
     WHERE id=?`
  )
    .bind(
      slug,
      page.title || "Untitled",
      page.nav_label || null,
      parseInt(page.nav_order, 10) || 0,
      page.seo_title || null,
      page.seo_description || null,
      page.seo_og_image || null,
      page.noindex ? 1 : 0,
      page.published ? 1 : 0,
      params.id
    )
    .run();

  // Replace sections wholesale (simplest reliable approach for reordering)
  await env.DB.prepare("DELETE FROM sections WHERE page_id = ?").bind(params.id).run();

  const list = Array.isArray(sections) ? sections : [];
  const stmts = list.map((sec, idx) =>
    env.DB.prepare(
      "INSERT INTO sections (page_id, type, sort_order, enabled, data) VALUES (?, ?, ?, ?, ?)"
    ).bind(
      params.id,
      sec.type,
      idx,
      sec.enabled ? 1 : 0,
      JSON.stringify(sec.data || {})
    )
  );
  if (stmts.length) await env.DB.batch(stmts);

  return json({ ok: true, slug });
}

/* DELETE /api/pages/:id */
export async function onRequestDelete(context) {
  const { env, params } = context;
  await env.DB.prepare("DELETE FROM sections WHERE page_id = ?").bind(params.id).run();
  await env.DB.prepare("DELETE FROM pages WHERE id = ?").bind(params.id).run();
  return json({ ok: true });
}
