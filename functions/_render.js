/* ============================================================
   On Point — server-side renderer
   Turns a page's CMS sections (D1) into the same HTML the site
   was designed with. Every section type below mirrors the
   original markup so the design is preserved, but driven by data.
   ============================================================ */

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const attr = (s) => esc(s);
const arr = (x) => (Array.isArray(x) ? x : []);

/* service-card icon set (keyword -> inner SVG) */
const ICONS = {
  leaf: '<path d="M12 22V8M12 8c0-3 3-6 6-6 0 3-3 6-6 6Zm0 0c0-3-3-6-6-6 0 3 3 6 6 6Zm0 6c-2 0-4-2-4-4M12 14c2 0 4-2 4-4"/>',
  design: '<path d="M3 18l5-12 8 6-7 6Zm14-2 4-4-2-2-4 4Zm-1 1 2 2"/>',
  build: '<path d="M3 21h18M5 21V8l7-5 7 5v13M9 21v-6h6v6M7 12h10"/>',
  hedge: '<path d="M3 14c3-2 6-2 9 0s6 2 9 0M3 18c3-2 6-2 9 0s6 2 9 0M9 6l-2 5M15 6l2 5"/>',
  lawn: '<path d="M3 20h18M5 20v-6M9 20v-9M13 20v-7M17 20v-10M21 20v-5"/>',
  cleanup: '<path d="M5 19l3-9 6 4-3 8Zm6-9 5-7M14 17l5 3M16 9l5 3"/>',
  water: '<path d="M12 22a7 7 0 0 0 7-7c0-5-7-13-7-13S5 10 5 15a7 7 0 0 0 7 7Z"/>',
  pool: '<path d="M2 16c2-1 4-1 6 0s4 1 6 0 4-1 6 0M2 20c2-1 4-1 6 0s4 1 6 0 4-1 6 0M7 13V5a2 2 0 0 1 4 0M13 13V5a2 2 0 0 1 4 0"/>',
};

const arrow = '<span class="arrow"></span>';

/* Slug of the post-enquiry thank-you page. The contact form redirects here on a
   successful submit (js/main.js), and it is the only page that fires the ad
   conversion events below. Keep in sync with the CMS page slug. */
export const THANK_YOU_SLUG = "thank-you";

/* gold star row (rating 1–5), used by the Google reviews section */
function starRow(rating, size = 16) {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  let out = "";
  for (let i = 1; i <= 5; i++) {
    const on = i <= n;
    out += `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="${on ? "#F4C518" : "none"}" stroke="#F4C518" stroke-width="1.4" aria-hidden="true" style="flex:0 0 auto;"><path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 18.8l-5.8 3.1 1.1-6.5L2.6 9.3l6.5-.9L12 2.5Z"/></svg>`;
  }
  return `<span role="img" aria-label="${n} out of 5 stars" style="display:inline-flex; gap:2px; align-items:center;">${out}</span>`;
}

/* multi-colour Google "G" — the required attribution mark for review content */
const GOOGLE_G =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" style="flex:0 0 auto;"><path fill="#4285F4" d="M23.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.55-5.17 3.55-8.87Z"/><path fill="#34A853" d="M12 24c3.24 0 5.96-1.08 7.95-2.91l-3.88-3.01c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A12 12 0 0 0 12 24Z"/><path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54V6.64H1.29a12 12 0 0 0 0 10.72l3.98-3.09Z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.44-3.44A12 12 0 0 0 1.29 6.64l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"/></svg>';

function btn(b) {
  const cls = b.style === "ghost" ? "btn btn-ghost" : "btn btn-primary";
  const isTel = String(b.url || "").startsWith("tel:");
  return `<a href="${attr(b.url)}" class="${cls}">${esc(b.label)}${isTel ? "" : " " + arrow}</a>`;
}

function sectionHead(d) {
  if (!d.heading && !d.lede && !d.heading_gold) return "";
  const h =
    esc(d.heading) + (d.heading_gold ? ` <span class="gold">${esc(d.heading_gold)}</span>` : "");
  return `<div class="section-head reveal"><h2>${h}</h2>${d.lede ? `<p class="lede">${esc(d.lede)}</p>` : ""}</div>`;
}

