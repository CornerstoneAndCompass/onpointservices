import { json } from "./_utils.js";
import { renderSectionsBody } from "../_render.js";

/* ============================================================
   GET /api/seo — on-page SEO audit of every published page and
   blog post, scored with actionable issues, plus site-wide checks.
   Admin-only (gated by functions/api/_middleware.js).
   ============================================================ */

const SUFFIX = " | On Point Services Ltd";

/* Pull structural signals out of a chunk of body HTML. */
function analyzeHtml(html) {
  html = html || "";
  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  const imgsNoAlt = imgTags.filter((t) => !/\balt\s*=/i.test(t)).length; // truly missing alt only
  const internalLinks = (html.match(/href\s*=\s*["']\/(?!\/)/gi) || []).length;
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ");
  const words = (text.match(/[A-Za-z0-9’'-]+/g) || []).length;
  return { h1, imgs: imgTags.length, imgsNoAlt, internalLinks, words };
}

/* Score a record 0–100 and collect issues. level: bad | warn | good. */
function scoreItem(r) {
  const issues = [];
  let score = 100;
  const add = (level, msg, penalty) => {
    issues.push({ level, msg });
    score -= penalty || 0;
  };

  if (!r.hasCustomTitle) add("warn", "No custom SEO title (using the default)", 6);
  if (r.titleLen > 65) add("warn", `Title is long (${r.titleLen} chars — may truncate in results)`, 6);
  else if (r.titleLen < 20) add("warn", `Title is short (${r.titleLen} chars)`, 4);

  if (!r.hasCustomDesc) add("bad", "No meta description", 15);
  else if (r.descLen < 70) add("warn", `Meta description is short (${r.descLen} chars)`, 5);
  else if (r.descLen > 165) add("warn", `Meta description is long (${r.descLen} chars — may truncate)`, 5);

  if (r.h1 === 0) add("bad", "No H1 heading", 15);
  else if (r.h1 > 1) add("warn", `Multiple H1 headings (${r.h1})`, 8);

  if (r.words < 150) add("bad", `Thin content (${r.words} words)`, 15);
  else if (r.words < 300) add("warn", `Low word count (${r.words} words)`, 5);

  if (r.imgsNoAlt > 0)
    add("warn", `${r.imgsNoAlt} image${r.imgsNoAlt > 1 ? "s" : ""} missing alt text`, 5);

  if (r.internalLinks === 0) add("warn", "No internal links in the content", 4);

  if (!r.hasOg) add("warn", "No custom social share image", 3);

  if (r.noindex) add("bad", "Set to noindex — won't be indexed or ranked", 20);

  score = Math.max(0, Math.min(100, score));
  if (!issues.length) issues.push({ level: "good", msg: "No issues found" });
  return { score, issues };
}

export async function onRequestGet(context) {
  const { env, request } = context;

  const settings =
    (await env.DB.prepare("SELECT key, value FROM settings").all()).results || [];

  const pages =
    (
      await env.DB.prepare(
        "SELECT id, slug, title, seo_title, seo_description, seo_og_image, noindex, updated_at FROM pages WHERE published = 1 ORDER BY nav_order"
      ).all()
    ).results || [];

  const posts =
    (
      await env.DB.prepare(
        "SELECT id, slug, title, seo_title, seo_description, excerpt, cover_image, body, updated_at FROM blog_posts WHERE published = 1 ORDER BY COALESCE(published_at, updated_at) DESC"
      ).all()
    ).results || [];

  const items = [];

  for (const p of pages) {
    const secRows =
      (
        await env.DB.prepare(
          "SELECT type, enabled, data FROM sections WHERE page_id = ? ORDER BY sort_order"
        )
          .bind(p.id)
          .all()
      ).results || [];
    const sections = secRows.map((s) => {
      let data = {};
      try {
        data = JSON.parse(s.data || "{}");
      } catch {}
      return { type: s.type, enabled: s.enabled, data };
    });
    const body = renderSectionsBody(sections, settings);
    const a = analyzeHtml(body);
    const title = p.seo_title || (p.title ? p.title + SUFFIX : "On Point Services Ltd");
    const desc = p.seo_description || "";
    const rec = {
      kind: "Page",
      url: "/" + (p.slug || ""),
      title,
      titleLen: title.length,
      hasCustomTitle: !!p.seo_title,
      descLen: (p.seo_description || "").length,
      hasCustomDesc: !!p.seo_description,
      hasOg: !!p.seo_og_image,
      noindex: !!p.noindex,
      h1: a.h1,
      words: a.words,
      imgs: a.imgs,
      imgsNoAlt: a.imgsNoAlt,
      internalLinks: a.internalLinks,
      updated_at: p.updated_at,
    };
    const { score, issues } = scoreItem(rec);
    items.push({ ...rec, score, issues });
  }

  for (const p of posts) {
    const a = analyzeHtml(p.body || "");
    const title = p.seo_title || (p.title || "") + SUFFIX;
    const desc = p.seo_description || p.excerpt || "";
    const rec = {
      kind: "Post",
      url: "/blog/" + p.slug,
      title,
      titleLen: title.length,
      hasCustomTitle: !!p.seo_title,
      descLen: desc.length,
      hasCustomDesc: !!(p.seo_description || p.excerpt),
      hasOg: !!p.cover_image,
      noindex: false,
      h1: 1, // the post title is rendered as the page H1 by the blog template
      words: a.words,
      imgs: a.imgs + (p.cover_image ? 1 : 0),
      imgsNoAlt: a.imgsNoAlt,
      internalLinks: a.internalLinks,
      updated_at: p.updated_at,
    };
    const { score, issues } = scoreItem(rec);
    items.push({ ...rec, score, issues });
  }

  // Site-wide signals
  const nf = (await env.DB.prepare(
    "SELECT COUNT(*) AS c, COALESCE(SUM(hits),0) AS h FROM not_found_log"
  ).first()) || { c: 0, h: 0 };
  const rd = (await env.DB.prepare("SELECT COUNT(*) AS c FROM redirects").first()) || { c: 0 };

  let robots = false;
  let robotsHasSitemap = false;
  try {
    const res = await fetch(new URL("/robots.txt", request.url).toString());
    robots = res.ok;
    if (res.ok) robotsHasSitemap = /sitemap/i.test(await res.text());
  } catch {}

  const nonGood = (it) => (it.issues || []).filter((x) => x.level !== "good").length;
  const site = {
    pages: pages.length,
    posts: posts.length,
    avgScore: items.length
      ? Math.round(items.reduce((s, i) => s + i.score, 0) / items.length)
      : 0,
    issues: items.reduce((s, i) => s + nonGood(i), 0),
    missingDesc: items.filter((i) => !i.hasCustomDesc).length,
    noindex: items.filter((i) => i.noindex).length,
    notFound: nf.c,
    notFoundHits: nf.h,
    redirects: rd.c,
    sitemap: true,
    robots,
    robotsHasSitemap,
  };

  items.sort((a, b) => a.score - b.score); // worst first

  return json({ generatedAt: new Date().toISOString(), site, items });
}
