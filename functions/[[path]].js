/* Catch-all page renderer. Serves every public page from the CMS (D1).
   Runs only for routes not handled by static assets (/assets, /css, /js,
   /admin) or more-specific functions (/api/*, /media/*). */
import { renderPage, renderBlogIndex, renderBlogPost, renderSimple, SITE } from "./_render.js";

// Old static filenames -> CMS slugs, so existing links/bookmarks keep working.
const LEGACY = {
  index: "",
  "service-garden-maintenance": "services/garden-maintenance",
  "service-landscape-design": "services/landscape-design",
  "service-landscape-construction": "services/landscape-construction",
  "service-hedge-trimming": "services/hedge-trimming",
};

const html = (body, status = 200) =>
  new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Always revalidate so CMS edits appear on the live site immediately
      // (static assets keep their own long-lived cache via the asset handler).
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });

async function getSettings(env) {
  const { results } = await env.DB.prepare("SELECT key, value FROM settings").all();
  return results || [];
}

async function sitemap(env) {
  const { results: pages } = await env.DB.prepare(
    "SELECT slug, updated_at FROM pages WHERE published = 1 AND noindex = 0 ORDER BY nav_order"
  ).all();
  const { results: posts } = await env.DB.prepare(
    "SELECT slug, updated_at FROM blog_posts WHERE published = 1"
  ).all();
  const urls = [];
  for (const p of pages || []) urls.push({ loc: SITE + (p.slug ? "/" + p.slug : "/"), lastmod: p.updated_at });
  for (const b of posts || []) urls.push({ loc: SITE + "/blog/" + b.slug, lastmod: b.updated_at });
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls
      .map(
        (u) =>
          `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${String(u.lastmod).slice(0, 10)}</lastmod>` : ""}<changefreq>weekly</changefreq></url>`
      )
      .join("\n") +
    "\n</urlset>";
  return new Response(xml, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}

async function renderCmsPage(env, page) {
  const { results } = await env.DB.prepare(
    "SELECT type, enabled, data FROM sections WHERE page_id = ? ORDER BY sort_order"
  )
    .bind(page.id)
    .all();
  const sections = (results || []).map((s) => {
    let data = {};
    try {
      data = JSON.parse(s.data || "{}");
    } catch {}
    return { type: s.type, enabled: s.enabled, data };
  });
  const settings = await getSettings(env);
  return renderPage(page, sections, settings);
}

async function notFound(env) {
  const settings = await getSettings(env);
  const page = { slug: "404", title: "Page not found", seo_title: "Page not found | On Point Services Ltd", noindex: 1 };
  const inner = `<section class="page-header"><div class="topo-bg"></div><div class="container reveal">
      <div class="crumbs"><a href="/">Home</a><span class="sep">/</span><span>Not found</span></div>
      <h1>Page <span class="gold">not found.</span></h1>
      <p class="lede">That page does not exist. Head back <a href="/" style="color:var(--gold);border-bottom:1px solid var(--gold);">home</a> or <a href="/contact" style="color:var(--gold);border-bottom:1px solid var(--gold);">get in touch</a>.</p>
    </div></section>`;
  return html(renderSimple(page, inner, settings), 404);
}

export async function onRequestGet(context) {
  const { env, params, request } = context;
  const pathname = new URL(request.url).pathname;

  // Dynamic sitemap from published pages + blog posts.
  if (pathname === "/sitemap.xml") return sitemap(env);

  // Let static assets and the admin app fall through to Pages' asset handler.
  // (A root [[path]].js catch-all otherwise intercepts EVERYTHING.)
  if (
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/css/") ||
    pathname.startsWith("/js/") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/media/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    (/\.[a-z0-9]+$/i.test(pathname) && !/\.html$/i.test(pathname))
  ) {
    return context.next();
  }

  let slug = (Array.isArray(params.path) ? params.path.join("/") : params.path || "").replace(/^\/+|\/+$/g, "");
  slug = slug.replace(/\.html$/i, "");
  if (slug in LEGACY) slug = LEGACY[slug];

  try {
    // Blog index
    if (slug === "blog") {
      const blogPage = await env.DB.prepare("SELECT * FROM pages WHERE slug = 'blog'").first();
      const { results: posts } = await env.DB.prepare(
        "SELECT slug, title, excerpt, cover_image, category, author, published_at FROM blog_posts WHERE published = 1 ORDER BY COALESCE(published_at, updated_at) DESC"
      ).all();
      return html(renderBlogIndex(blogPage, posts, await getSettings(env)));
    }
    // Blog post
    if (slug.startsWith("blog/")) {
      const postSlug = slug.slice("blog/".length);
      const post = await env.DB.prepare("SELECT * FROM blog_posts WHERE slug = ? AND published = 1").bind(postSlug).first();
      if (!post) return await notFound(env);
      return html(renderBlogPost(post, await getSettings(env)));
    }
    // Normal CMS page
    const page = await env.DB.prepare("SELECT * FROM pages WHERE slug = ? AND published = 1").bind(slug).first();
    if (!page) return await notFound(env);
    return html(await renderCmsPage(env, page));
  } catch (e) {
    return html("<h1>Something went wrong</h1><p>Please try again shortly.</p>", 500);
  }
}