/* ---------------- section renderers ---------------- */
const R = {
  hero(d) {
    const lines = arr(d.heading_lines)
      .map((l) => `<span class="${l.gold ? "gold-line" : ""}">${esc(l.text)}</span>`)
      .join("\n        ");
    const buttons = arr(d.buttons).map(btn).join("\n        ");
    const meta = arr(d.meta)
      .map((m) => `<div><div class="label">${esc(m.label)}</div><div class="val">${esc(m.value)}</div></div>`)
      .join("");
    return `<section class="hero">
  <div class="topo-bg"></div>
  <div class="container hero-grid">
    <div class="reveal">
      ${d.eyebrow ? `<div class="hero-eyebrow"><span class="eyebrow">${esc(d.eyebrow)}</span></div>` : ""}
      <h1 class="display display-xl">
        ${d.heading_outline ? `<span class="outline">${esc(d.heading_outline)}</span>` : ""}
        ${lines}
      </h1>
      ${d.lede ? `<p class="lede">${esc(d.lede)}</p>` : ""}
      ${buttons ? `<div style="display:flex; gap:14px; flex-wrap:wrap; margin-top:36px;">${buttons}</div>` : ""}
      ${meta ? `<div class="hero-meta">${meta}</div>` : ""}
    </div>
    <div class="hero-visual reveal">
      ${d.image ? `<img src="${attr(d.image)}" alt="${attr(d.image_alt)}" loading="eager" fetchpriority="high" decoding="async" />` : ""}
      ${d.caption_eyebrow || d.caption_title ? `<div class="hero-tag-card"><span class="eyebrow">${esc(d.caption_eyebrow)}</span><strong>${esc(d.caption_title)}</strong></div>` : ""}
    </div>
  </div>
</section>`;
  },

  marquee(d) {
    const items = arr(d.items).map((i) => `${esc(i.text)} <span class="marquee-dot"></span>`).join("\n      ");
    return `<div class="marquee"><div class="marquee-track"><span>\n      ${items}\n    </span></div></div>`;
  },

  split_cards(d) {
    const cards = arr(d.cards)
      .map(
        (c) => `<a href="${attr(c.link_url)}" class="audience-card"${c.image ? ` style="--bg-img: url('${attr(c.image)}');"` : ""}>
      <div>
        <div class="audience-num">${esc(c.number_label)}</div>
        <h3>${esc(c.title)}</h3>
        <p>${esc(c.body)}</p>
      </div>
      <span class="audience-link">${esc(c.link_label)} ${arrow}</span>
    </a>`
      )
      .join("\n    ");
    return `<section aria-label="Choose your project type"><div class="audience">\n    ${cards}\n  </div></section>`;
  },

  feature_grid(d) {
    const cols = d.columns || "3";
    const cards = arr(d.cards)
      .map((c) => {
        const inner =
          (c.number ? `<span class="num">${esc(c.number)}</span>` : "") +
          (c.icon && c.icon !== "none"
            ? `<div class="service-icon"><svg viewBox="0 0 24 24">${ICONS[c.icon] || ICONS.leaf}</svg></div>`
            : "") +
          (c.image ? `<img src="${attr(c.image)}" alt="${attr(c.title)}" loading="lazy" style="width:100%;border-radius:6px;margin-bottom:14px;" />` : "") +
          `<h3>${esc(c.title)}</h3>` +
          `<p>${esc(c.body)}</p>` +
          (c.link_url ? `<span class="more">${esc(c.link_label || "View service")} ${arrow}</span>` : "");
        return c.link_url
          ? `<a href="${attr(c.link_url)}" class="service-card reveal">${inner}</a>`
          : `<div class="service-card reveal" style="cursor:default;">${inner}</div>`;
      })
      .join("\n      ");
    return `<section class="section"><div class="container">
    ${sectionHead(d)}
    <div class="grid grid-${cols}">
      ${cards}
    </div>
  </div></section>`;
  },

  stats(d) {
    const items = arr(d.items)
      .map(
        (s) => `<div class="stat"><div class="stat-num"><span data-count="${attr(s.number)}">0</span><small>${esc(s.suffix)}</small></div><div class="stat-label">${esc(s.label)}</div></div>`
      )
      .join("\n      ");
    return `<section class="section-tight"><div class="container"><div class="stats reveal">\n      ${items}\n    </div></div></section>`;
  },

  badge_strip(d) {
    return `<section class="section-tight" style="border-bottom:1px solid var(--line-soft);"><div class="container">
    <div class="reveal" style="display:flex; align-items:center; justify-content:space-between; gap:32px; flex-wrap:wrap;">
      <div style="display:flex; align-items:center; gap:18px;">
        <div style="width:48px;height:48px;border-radius:50%;border:1px solid var(--gold);display:flex;align-items:center;justify-content:center;flex:0 0 48px;">
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#F4C518" stroke-width="1.5" stroke-linecap="round"><path d="M12 22s8-4 8-12V5l-8-3-8 3v5c0 8 8 12 8 12Z"/><path d="m9 12 2 2 4-4"/></svg>
        </div>
        <div>
          <div style="font-family:var(--font-mono);font-size:0.7rem;letter-spacing:0.22em;text-transform:uppercase;color:var(--gold);margin-bottom:4px;">${esc(d.eyebrow)}</div>
          <div style="font-family:var(--font-display);font-size:1.3rem;color:var(--bone);letter-spacing:-0.01em;">${esc(d.title)}</div>
        </div>
      </div>
      ${d.link_label ? `<a href="${attr(d.link_url)}" class="btn btn-ghost">${esc(d.link_label)} ${arrow}</a>` : ""}
    </div>
  </div></section>`;
  },

  process(d) {
    const steps = arr(d.steps)
      .map(
        (s) => `<div class="process-item reveal"><div class="process-num">${esc(s.number)}</div><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p></div>`
      )
      .join("\n      ");
    return `<section class="section"><div class="container">
    ${sectionHead(d)}
    <div class="process-list">
      ${steps}
    </div>
  </div></section>`;
  },

  gallery(d) {
    let filterBar = "";
    if (d.show_filter) {
      const tokens = [];
      arr(d.items).forEach((it) =>
        String(it.filters || "")
          .split(/\s+/)
          .filter(Boolean)
          .forEach((t) => {
            if (!tokens.includes(t)) tokens.push(t);
          })
      );
      const buttons =
        `<button data-filter="all" class="active">All work</button>` +
        tokens.map((t) => `<button data-filter="${attr(t)}">${esc(t.charAt(0).toUpperCase() + t.slice(1))}</button>`).join("");
      filterBar = `<div class="filter-bar reveal" role="tablist" aria-label="Filter projects">${buttons}</div>`;
    }
    const cards = arr(d.items)
      .map(
        (it) => `<a href="${attr(it.link || "/contact")}" class="project-card${it.wide ? " wide" : ""} reveal"${it.filters ? ` data-tags="${attr(it.filters)}"` : ""}>
      <img src="${attr(it.image)}" alt="${attr(it.title)}" loading="lazy" />
      <div class="project-card-overlay">
        <span class="project-tag">${esc(it.tag)}</span>
        <h4>${esc(it.title)}</h4>
        <span class="loc">${esc(it.location)}</span>
      </div>
    </a>`
      )
      .join("\n      ");
    return `<section class="section"><div class="container">
    ${sectionHead(d)}
    ${filterBar}
    <div class="project-grid">
      ${cards}
    </div>
  </div></section>`;
  },

  testimonial(d) {
    return `<section class="section"><div class="container"><div class="testimonial reveal">
    <div class="testimonial-quote-mark">"</div>
    <blockquote>${esc(d.quote)}</blockquote>
    <div class="testimonial-author">
      <div class="avatar">${esc(d.initials)}</div>
      <div class="who"><strong>${esc(d.author)}</strong><span>${esc(d.role)}</span></div>
    </div>
  </div></div></section>`;
  },

  reviews(d, settings) {
    let cache = {};
    try {
      cache = JSON.parse((settings && settings.google_reviews_json) || "{}");
    } catch {
      cache = {};
    }
    const all = arr(cache.reviews);
    if (!all.length) return ""; // nothing synced yet — render nothing rather than an empty shell
    const min = parseInt(d.min_rating, 10) || 0;
    const max = parseInt(d.max, 10) || 6;
    const list = all
      .filter((r) => (Number(r.rating) || 0) >= min && String(r.text || "").trim())
      .slice(0, max);
    if (!list.length) return "";

    const overall = cache.rating ? Number(cache.rating).toFixed(1) : "";
    const count = cache.count || 0;
    const mapsUri = cache.maps_uri || "";

    const summary = `<div class="reveal" style="display:flex; align-items:center; gap:22px; flex-wrap:wrap; margin-bottom:40px; padding:24px 28px; background:var(--ink-2); border:1px solid var(--line-soft); border-radius:6px;">
      ${overall ? `<div style="font-family:var(--font-display); font-size:2.6rem; line-height:1; color:var(--gold);">${esc(overall)}</div>` : ""}
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${starRow(overall || 5, 18)}
        <div style="display:flex; align-items:center; gap:8px; font-family:var(--font-mono); font-size:0.72rem; letter-spacing:0.16em; text-transform:uppercase; color:var(--bone-dim);">
          ${GOOGLE_G}<span>${count ? esc(count) + " Google reviews" : "Reviews from Google"}</span>
        </div>
      </div>
      ${mapsUri ? `<a href="${attr(mapsUri)}" target="_blank" rel="noopener" class="btn btn-ghost" style="margin-left:auto;">Read on Google ${arrow}</a>` : ""}
    </div>`;

    const cards = list
      .map((r) => {
        const name = r.author || "Google user";
        const initials =
          name
            .trim()
            .split(/\s+/)
            .map((w) => w[0] || "")
            .slice(0, 2)
            .join("")
            .toUpperCase() || "G";
        // Uniform gold-initials avatars for a consistent row (also matches the
        // site's testimonial avatar). Google photos intentionally not shown.
        const avatar = `<span aria-hidden="true" style="width:46px; height:46px; border-radius:50%; background:var(--gold); color:var(--ink); display:flex; align-items:center; justify-content:center; font-family:var(--font-display); font-size:1.05rem; flex:0 0 46px;">${esc(initials)}</span>`;
        const body = esc(r.text).replace(/\r?\n/g, "<br>");
        return `<div class="reveal" style="background:var(--ink-2); border:1px solid var(--line-soft); border-radius:6px; padding:28px; display:flex; flex-direction:column; gap:16px;">
        <div style="display:flex; align-items:center; gap:14px;">
          ${avatar}
          <div style="min-width:0; flex:1;">
            <strong style="display:block; color:var(--bone); font-size:0.98rem;">${esc(name)}</strong>
            ${r.when ? `<span style="font-family:var(--font-mono); font-size:0.66rem; letter-spacing:0.12em; text-transform:uppercase; color:var(--bone-dim);">${esc(r.when)}</span>` : ""}
          </div>
          <span style="opacity:0.85;">${GOOGLE_G}</span>
        </div>
        ${starRow(r.rating, 15)}
        <p style="color:var(--bone-dim); font-size:0.96rem; line-height:1.7; margin:0;">${body}</p>
      </div>`;
      })
      .join("\n      ");

    return `<section class="section"><div class="container">
    ${sectionHead(d)}
    ${summary}
    <div class="grid grid-3">
      ${cards}
    </div>
  </div></section>`;
  },

  cta(d) {
    const lines = arr(d.heading_lines)
      .map((l) => `<span${l.outline ? ' class="outline"' : ""}>${esc(l.text)}</span>`)
      .join("");
    const buttons = arr(d.buttons).map(btn).join("\n      ");
    return `<section class="cta-strip"><div class="container">
    <h2>${lines}</h2>
    ${d.body ? `<p style="font-size:1.1rem; max-width:50ch; color:rgba(10,10,10,0.85); font-weight:500;">${esc(d.body)}</p>` : ""}
    <div class="cta-strip-actions">${buttons}</div>
  </div></section>`;
  },

  page_header(d) {
    const crumbs = arr(d.crumbs)
      .map((c) => (c.url ? `<a href="${attr(c.url)}">${esc(c.label)}</a>` : `<span>${esc(c.label)}</span>`))
      .join('<span class="sep">/</span>');
    return `<section class="page-header"><div class="topo-bg"></div><div class="container reveal">
    <div class="crumbs">${crumbs}</div>
    <h1>${esc(d.heading)}${d.heading_gold ? ` <span class="gold">${esc(d.heading_gold)}</span>` : ""}</h1>
    ${d.lede ? `<p class="lede">${esc(d.lede)}</p>` : ""}
  </div></section>`;
  },

  text_media(d) {
    const bullets = arr(d.bullets);
    const left = d.image_side === "left";
    const textCol = `<div class="reveal"${left ? ' style="order:2;"' : ""}>
        ${d.eyebrow ? `<span class="eyebrow">${esc(d.eyebrow)}</span>` : ""}
        <h2 class="display display-md mt-24 mb-24">${esc(d.heading)}</h2>
        ${d.body ? `<div class="lede mb-24">${d.body}</div>` : ""}
        ${bullets.length ? `<ul class="feature-list">${bullets.map((b) => `<li>${esc(b.text)}</li>`).join("")}</ul>` : ""}
      </div>`;
    const mediaCol = `<div class="reveal">
        ${d.image ? `<div class="hero-visual" style="aspect-ratio:1/1;"><img src="${attr(d.image)}" alt="${attr(d.image_alt)}" loading="lazy" /></div>` : ""}
      </div>`;
    return `<section class="section"${d.shaded ? ' style="background:var(--ink-2); border-top:1px solid var(--line-soft); border-bottom:1px solid var(--line-soft);"' : ""}><div class="container">
    <div class="grid grid-2" style="gap:60px; align-items:center;">
      ${textCol}
      ${mediaCol}
    </div>
  </div></section>`;
  },

  faq(d) {
    const items = arr(d.items)
      .map(
        (it, i) => `<details class="faq-item reveal"${i === 0 ? " open" : ""}><summary>${esc(it.question)}</summary><p>${esc(it.answer)}</p></details>`
      )
      .join("\n    ");
    return `<section class="section"><div class="container">
    ${sectionHead(d)}
    ${items}
  </div></section>`;
  },

  contact_block(d, settings) {
    const phoneHref = settings.phone_href ? "tel:" + settings.phone_href.replace(/[^+\d]/g, "") : "tel:+64212255533";
    const phone = settings.phone || "021 225 5533";
    const cta = settings.nav_cta_label || "021 CALL JEFF";
    const email = settings.email || "jeff@onpointservices.co.nz";
    const fb = settings.facebook_url || "https://www.facebook.com/";
    return `<section class="section"><div class="container">
    <div class="contact-grid">
      <div class="reveal">
        <span class="eyebrow">The fastest way</span>
        <h2 class="display display-md mt-24 mb-24">${esc(d.heading || "Just call.")}</h2>
        <a href="${attr(phoneHref)}" style="display:flex; align-items:center; gap:14px; padding:24px; background:var(--gold); color:var(--ink); border-radius:6px; margin-bottom:16px; font-family:var(--font-display); font-size:1.6rem; letter-spacing:-0.01em;">
          <svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M5 4h4l3 6-3 1c1 3 4 6 7 7l1-3 6 3v4a1 1 0 0 1-1 1A18 18 0 0 1 4 5a1 1 0 0 1 1-1Z"/></svg>
          ${esc(cta)}
        </a>
        <p class="mb-40" style="font-size:0.95rem;">${esc(phone)}. We answer Monday to Saturday, 7am to 6pm. Outside hours, leave a message and we will ring back first thing.</p>
        <div style="border-top:1px solid var(--line-soft); padding-top:32px;">
          <h4 style="font-family:var(--font-mono); font-size:0.72rem; letter-spacing:0.24em; text-transform:uppercase; color:var(--gold); margin-bottom:18px;">Other ways</h4>
          <div class="footer-contact-row mb-12">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="12" height="10" rx="1"/><path d="m2 4 6 5 6-5"/></svg>
            <a href="mailto:${attr(email)}">${esc(email)}</a>
          </div>
          <div class="footer-contact-row mb-12">
            <svg viewBox="0 0 16 16" fill="currentColor"><path d="M9 14V8h2l.3-2.5H9V4c0-.7.2-1.2 1.2-1.2H11.5V.6A18 18 0 0 0 10 .5C8.4.5 7.3 1.5 7.3 3.4v2H5V8h2.3v6Z"/></svg>
            <a href="${attr(fb)}" target="_blank" rel="noopener">On Point Services Ltd</a>
          </div>
          <div class="footer-contact-row">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 14s5-4 5-8a5 5 0 1 0-10 0c0 4 5 8 5 8Z"/><circle cx="8" cy="6" r="1.5"/></svg>
            <span>Servicing greater Auckland</span>
          </div>
        </div>
      </div>
      <div class="reveal">
        <form data-form="quote" novalidate style="background:var(--ink-2); border:1px solid var(--line-soft); padding:clamp(28px,4vw,48px); border-radius:6px;">
          <h2 class="display display-sm mb-24">${esc(d.form_heading || "Send a project brief")}</h2>
          <div class="form-grid">
            <div class="form-group"><label for="name">Name</label><input type="text" id="name" name="name" required placeholder="Your name" /></div>
            <div class="form-group"><label for="phone">Phone</label><input type="tel" id="phone" name="phone" required placeholder="021 ..." /></div>
            <div class="form-group full"><label for="email">Email</label><input type="email" id="email" name="email" required placeholder="you@email.com" /></div>
            <div class="form-group full"><label for="address">Property address</label><input type="text" id="address" name="address" placeholder="Suburb is fine for now" /></div>
            <div class="form-group full"><label>Property type</label>
              <div class="checkbox-row">
                <label><input type="radio" name="ptype" value="residential" checked /> Residential</label>
                <label><input type="radio" name="ptype" value="commercial" /> Commercial</label>
                <label><input type="radio" name="ptype" value="rental" /> Rental / managed</label>
                <label><input type="radio" name="ptype" value="bodycorp" /> Body corporate</label>
              </div>
            </div>
            <div class="form-group full"><label>What do you need? (tick all that apply)</label>
              <div class="checkbox-row">
                <label><input type="checkbox" name="services" value="maintenance" /> Garden maintenance</label>
                <label><input type="checkbox" name="services" value="lawn" /> Lawn care</label>
                <label><input type="checkbox" name="services" value="hedge" /> Hedge trimming</label>
                <label><input type="checkbox" name="services" value="design" /> Landscape design</label>
                <label><input type="checkbox" name="services" value="build" /> Construction / build</label>
                <label><input type="checkbox" name="services" value="cleanup" /> One-off clean up</label>
                <label><input type="checkbox" name="services" value="irrigation" /> Irrigation</label>
                <label><input type="checkbox" name="services" value="other" /> Something else</label>
              </div>
            </div>
            <div class="form-group"><label for="timing">Timing</label>
              <select id="timing" name="timing"><option>ASAP</option><option>Next 2 weeks</option><option>Next 1-3 months</option><option>Just exploring</option></select>
            </div>
            <div class="form-group"><label for="budget">Indicative budget</label>
              <select id="budget" name="budget"><option>Under $2k</option><option>$2k - $10k</option><option>$10k - $50k</option><option>$50k+</option><option>Need help estimating</option></select>
            </div>
            <div class="form-group full"><label for="brief">Tell us about it</label>
              <textarea id="brief" name="brief" placeholder="What is the property like? What do you want it to be like? Anything specific to know about access, pets, gates, etc."></textarea>
            </div>
            <div class="form-group full" style="margin-top:8px;">
              <button type="submit" class="btn btn-primary" style="align-self:flex-start;">Send to Jeff ${arrow}</button>
              <p data-form-status style="margin-top:16px; font-size:0.9rem;"></p>
              <p style="margin-top:8px; font-size:0.8rem; color:var(--muted);">We typically reply within one business day. By sending you agree to be contacted about your enquiry.</p>
            </div>
          </div>
        </form>
      </div>
    </div>
  </div></section>`;
  },
};

function renderSection(sec, settings) {
  const fn = R[sec.type];
  if (!fn) return "";
  try {
    return fn(sec.data || {}, settings);
  } catch (e) {
    return "";
  }
}

/* ---------------- shell (nav / footer / head) ---------------- */
const DEFAULT_MENU = [
  { label: "Home", url: "/" },
  { label: "Services", url: "/services" },
  { label: "Residential", url: "/residential" },
  { label: "Commercial", url: "/commercial" },
  { label: "Projects", url: "/projects" },
  { label: "About", url: "/about" },
  { label: "Blog", url: "/blog" },
  { label: "Contact", url: "/contact" },
];

const DEFAULT_FOOTER = [
  {
    title: "Services",
    links: [
      { label: "Garden Maintenance", url: "/services/garden-maintenance" },
      { label: "Landscape Design", url: "/services/landscape-design" },
      { label: "Landscape Construction", url: "/services/landscape-construction" },
      { label: "Hedge Trimming", url: "/services/hedge-trimming" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About Us", url: "/about" },
      { label: "Projects", url: "/projects" },
      { label: "Blog", url: "/blog" },
      { label: "Residential", url: "/residential" },
      { label: "Commercial", url: "/commercial" },
      { label: "Contact", url: "/contact" },
    ],
  },
  {
    title: "Get a Quote",
    links: [
      { label: "Free site walk", url: "/contact" },
      { label: "Maintenance plans", url: "/contact" },
      { label: "Call Jeff direct", url: "tel:+64212255533" },
    ],
  },
];

function parseJSON(v, fallback) {
  if (!v) return fallback;
  try {
    const x = JSON.parse(v);
    return x && x.length ? x : fallback;
  } catch {
    return fallback;
  }
}

const brandLines = (settings) => {
  const l1 = settings.business_name_line1 || "On Point";
  const l2 = settings.business_name_line2 || "Services Ltd";
  return { l1, l2 };
};

function renderNav(settings, activeUrl) {
  const menu = parseJSON(settings.nav_menu, DEFAULT_MENU);
  const logo = settings.logo_url || "/assets/logo.png";
  const { l1, l2 } = brandLines(settings);
  const phoneHref = settings.phone_href ? "tel:" + settings.phone_href.replace(/[^+\d]/g, "") : "tel:+64212255533";
  const cta = settings.nav_cta_label || "021 CALL JEFF";
  const links = menu
    .map((m) => `<a href="${attr(m.url)}"${m.url === activeUrl ? ' class="active"' : ""}>${esc(m.label)}</a>`)
    .join("\n      ");
  return `<header class="nav nav-mobile">
  <div class="container nav-inner">
    <a class="nav-brand" href="/" aria-label="${attr(l1 + " " + l2)} home">
      <img class="logo-mark" src="${attr(logo)}" alt="" />
      <span class="nav-brand-text">${esc(l1)}<small>${esc(l2)}</small></span>
    </a>
    <nav class="nav-links" aria-label="Primary">
      ${links}
    </nav>
    <a href="${attr(phoneHref)}" class="nav-cta nav-cta-desktop">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3h3l2 4-2 1c1 2 3 4 5 5l1-2 4 2v3a1 1 0 0 1-1 1A12 12 0 0 1 3 4a1 1 0 0 1 1-1Z"/></svg>
      ${esc(cta)}
    </a>
    <button class="nav-toggle" aria-label="Open navigation" aria-expanded="false"><span></span><span></span><span></span></button>
  </div>
</header>`;
}

function renderFooter(settings) {
  const cols = parseJSON(settings.footer_cols, DEFAULT_FOOTER);
  const logo = settings.logo_url || "/assets/logo.png";
  const { l1, l2 } = brandLines(settings);
  const tagline = settings.footer_tagline || "Kiwi family-owned. Landscaping, property and outdoor done right, by a team that lives here too.";
  const phoneHref = settings.phone_href ? "tel:" + settings.phone_href.replace(/[^+\d]/g, "") : "tel:+64212255533";
  const phone = settings.phone || "021 225 5533";
  const cta = settings.nav_cta_label || "021 CALL JEFF";
  const email = settings.email || "jeff@onpointservices.co.nz";
  const fb = settings.facebook_url || "https://www.facebook.com/";
  const colsHtml = cols
    .map(
      (c) => `<div class="footer-col"><h4>${esc(c.title)}</h4><ul>${arr(c.links)
        .map((l) => `<li><a href="${attr(l.url)}">${esc(l.label)}</a></li>`)
        .join("")}</ul></div>`
    )
    .join("\n      ");
  return `<footer>
  <div class="topo-corner bl topo-bg topo-dense" style="opacity:0.25;"></div>
  <div class="container">
    <div class="footer-grid">
      <div>
        <div class="footer-brand"><img class="logo-mark" src="${attr(logo)}" alt="${attr(l1 + " " + l2)} logo" /><div class="footer-brand-text">${esc(l1)}<small>${esc(l2)}</small></div></div>
        <p class="footer-tagline">${esc(tagline)}</p>
        <div class="footer-contact-row"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 3h3l2 4-2 1c1 2 3 4 5 5l1-2 4 2v3a1 1 0 0 1-1 1A12 12 0 0 1 3 4a1 1 0 0 1 1-1Z"/></svg><a href="${attr(phoneHref)}">${esc(phone)} · ${esc(cta)}</a></div>
        <div class="footer-contact-row"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="3" width="12" height="10" rx="1"/><path d="m2 4 6 5 6-5"/></svg><a href="mailto:${attr(email)}">${esc(email)}</a></div>
        <div class="footer-contact-row"><svg viewBox="0 0 16 16" fill="currentColor"><path d="M9 14V8h2l.3-2.5H9V4c0-.7.2-1.2 1.2-1.2H11.5V.6A18 18 0 0 0 10 .5C8.4.5 7.3 1.5 7.3 3.4v2H5V8h2.3v6Z"/></svg><a href="${attr(fb)}" target="_blank" rel="noopener">${esc(l1)} ${esc(l2)}</a></div>
      </div>
      ${colsHtml}
    </div>
    <div class="footer-bottom">
      <span>© <span data-year>2026</span> ${esc(l1)} ${esc(l2)} · All rights reserved</span>
      <span>Design · Build · Maintain</span>
      <span><a href="/contact">Privacy</a> · <a href="/contact">Terms</a></span>
    </div>
  </div>
</footer>`;
}

export const SITE = "https://onpointservices.co.nz";
const absUrl = (u) => (!u ? "" : /^https?:\/\//i.test(u) ? u : SITE + (u.startsWith("/") ? u : "/" + u));
const canonicalFor = (page) => SITE + (page.slug ? "/" + page.slug : "/");

function findOgImage(sections) {
  for (const s of sections || []) {
    const d = s.data || {};
    if (d.image) return d.image;
    if (Array.isArray(d.items)) { const it = d.items.find((i) => i.image); if (it) return it.image; }
    if (Array.isArray(d.cards)) { const c = d.cards.find((i) => i.image); if (c) return c.image; }
  }
  return "/assets/projects/deck-hardwood-1.jpg";
}

function localBusiness(settings) {
  const b = {
    "@type": "LocalBusiness",
    "@id": SITE + "/#business",
    name: (settings.business_name_line1 || "On Point") + " " + (settings.business_name_line2 || "Services Ltd"),
    url: SITE + "/",
    logo: absUrl(settings.logo_url || "/assets/logo.png"),
    image: absUrl("/assets/projects/deck-hardwood-1.jpg"),
    telephone: settings.phone_href || "+64212255533",
    email: settings.email || "jeff@onpointservices.co.nz",
    priceRange: "$$",
    address: { "@type": "PostalAddress", addressLocality: "Auckland", addressRegion: "Auckland", addressCountry: "NZ" },
    areaServed: { "@type": "City", name: "Auckland" },
    description: "Kiwi family-owned landscaping company. Garden maintenance, design and outdoor construction for residential and commercial properties across Auckland.",
  };
  // The CMS ships with a bare "https://www.facebook.com/" in the Facebook box.
  // Publishing that as sameAs hands Google a link to nothing and weakens the
  // entity, so only profile URLs with something after the domain go in.
  const socials = [settings.facebook_url, settings.instagram_url].filter((u) => {
    try {
      return !!u && new URL(u).pathname.replace(/\/+$/, "") !== "";
    } catch {
      return false;
    }
  });
  if (socials.length) b.sameAs = socials;
  return b;
}

function buildJsonLd(page, sections, settings, canonical) {
  const blocks = [localBusiness(settings)];
  const ph = (sections || []).find((s) => s.type === "page_header");
  const crumbs = ph && ph.data && ph.data.crumbs;
  if (Array.isArray(crumbs) && crumbs.length) {
    const items = crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.label, item: c.url ? absUrl(c.url) : canonical }));
    items.push({ "@type": "ListItem", position: items.length + 1, name: page.title || "", item: canonical });
    blocks.push({ "@type": "BreadcrumbList", itemListElement: items });
  }
  const faqItems = [];
  (sections || []).filter((s) => s.type === "faq").forEach((s) => {
    ((s.data && s.data.items) || []).forEach((it) => {
      if (it.question && it.answer) faqItems.push({ "@type": "Question", name: it.question, acceptedAnswer: { "@type": "Answer", text: it.answer } });
    });
  });
  if (faqItems.length) blocks.push({ "@type": "FAQPage", mainEntity: faqItems });
  if (page.slug && page.slug.indexOf("services/") === 0) {
    blocks.push({ "@type": "Service", name: page.title, serviceType: page.title, provider: { "@id": SITE + "/#business" }, areaServed: { "@type": "City", name: "Auckland" }, url: canonical });
  }
  return blocks;
}

function jsonLdScript(blocks) {
  if (!blocks || !blocks.length) return "";
  const doc = blocks.length === 1 ? blocks[0] : blocks;
  const withCtx = Array.isArray(doc) ? { "@context": "https://schema.org", "@graph": doc } : { "@context": "https://schema.org", ...doc };
  return `<script type="application/ld+json">${JSON.stringify(withCtx).replace(/</g, "\\u003c")}</script>\n`;
}

function renderHead(page, settings, opts) {
  opts = opts || {};
  const logo = settings.logo_url || "/assets/logo.png";
  const title = page.seo_title || (page.title ? page.title + " | On Point Services Ltd" : "On Point Services Ltd");
  const desc =
    page.seo_description ||
    "On Point Services Ltd designs, builds and maintains residential and commercial outdoor spaces across Auckland.";
  const canonical = canonicalFor(page);
  const ogImg = absUrl(page.seo_og_image || opts.ogImage || "/assets/projects/deck-hardwood-1.jpg");
  const businessName = (settings.business_name_line1 || "On Point") + " " + (settings.business_name_line2 || "Services Ltd");
  // Only the thank-you page counts as a conversion. Every other page just gets PageView.
  const isConversion = page.slug === THANK_YOU_SLUG;
  return `<!DOCTYPE html>
<html lang="en-NZ">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${attr(desc)}" />
<link rel="canonical" href="${attr(canonical)}" />
<meta name="robots" content="${page.noindex ? "noindex,nofollow" : "index,follow,max-image-preview:large"}" />
<meta name="theme-color" content="#0A0A0A" />
<link rel="icon" type="${/\.svg$/i.test(logo) ? "image/svg+xml" : /\.png$/i.test(logo) ? "image/png" : "image/jpeg"}" href="${attr(logo)}" />
<link rel="apple-touch-icon" href="${attr(logo)}" />
<meta property="og:type" content="${page.slug && page.slug.indexOf("blog/") === 0 ? "article" : "website"}" />
<meta property="og:site_name" content="${attr(businessName)}" />
<meta property="og:locale" content="en_NZ" />
<meta property="og:url" content="${attr(canonical)}" />
<meta property="og:title" content="${attr(title)}" />
<meta property="og:description" content="${attr(desc)}" />
<meta property="og:image" content="${attr(ogImg)}" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${attr(title)}" />
<meta name="twitter:description" content="${attr(desc)}" />
<meta name="twitter:image" content="${attr(ogImg)}" />
${jsonLdScript(opts.jsonLd)}<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
<link rel="stylesheet" href="/css/styles.css" />
<!-- Meta Pixel Code -->
<script>
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '2425873347908572');
fbq('track', 'PageView');${isConversion ? `
fbq('track', 'Lead');` : ""}
</script>
<noscript><img height="1" width="1" style="display:none"
src="https://www.facebook.com/tr?id=2425873347908572&ev=PageView&noscript=1"
/></noscript>
<!-- End Meta Pixel Code -->${isConversion ? `
<!-- Google Ads conversion, thank-you page only. TODO: paste the event snippet
     from Google Ads > Goals > Conversions here (the gtag.js base tag needs to
     go in the block above this one, on every page). -->` : ""}
</head>
<body>`;
}

export function renderSimple(page, innerHtml, settingsRows) {
  const settings = settingsObj(settingsRows);
  return shell(page, settings, innerHtml, { jsonLd: [localBusiness(settings)] });
}

function shell(page, settings, inner, opts) {
  const activeUrl = "/" + (page.slug || "");
  return (
    renderHead(page, settings, opts) +
    "\n" +
    renderNav(settings, activeUrl) +
    "\n" +
    inner +
    "\n" +
    renderFooter(settings) +
    `\n<script src="/js/main.js"></script>\n<script src="/js/cms.js" defer></script>\n</body>\n</html>`
  );
}

function settingsObj(rows) {
  const s = {};
  for (const r of rows || []) s[r.key] = r.value;
  return s;
}

export function renderBlogIndex(blogPage, posts, settingsRows) {
  const settings = settingsObj(settingsRows);
  const page = {
    slug: "blog",
    title: blogPage?.title || "Blog",
    seo_title: blogPage?.seo_title || "Blog | On Point Services Ltd",
    seo_description: blogPage?.seo_description || "Landscaping tips, project stories and seasonal advice from On Point Services Ltd.",
  };
  const heading = blogPage?.title || "From the blog.";
  const cards = arr(posts).length
    ? arr(posts)
        .map(
          (p) => `<a href="/blog/${attr(p.slug)}" class="project-card reveal">
      ${p.cover_image ? `<img src="${attr(p.cover_image)}" alt="${attr(p.title)}" loading="lazy" />` : ""}
      <div class="project-card-overlay">
        <span class="project-tag">${esc(p.category || "Blog")}</span>
        <h4>${esc(p.title)}</h4>
        <span class="loc">${esc(p.published_at || "")}</span>
      </div>
    </a>`
        )
        .join("\n      ")
    : `<p class="lede">No posts yet. Check back soon.</p>`;
  const inner = `<section class="page-header"><div class="topo-bg"></div><div class="container reveal">
    <div class="crumbs"><a href="/">Home</a><span class="sep">/</span><span>Blog</span></div>
    <h1>${esc(heading)}</h1>
    <p class="lede">Project stories, seasonal advice and the occasional opinion from the crew.</p>
  </div></section>
  <section class="section"><div class="container"><div class="project-grid">
      ${cards}
  </div></div></section>`;
  return shell(page, settings, inner, {
    ogImage: (arr(posts)[0] || {}).cover_image,
    jsonLd: [localBusiness(settings)],
  });
}

export function renderBlogPost(post, settingsRows) {
  const settings = settingsObj(settingsRows);
  const page = {
    slug: "blog/" + post.slug,
    title: post.title,
    seo_title: post.seo_title || post.title + " | On Point Services Ltd",
    seo_description: post.seo_description || post.excerpt || "",
    seo_og_image: post.cover_image || "",
  };
  const inner = `<section class="page-header"><div class="topo-bg"></div><div class="container reveal">
    <div class="crumbs"><a href="/">Home</a><span class="sep">/</span><a href="/blog">Blog</a><span class="sep">/</span><span>${esc(post.title)}</span></div>
    <h1>${esc(post.title)}</h1>
    ${post.excerpt ? `<p class="lede">${esc(post.excerpt)}</p>` : ""}
    <p style="font-family:var(--font-mono); font-size:0.75rem; letter-spacing:0.16em; text-transform:uppercase; color:var(--bone-dim); margin-top:12px;">${esc(post.author || "On Point Services")}${post.published_at ? " · " + esc(post.published_at) : ""}</p>
  </div></section>
  <section class="section"><div class="container" style="max-width:780px;">
    ${post.cover_image ? `<div class="hero-visual" style="margin-bottom:36px;"><img src="${attr(post.cover_image)}" alt="${attr(post.title)}" loading="lazy" /></div>` : ""}
    <div class="article-body" style="font-size:1.08rem; line-height:1.85;">${post.body || ""}</div>
    <p style="margin-top:48px;"><a href="/blog" class="btn btn-ghost">&larr; Back to blog</a></p>
  </div></section>`;
  const canonical = canonicalFor(page);
  const blogPosting = {
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt || "",
    image: post.cover_image ? absUrl(post.cover_image) : absUrl("/assets/projects/deck-hardwood-1.jpg"),
    datePublished: post.published_at || undefined,
    dateModified: post.updated_at || post.published_at || undefined,
    author: { "@type": "Organization", name: post.author || "On Point Services Ltd" },
    publisher: { "@id": SITE + "/#business" },
    mainEntityOfPage: canonical,
  };
  return shell(page, settings, inner, {
    ogImage: post.cover_image,
    jsonLd: [localBusiness(settings), blogPosting],
  });
}

export function renderPage(page, sections, settingsRows) {
  const settings = settingsObj(settingsRows);
  const body = sections
    .filter((s) => s.enabled)
    .map((s) => renderSection(s, settings))
    .join("\n\n");
  const opts = {
    ogImage: findOgImage(sections),
    jsonLd: buildJsonLd(page, sections, settings, canonicalFor(page)),
  };
  return shell(page, settings, body, opts);
}

/* Content-only HTML (enabled sections, no nav/footer/head) — used by the SEO
   audit so word counts, H1s, images and links reflect the page body, not the
   shared chrome. */
export function renderSectionsBody(sections, settingsRows) {
  const settings = settingsObj(settingsRows);
  return arr(sections)
    .filter((s) => s.enabled)
    .map((s) => renderSection(s, settings))
    .join("\n");
}

export { esc };
