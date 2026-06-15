/* ============================================================
On Point CMS - admin panel (vanilla JS single-page app)
============================================================ */
(function () {
"use strict";

/* ---------- tiny DOM helper ---------- */
function el(tag, attrs, ...kids) {
const n = document.createElement(tag);
if (attrs) for (const k in attrs) {
if (attrs[k] == null) continue;
if (k === "class") n.className = attrs[k];
else if (k === "html") n.innerHTML = attrs[k];
else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
else n.setAttribute(k, attrs[k]);
}
for (const kid of kids.flat()) {
if (kid == null || kid === false) continue;
n.appendChild(typeof kid === "object" ? kid : document.createTextNode(String(kid)));
}
return n;
}
const app = document.getElementById("app");
function mount(node) { app.innerHTML = ""; app.appendChild(node); }

/* ---------- API ---------- */
const api = {
async req(method, url, body) {
const opt = { method, headers: {} };
if (body !== undefined) { opt.headers["Content-Type"] = "application/json"; opt.body = JSON.stringify(body); }
const res = await fetch(url, opt);
let data = {};
try { data = await res.json(); } catch (e) {}
if (!res.ok) throw new Error(data.error || ("Error " + res.status));
return data;
},
get(u) { return this.req("GET", u); },
post(u, b) { return this.req("POST", u, b); },
put(u, b) { return this.req("PUT", u, b); },
del(u) { return this.req("DELETE", u); }
};

/* ---------- toast ---------- */
let toastTimer;
function toast(msg, isErr) {
const old = document.querySelector(".toast");
if (old) old.remove();
const t = el("div", { class: "toast" + (isErr ? " err" : "") }, msg);
document.body.appendChild(t);
clearTimeout(toastTimer);
toastTimer = setTimeout(() => t.remove(), 3500);
}

/* ---------- state ---------- */
const state = { user: null, schemas: {}, tab: "pages" };

/* ---------- boot ---------- */
async function boot() {
try {
const s = await api.get("/api/auth/session");
if (s.user) { state.user = s.user; await loadSchemas(); renderApp(); }
else if (s.needsSetup) renderSetup();
else renderLogin();
} catch (e) {
renderLogin();
}
}

async function loadSchemas() {
const r = await api.get("/api/schemas");
state.schemas = r.types || {};
}

/* ============================================================
LOGIN / SETUP
============================================================ */
function authShell(title, sub, fields, submitLabel, onSubmit) {
const inputs = {};
const form = el("form", { class: "login-box", onsubmit: async (e) => {
e.preventDefault();
const btn = form.querySelector("button");
btn.disabled = true;
try {
const vals = {};
for (const f of fields) vals[f.name] = inputs[f.name].value;
await onSubmit(vals);
} catch (err) {
toast(err.message, true);
btn.disabled = false;
}
}},
el("img", { src: "/assets/logo.png", alt: "" }),
el("h1", {}, title),
el("p", {}, sub),
...fields.map(f => {
const inp = el("input", { type: f.type, placeholder: f.placeholder, required: "required" });
inputs[f.name] = inp;
return el("div", { class: "field" }, el("label", {}, f.label), inp);
}),
el("button", { class: "btn btn-gold", type: "submit", style: "width:100%;justify-content:center;margin-top:6px;" }, submitLabel)
);
mount(el("div", { class: "login-wrap" }, form));
}

function renderLogin() {
authShell("Staff login", "On Point Services CMS",
[{ name: "email", label: "Email", type: "email", placeholder: "you@email.com" },
{ name: "password", label: "Password", type: "password", placeholder: "Password" }],
"Log in",
async (v) => {
const r = await api.post("/api/auth/login", v);
state.user = r.user; await loadSchemas(); renderApp();
});
}

function renderSetup() {
authShell("Create admin account", "First-time setup. This creates the owner login.",
[{ name: "name", label: "Your name", type: "text", placeholder: "Jeff" },
{ name: "email", label: "Email", type: "email", placeholder: "you@email.com" },
{ name: "password", label: "Password (min 8 characters)", type: "password", placeholder: "Password" }],
"Create account",
async (v) => {
const r = await api.post("/api/auth/setup", v);
state.user = r.user; await loadSchemas(); renderApp();
});
}

/* ============================================================
APP SHELL
============================================================ */
function renderApp() {
const topbar = el("div", { class: "topbar" },
el("div", { class: "topbar-brand" },
el("img", { src: "/assets/logo.png", alt: "" }),
el("div", {}, "On Point CMS", el("small", {}, "Content manager"))),
el("div", { class: "topbar-actions" },
el("a", { class: "btn btn-sm", href: "/", target: "_blank" }, "View site"),
el("span", { class: "topbar-user" }, state.user.name || state.user.email),
el("button", { class: "btn btn-sm", onclick: async () => {
await api.post("/api/auth/logout"); location.reload();
}}, "Log out"))
);
const body = el("div", { class: "wrap", id: "view" });
mount(el("div", {}, topbar, body));
renderTab();
}

function renderTab() {
const view = document.getElementById("view");
view.innerHTML = "";
const tabs = el("div", { class: "tabs" },
...[["pages", "Pages"], ["blog", "Blog"], ["media", "Media"], ["enquiries", "Enquiries"], ["redirects", "Redirects"], ["settings", "Settings"], ["users", "Users"]]
.map(([k, label]) => el("button", {
class: "tab" + (state.tab === k ? " active" : ""),
onclick: () => { state.tab = k; renderTab(); }
}, label)));
view.appendChild(tabs);
const slot = el("div", { id: "slot" });
view.appendChild(slot);
if (state.tab === "pages") viewPagesList(slot);
else if (state.tab === "blog") viewBlogList(slot);
else if (state.tab === "media") viewMedia(slot);
else if (state.tab === "enquiries") viewEnquiries(slot);
else if (state.tab === "redirects") viewRedirects(slot);
else if (state.tab === "settings") viewSettings(slot);
else viewUsers(slot);
}

/* ============================================================
PAGES - list
============================================================ */
async function viewPagesList(slot) {
slot.appendChild(el("div", { class: "spinner" }, "Loading pages..."));
let pages = [];
try { pages = (await api.get("/api/pages")).pages; }
catch (e) { slot.innerHTML = ""; slot.appendChild(el("div", { class: "empty" }, e.message)); return; }
slot.innerHTML = "";

slot.appendChild(el("div", { class: "head-flex" },
el("div", {}, el("div", { class: "page-title" }, "Pages"),
el("div", { class: "page-sub" }, "Every page on the site. Click one to edit its sections.")),
el("button", { class: "btn btn-gold", onclick: () => newPage() }, "+ New page")
));

pages.forEach(p => {
slot.appendChild(el("div", { class: "list-row" },
el("div", { class: "row-main" },
el("h3", {}, p.title),
el("div", { class: "meta" }, "/" + p.slug + " · " + p.section_count + " sections")),
el("div", { class: "row-actions" },
el("span", { class: "pill " + (p.published ? "on" : "off") }, p.published ? "Live" : "Draft"),
el("a", { class: "btn btn-sm", href: "/" + p.slug, target: "_blank" }, "View"),
el("button", { class: "btn btn-sm", onclick: () => editPage(p.id) }, "Edit"))
));
});
}

async function newPage() {
const title = prompt("New page title:");
if (!title) return;
try {
const r = await api.post("/api/pages", { title });
toast("Page created");
editPage(r.id);
} catch (e) { toast(e.message, true); }
}

/* ============================================================
PAGES - editor
============================================================ */
async function editPage(id) {
const slot = document.getElementById("slot");
slot.innerHTML = "";
slot.appendChild(el("div", { class: "spinner" }, "Loading page..."));
let data;
try { data = await api.get("/api/pages/" + id); }
catch (e) { slot.innerHTML = ""; slot.appendChild(el("div", { class: "empty" }, e.message)); return; }

const page = data.page;
const sections = data.sections.map(s => ({ type: s.type, enabled: s.enabled, data: s.data || {} }));

function render() {
slot.innerHTML = "";

slot.appendChild(el("div", { class: "head-flex" },
el("div", {},
el("div", { class: "page-title" }, "Edit: " + page.title),
el("div", { class: "page-sub" }, "Page URL: /" + page.slug)),
el("button", { class: "btn btn-sm", onclick: () => renderTab() }, "← Back to pages")
));

/* --- page meta --- */
slot.appendChild(el("div", { class: "section-label" }, "Page settings"));
const meta = el("div", { class: "card" });
meta.appendChild(el("div", { class: "grid-2" },
metaInput("Page title (admin label)", "title"),
metaInput("URL slug", "slug", "blank for home page")
));
meta.appendChild(el("div", { class: "grid-2" },
metaInput("Nav label (blank = hidden from menu)", "nav_label"),
metaInput("Nav order", "nav_order", "", "number")
));
meta.appendChild(metaInput("SEO title", "seo_title"));
meta.appendChild(metaTextarea("SEO meta description", "seo_description"));
meta.appendChild(metaInput("Social share image URL", "seo_og_image"));
meta.appendChild(el("div", { class: "grid-2" },
metaCheck("Published (visible on site)", "published"),
metaCheck("Hide from search engines (noindex)", "noindex")
));
slot.appendChild(meta);

function metaInput(label, key, help, type) {
const inp = el("input", { type: type || "text", value: page[key] == null ? "" : page[key] });
inp.addEventListener("input", () => { page[key] = inp.value; });
return el("div", { class: "field" }, el("label", {}, label), inp,
help ? el("div", { class: "help" }, help) : null);
}
function metaTextarea(label, key) {
const inp = el("textarea", {});
inp.value = page[key] == null ? "" : page[key];
inp.addEventListener("input", () => { page[key] = inp.value; });
return el("div", { class: "field" }, el("label", {}, label), inp);
}
function metaCheck(label, key) {
const inp = el("input", { type: "checkbox" });
inp.checked = !!page[key];
inp.addEventListener("change", () => { page[key] = inp.checked; });
return el("div", { class: "field field-check" }, inp, el("label", {}, label));
}

/* --- sections --- */
slot.appendChild(el("div", { class: "section-label" }, "Sections (" + sections.length + ")"));
const list = el("div", {});
slot.appendChild(list);

sections.forEach((sec, idx) => list.appendChild(sectionCard(sec, idx)));

function sectionCard(sec, idx) {
const schema = state.schemas[sec.type];
const card = el("div", { class: "section-card" });
const bodyWrap = el("div", { class: "section-body collapsed" });

const head = el("div", { class: "section-head", onclick: (e) => {
if (e.target.closest(".section-ctl")) return;
card.classList.toggle("open");
bodyWrap.classList.toggle("collapsed");
}},
el("div", { class: "section-head-left" },
el("span", { class: "chevron" }, "▶"),
el("span", { class: "stype" }, schema ? schema.label : sec.type),
el("span", { class: "stitle" }, sectionTitle(sec))),
el("div", { class: "row-actions section-ctl" },
el("span", { class: "pill " + (sec.enabled ? "on" : "off") }, sec.enabled ? "On" : "Off"),
iconBtn("↑", () => { move(idx, -1); }),
iconBtn("↓", () => { move(idx, 1); }),
iconBtn("✕", () => {
if (confirm("Delete this section?")) { sections.splice(idx, 1); render(); }
}, "btn-danger"))
);
card.appendChild(head);

if (!schema) {
bodyWrap.appendChild(el("div", { class: "inline-note" }, "Unknown section type: " + sec.type));
} else {
const en = el("div", { class: "field field-check" });
const enInp = el("input", { type: "checkbox" });
enInp.checked = !!sec.enabled;
enInp.addEventListener("change", () => { sec.enabled = enInp.checked; });
en.appendChild(enInp);
en.appendChild(el("label", {}, "Show this section on the page"));
bodyWrap.appendChild(en);
bodyWrap.appendChild(el("div", { class: "inline-note", style: "margin-bottom:14px;" }, schema.description || ""));
schema.fields.forEach(f => bodyWrap.appendChild(fieldControl(f, sec.data)));
}
card.appendChild(bodyWrap);
return card;
}

function move(idx, dir) {
const j = idx + dir;
if (j < 0 || j >= sections.length) return;
const tmp = sections[idx]; sections[idx] = sections[j]; sections[j] = tmp;
render();
}

/* --- add section --- */
const typeSel = el("select", { style: "max-width:260px;" },
...Object.keys(state.schemas).map(t =>
el("option", { value: t }, state.schemas[t].label)));
slot.appendChild(el("div", { class: "add-section-bar" },
typeSel,
el("button", { class: "btn", onclick: () => {
const t = typeSel.value;
sections.push({ type: t, enabled: true, data: defaultData(t) });
render();
toast("Section added - scroll down to edit it");
}}, "+ Add section")
));

/* --- sticky save --- */
slot.appendChild(el("div", { class: "sticky-save" },
el("span", { class: "inline-note" }, "Changes are not live until you save."),
el("button", { class: "btn btn-danger btn-sm", onclick: async () => {
if (!confirm("Delete the whole page \"" + page.title + "\"? This cannot be undone.")) return;
try { await api.del("/api/pages/" + id); toast("Page deleted"); renderTab(); }
catch (e) { toast(e.message, true); }
}}, "Delete page"),
el("button", { class: "btn btn-gold", onclick: saveAll }, "Save changes")
));

async function saveAll() {
try {
const r = await api.put("/api/pages/" + id, { page, sections });
page.slug = r.slug;
toast("Saved");
render();
} catch (e) { toast(e.message, true); }
}
}

render();
}

function sectionTitle(sec) {
const d = sec.data || {};
return d.heading || d.title || d.eyebrow || d.quote ||
(Array.isArray(d.heading_lines) && d.heading_lines[0] && d.heading_lines[0].text) ||
d.heading_outline || "Untitled";
}

function defaultData(type) {
const s = state.schemas[type];
if (!s) return {};
const out = {};
for (const f of s.fields) {
if (f.type === "repeater") out[f.name] = [];
else if (f.type === "checkbox") out[f.name] = false;
else out[f.name] = f.default != null ? f.default : "";
}
return out;
}

/* ============================================================
FIELD RENDERING (the form builder)
============================================================ */
function iconBtn(label, onClick, extra) {
return el("button", { class: "btn btn-icon btn-sm " + (extra || ""), type: "button", onclick: (e) => { e.preventDefault(); onClick(); } }, label);
}

function fieldControl(field, data) {
if (data[field.name] === undefined) {
data[field.name] = field.type === "repeater" ? [] : field.type === "checkbox" ? false : (field.default != null ? field.default : "");
}

if (field.type === "checkbox") {
const inp = el("input", { type: "checkbox" });
inp.checked = !!data[field.name];
inp.addEventListener("change", () => { data[field.name] = inp.checked; });
return el("div", { class: "field field-check" }, inp, el("label", {}, field.label));
}

const wrap = el("div", { class: "field" }, el("label", {}, field.label));

if (field.type === "repeater") {
wrap.appendChild(repeaterControl(field, data));
return wrap;
}

let ctrl;
if (field.type === "textarea" || field.type === "richtext") {
ctrl = el("textarea", {});
ctrl.value = data[field.name] || "";
if (field.type === "richtext") ctrl.style.minHeight = "150px";
ctrl.addEventListener("input", () => { data[field.name] = ctrl.value; });
} else if (field.type === "select") {
ctrl = el("select", {});
(field.options || []).forEach(o => {
const val = typeof o === "object" ? o.value : o;
const lbl = typeof o === "object" ? o.label : o;
const opt = el("option", { value: val }, lbl);
if (String(data[field.name]) === String(val)) opt.selected = true;
ctrl.appendChild(opt);
});
ctrl.addEventListener("change", () => { data[field.name] = ctrl.value; });
} else {
const type = field.type === "number" ? "number" : "text";
ctrl = el("input", { type });
ctrl.value = data[field.name] || "";
if (field.type === "image") ctrl.placeholder = "Pick from library, upload, or paste a URL";
ctrl.addEventListener("input", () => { data[field.name] = ctrl.value; if (field.type === "image") syncImgPreview(); });
}
wrap.appendChild(ctrl);

if (field.type === "richtext") {
wrap.appendChild(el("div", { class: "help" }, "Basic HTML allowed: <p>, <h3>, <strong>, <a>, <ul><li>."));
}

let syncImgPreview = () => {};
if (field.type === "image") {
const prev = el("img", { style: "max-width:160px;border-radius:6px;margin-top:8px;display:none;border:1px solid var(--line-2);" });
syncImgPreview = () => {
if (data[field.name]) { prev.src = data[field.name]; prev.style.display = "block"; }
else prev.style.display = "none";
};
const pickBtn = el("button", { class: "btn btn-sm", type: "button", onclick: () => {
openMediaPicker((url) => { data[field.name] = url; ctrl.value = url; syncImgPreview(); });
}}, "Choose from library");
const clearBtn = el("button", { class: "btn btn-sm", type: "button", onclick: () => {
data[field.name] = ""; ctrl.value = ""; syncImgPreview();
}}, "Clear");
wrap.appendChild(el("div", { class: "row-actions", style: "margin-top:8px;" }, pickBtn, clearBtn));
wrap.appendChild(prev);
syncImgPreview();
}
if (field.help) wrap.appendChild(el("div", { class: "help" }, field.help));
return wrap;
}

function repeaterControl(field, data) {
if (!Array.isArray(data[field.name])) data[field.name] = [];
const rows = data[field.name];
const box = el("div", { class: "repeater" });

function rowDefault() {
const o = {};
for (const sf of field.fields) {
o[sf.name] = sf.type === "checkbox" ? false : sf.type === "repeater" ? [] : (sf.default != null ? sf.default : "");
}
return o;
}
function rerender() {
box.innerHTML = "";
rows.forEach((row, idx) => {
const item = el("div", { class: "rep-item" },
el("div", { class: "rep-item-head" },
el("span", {}, field.label + " " + (idx + 1)),
el("div", { class: "rep-controls" },
iconBtn("↑", () => { if (idx > 0) { swap(idx, idx - 1); rerender(); } }),
iconBtn("↓", () => { if (idx < rows.length - 1) { swap(idx, idx + 1); rerender(); } }),
iconBtn("✕", () => { rows.splice(idx, 1); rerender(); }, "btn-danger")))
);
field.fields.forEach(sf => item.appendChild(fieldControl(sf, row)));
box.appendChild(item);
});
box.appendChild(el("button", { class: "btn btn-sm", type: "button", onclick: () => {
rows.push(rowDefault()); rerender();
}}, "+ Add " + field.label));
}
function swap(a, b) { const t = rows[a]; rows[a] = rows[b]; rows[b] = t; }
rerender();
return box;
}

/* ============================================================
BLOG
============================================================ */
async function viewBlogList(slot) {
slot.appendChild(el("div", { class: "spinner" }, "Loading posts..."));
let posts = [];
try { posts = (await api.get("/api/blog")).posts; }
catch (e) { slot.innerHTML = ""; slot.appendChild(el("div", { class: "empty" }, e.message)); return; }
slot.innerHTML = "";

slot.appendChild(el("div", { class: "head-flex" },
el("div", {}, el("div", { class: "page-title" }, "Blog"),
el("div", { class: "page-sub" }, "Posts appear at /blog on the site.")),
el("button", { class: "btn btn-gold", onclick: () => newPost() }, "+ New post")
));

if (!posts.length) slot.appendChild(el("div", { class: "empty" }, "No posts yet."));
posts.forEach(p => {
slot.appendChild(el("div", { class: "list-row" },
el("div", { class: "row-main" },
el("h3", {}, p.title),
el("div", { class: "meta" }, "/blog/" + p.slug + (p.category ? " · " + p.category : ""))),
el("div", { class: "row-actions" },
el("span", { class: "pill " + (p.published ? "on" : "off") }, p.published ? "Live" : "Draft"),
el("button", { class: "btn btn-sm", onclick: () => editPost(p.id) }, "Edit"))
));
});
}

async function newPost() {
const title = prompt("New post title:");
if (!title) return;
try {
const r = await api.post("/api/blog", { title });
toast("Post created");
editPost(r.id);
} catch (e) { toast(e.message, true); }
}

async function editPost(id) {
const slot = document.getElementById("slot");
slot.innerHTML = "";
slot.appendChild(el("div", { class: "spinner" }, "Loading post..."));
let post;
try { post = (await api.get("/api/blog/" + id)).post; }
catch (e) { slot.innerHTML = ""; slot.appendChild(el("div", { class: "empty" }, e.message)); return; }
slot.innerHTML = "";

function inp(label, key, help, type) {
const i = el("input", { type: type || "text", value: post[key] == null ? "" : post[key] });
i.addEventListener("input", () => { post[key] = i.value; });
return el("div", { class: "field" }, el("label", {}, label), i, help ? el("div", { class: "help" }, help) : null);
}
function ta(label, key, big) {
const i = el("textarea", {});
if (big) i.style.minHeight = "300px";
i.value = post[key] == null ? "" : post[key];
i.addEventListener("input", () => { post[key] = i.value; });
return el("div", { class: "field" }, el("label", {}, label), i);
}

slot.appendChild(el("div", { class: "head-flex" },
el("div", {}, el("div", { class: "page-title" }, "Edit post"),
el("div", { class: "page-sub" }, "/blog/" + post.slug)),
el("button", { class: "btn btn-sm", onclick: () => renderTab() }, "← Back to blog")
));

const card = el("div", { class: "card" });
card.appendChild(inp("Title", "title"));
card.appendChild(el("div", { class: "grid-2" }, inp("URL slug", "slug"), inp("Category", "category")));
card.appendChild(el("div", { class: "grid-2" }, inp("Author", "author"), inp("Publish date", "published_at", "YYYY-MM-DD")));
card.appendChild(inp("Cover image URL", "cover_image"));
card.appendChild(ta("Excerpt (short summary)", "excerpt"));
card.appendChild(ta("Body (HTML)", "body", true));
card.appendChild(el("div", { class: "section-label" }, "SEO"));
card.appendChild(inp("SEO title", "seo_title"));
card.appendChild(ta("SEO meta description", "seo_description"));
const pubInp = el("input", { type: "checkbox" });
pubInp.checked = !!post.published;
pubInp.addEventListener("change", () => { post.published = pubInp.checked; });
card.appendChild(el("div", { class: "field field-check" }, pubInp, el("label", {}, "Published")));
slot.appendChild(card);

slot.appendChild(el("div", { class: "sticky-save" },
el("button", { class: "btn btn-danger btn-sm", onclick: async () => {
if (!confirm("Delete this post?")) return;
try { await api.del("/api/blog/" + id); toast("Post deleted"); renderTab(); }
catch (e) { toast(e.message, true); }
}}, "Delete post"),
el("button", { class: "btn btn-gold", onclick: async () => {
try {
post.published = pubInp.checked;
const r = await api.put("/api/blog/" + id, post);
post.slug = r.slug;
toast("Saved");
} catch (e) { toast(e.message, true); }
}}, "Save post")
));
}

/* ============================================================
ENQUIRIES
============================================================ */
async function viewEnquiries(slot) {
slot.appendChild(el("div", { class: "spinner" }, "Loading enquiries..."));
let list = [];
try { list = (await api.get("/api/enquiry")).enquiries; }
catch (e) { slot.innerHTML = ""; slot.appendChild(el("div", { class: "empty" }, e.message)); return; }
slot.innerHTML = "";

slot.appendChild(el("div", { class: "page-title" }, "Enquiries"));
slot.appendChild(el("div", { class: "page-sub" }, "Contact form submissions from the website."));

if (!list.length) { slot.appendChild(el("div", { class: "empty" }, "No enquiries yet.")); return; }

list.forEach(e => {
const detail = el("div", { class: "enquiry-detail", style: "display:none;" },
el("div", { class: "card", style: "margin-top:6px;" },
el("div", { class: "inline-note", style: "margin-bottom:10px;" },
"Email: ",
e.email
? el("a", { href: "mailto:" + e.email, style: "color:var(--gold);" }, e.email)
: "(none)",
e.phone ? " Phone: " + e.phone : "",
e.source ? " Source: " + e.source : ""),
e.message
? el("p", { style: "white-space:pre-wrap; margin:0;" }, e.message)
: el("p", { class: "inline-note", style: "margin:0;" }, "(no message)")
));

const caret = el("span", { class: "meta", style: "margin-right:10px;" }, "▸");
const row = el("div", {
class: "list-row", style: "cursor:pointer; margin-bottom:0;",
onclick: () => {
const open = detail.style.display !== "none";
detail.style.display = open ? "none" : "block";
caret.textContent = open ? "▸" : "▾";
}
},
el("div", { class: "row-main", style: "display:flex; align-items:center;" },
caret,
el("div", {},
el("h3", {}, e.name || "(no name)",
e.email ? el("span", { style: "color:var(--muted); font-weight:400; margin-left:8px;" }, e.email) : null),
el("div", { class: "meta" }, (e.created_at || "") + (e.source ? " · " + e.source : "")))),
el("div", { class: "row-actions" },
el("button", {
class: "btn btn-sm btn-danger", onclick: async (ev) => {
ev.stopPropagation();
if (!confirm("Delete this enquiry?")) return;
try { await api.del("/api/enquiry?id=" + e.id); toast("Deleted"); renderTab(); }
catch (err) { toast(err.message, true); }
}
}, "Delete")));

slot.appendChild(el("div", { style: "margin-bottom:8px;" }, row, detail));
});
}

/* ============================================================
SETTINGS  (enhanced — grouped into sections)
============================================================ */
async function viewSettings(slot) {
slot.appendChild(el("div", { class: "spinner" }, "Loading settings..."));
let settings = {};
try { settings = (await api.get("/api/settings")).settings; }
catch (e) { slot.innerHTML = ""; slot.appendChild(el("div", { class: "empty" }, e.message)); return; }
slot.innerHTML = "";

slot.appendChild(el("div", { class: "page-title" }, "Global settings"));
slot.appendChild(el("div", { class: "page-sub" }, "Site-wide values used across the nav, footer, and contact sections. Changes go live instantly once saved."));

const inputs = {};

function mkInput(key, label, help, area) {
const ctrl = area ? el("textarea", {}) : el("input", { type: "text" });
ctrl.value = settings[key] || "";
inputs[key] = ctrl;
const field = el("div", { class: "field" }, el("label", {}, label), ctrl);
if (help) field.appendChild(el("div", { class: "help" }, help));
return field;
}

/* ── Branding ──────────────────────────────────────────── */
slot.appendChild(el("div", { class: "section-label" }, "Branding"));
const brandCard = el("div", { class: "card" });
brandCard.appendChild(mkInput("logo_url", "Logo image URL",
"URL of your logo file. Default is /assets/logo.png — replace to use a new image hosted elsewhere (e.g. Cloudflare Images or R2). To change the SVG file itself, update /assets/logo.png in GitHub."));

// Logo preview
const logoPreview = el("img", {
src: settings.logo_url || "/assets/logo.png",
style: "width:80px;height:80px;object-fit:contain;border-radius:8px;border:1px solid var(--line-2);background:var(--ink-3);margin-top:4px;display:block;"
});
inputs["logo_url"].addEventListener("input", () => {
if (inputs["logo_url"].value) logoPreview.src = inputs["logo_url"].value;
});
brandCard.appendChild(logoPreview);

brandCard.appendChild(el("div", { class: "divider" }));
brandCard.appendChild(el("div", { class: "grid-2" },
mkInput("business_name_line1", "Business name (line 1)", "First line in nav and footer, e.g. 'On Point'"),
mkInput("business_name_line2", "Business name (line 2)", "Second line (smaller), e.g. 'Services Ltd'")
));
slot.appendChild(brandCard);

/* ── Contact ───────────────────────────────────────────── */
slot.appendChild(el("div", { class: "section-label" }, "Contact details"));
const contactCard = el("div", { class: "card" });
contactCard.appendChild(el("div", { class: "grid-2" },
mkInput("phone", "Phone number (display)", "Shown as text on the site, e.g. 021 225 5533"),
mkInput("phone_href", "Phone dial string", "Digits only for the tel: link, e.g. +64212255533")
));
contactCard.appendChild(mkInput("nav_cta_label", "Nav button label",
"Text on the top-right call button, e.g. '021 CALL JEFF'"));
contactCard.appendChild(el("div", { class: "divider" }));
contactCard.appendChild(el("div", { class: "grid-2" },
mkInput("email", "Contact email", "Shown in the footer and used as reply-to on enquiries"),
mkInput("notification_email", "Enquiry notification email",
"Where new contact-form enquiries are emailed. Leave blank to use the contact email above.")
));
contactCard.appendChild(el("div", { class: "divider" }));
contactCard.appendChild(el("div", { class: "grid-2" },
mkInput("footer_address", "Address", "Street address shown in the footer (optional)"),
mkInput("footer_service_area", "Service area", "e.g. Auckland-wide")
));
slot.appendChild(contactCard);

/* ── Social ────────────────────────────────────────────── */
slot.appendChild(el("div", { class: "section-label" }, "Social media"));
const socialCard = el("div", { class: "card" });
socialCard.appendChild(el("div", { class: "grid-2" },
mkInput("facebook_url", "Facebook page URL", "Full URL, e.g. https://www.facebook.com/onpointservicesltd"),
mkInput("instagram_url", "Instagram profile URL", "Full URL, e.g. https://www.instagram.com/onpointservices")
));
slot.appendChild(socialCard);

/* ── Footer ────────────────────────────────────────────── */
slot.appendChild(el("div", { class: "section-label" }, "Footer"));
const footerCard = el("div", { class: "card" });
footerCard.appendChild(mkInput("footer_tagline", "Footer tagline",
"Short brand tagline shown under the logo in the footer.", true));
slot.appendChild(footerCard);

/* ── Navigation menu (global) ── */
function parseSetting(key, fallback) {
try { const v = JSON.parse(settings[key] || "null"); return Array.isArray(v) && v.length ? v : fallback; }
catch (e) { return fallback; }
}
function linkRow(item, onRemove, onMove) {
const lbl = el("input", { type: "text", value: item.label || "", placeholder: "Label" });
lbl.addEventListener("input", () => { item.label = lbl.value; });
const url = el("input", { type: "text", value: item.url || "", placeholder: "/page-url or tel:…" });
url.addEventListener("input", () => { item.url = url.value; });
return el("div", { style: "display:flex; gap:6px; align-items:center; margin-bottom:6px;" },
el("div", { style: "flex:1; display:flex; gap:6px;" }, lbl, url),
iconBtn("↑", () => onMove(-1)), iconBtn("↓", () => onMove(1)), iconBtn("✕", onRemove, "btn-danger"));
}

slot.appendChild(el("div", { class: "section-label" }, "Navigation menu"));
const navCard = el("div", { class: "card" });
navCard.appendChild(el("div", { class: "inline-note", style: "margin-bottom:12px;" }, "Links shown in the top navigation bar. Use page URLs like /services."));
const navItems = parseSetting("nav_menu", [
{ label: "Home", url: "/" }, { label: "Services", url: "/services" },
{ label: "Residential", url: "/residential" }, { label: "Commercial", url: "/commercial" },
{ label: "Projects", url: "/projects" }, { label: "About", url: "/about" }, { label: "Contact", url: "/contact" },
]);
const navList = el("div", {});
function renderNav() {
navList.innerHTML = "";
navItems.forEach((it, i) => navList.appendChild(linkRow(it,
() => { navItems.splice(i, 1); renderNav(); },
(d) => { const j = i + d; if (j < 0 || j >= navItems.length) return; [navItems[i], navItems[j]] = [navItems[j], navItems[i]]; renderNav(); })));
navList.appendChild(el("button", { class: "btn btn-sm", type: "button", onclick: () => { navItems.push({ label: "New link", url: "/" }); renderNav(); } }, "+ Add menu link"));
}
renderNav();
navCard.appendChild(navList);
slot.appendChild(navCard);

/* ── Footer columns (global) ── */
slot.appendChild(el("div", { class: "section-label" }, "Footer columns"));
const fcCard = el("div", { class: "card" });
fcCard.appendChild(el("div", { class: "inline-note", style: "margin-bottom:12px;" }, "The link columns shown in the footer (the contact column on the left is built from your contact details above)."));
const footerCols = parseSetting("footer_cols", [
{ title: "Services", links: [
{ label: "Garden Maintenance", url: "/services/garden-maintenance" }, { label: "Landscape Design", url: "/services/landscape-design" },
{ label: "Landscape Construction", url: "/services/landscape-construction" }, { label: "Hedge Trimming", url: "/services/hedge-trimming" } ] },
{ title: "Company", links: [
{ label: "About Us", url: "/about" }, { label: "Projects", url: "/projects" },
{ label: "Residential", url: "/residential" }, { label: "Commercial", url: "/commercial" }, { label: "Contact", url: "/contact" } ] },
{ title: "Get a Quote", links: [
{ label: "Free site walk", url: "/contact" }, { label: "Maintenance plans", url: "/contact" }, { label: "Call Jeff direct", url: "tel:+64212255533" } ] },
]);
const fcList = el("div", {});
function renderFooterCols() {
fcList.innerHTML = "";
footerCols.forEach((col, ci) => {
const titleInp = el("input", { type: "text", value: col.title || "", placeholder: "Column heading" });
titleInp.addEventListener("input", () => { col.title = titleInp.value; });
const linksBox = el("div", { style: "margin-top:8px; padding-left:10px; border-left:2px solid var(--line);" });
if (!Array.isArray(col.links)) col.links = [];
const renderLinks = () => {
linksBox.innerHTML = "";
col.links.forEach((lk, li) => linksBox.appendChild(linkRow(lk,
() => { col.links.splice(li, 1); renderLinks(); },
(d) => { const j = li + d; if (j < 0 || j >= col.links.length) return; [col.links[li], col.links[j]] = [col.links[j], col.links[li]]; renderLinks(); })));
linksBox.appendChild(el("button", { class: "btn btn-sm", type: "button", onclick: () => { col.links.push({ label: "New link", url: "/" }); renderLinks(); } }, "+ Add link"));
};
renderLinks();
fcList.appendChild(el("div", { class: "card", style: "margin-bottom:12px; background:var(--ink-3);" },
el("div", { style: "display:flex; gap:8px; align-items:center;" },
el("div", { style: "flex:1;" }, titleInp),
iconBtn("✕ column", () => { footerCols.splice(ci, 1); renderFooterCols(); }, "btn-danger")),
linksBox));
});
fcList.appendChild(el("button", { class: "btn btn-sm", type: "button", onclick: () => { footerCols.push({ title: "New column", links: [] }); renderFooterCols(); } }, "+ Add footer column"));
}
renderFooterCols();
fcCard.appendChild(fcList);
slot.appendChild(fcCard);

/* ── Save ──────────────────────────────────────────────── */
slot.appendChild(el("div", { class: "sticky-save" },
el("button", { class: "btn btn-gold", onclick: async () => {
const out = {};
for (const k in inputs) out[k] = inputs[k].value;
out.nav_menu = JSON.stringify(navItems.filter(i => i.label && i.url));
out.footer_cols = JSON.stringify(footerCols.filter(c => c.title));
try { await api.put("/api/settings", { settings: out }); toast("Settings saved — changes are live"); }
catch (e) { toast(e.message, true); }
}}, "Save settings")
));
}

/* ============================================================
USERS
============================================================ */
async function viewUsers(slot) {
slot.appendChild(el("div", { class: "spinner" }, "Loading users..."));
let users = [];
try { users = (await api.get("/api/users")).users; }
catch (e) { slot.innerHTML = ""; slot.appendChild(el("div", { class: "empty" }, e.message)); return; }
slot.innerHTML = "";

slot.appendChild(el("div", { class: "head-flex" },
el("div", {}, el("div", { class: "page-title" }, "Users"),
el("div", { class: "page-sub" }, "People who can log in to this CMS. Everyone has full access.")),
el("button", { class: "btn btn-gold", onclick: () => showAddForm() }, "+ Add user")
));

const formSlot = el("div", {});
slot.appendChild(formSlot);

function showAddForm() {
formSlot.innerHTML = "";
const name = el("input", { type: "text", placeholder: "e.g. On Point Client" });
const email = el("input", { type: "email", placeholder: "client@email.com" });
const pw = el("input", { type: "password", placeholder: "At least 8 characters" });
const create = el("button", { class: "btn btn-gold btn-sm", onclick: async () => {
create.disabled = true;
try {
await api.post("/api/users", { name: name.value, email: email.value, password: pw.value });
toast("User added");
renderTab();
} catch (e) { toast(e.message, true); create.disabled = false; }
}}, "Create user");
formSlot.appendChild(el("div", { class: "card" },
el("div", { class: "section-label" }, "New user"),
el("div", { class: "grid-2" },
el("div", { class: "field" }, el("label", {}, "Name"), name),
el("div", { class: "field" }, el("label", {}, "Email"), email)),
el("div", { class: "field" }, el("label", {}, "Password"), pw,
el("div", { class: "help" }, "Give this to the user. They can change it later from this tab.")),
el("div", { class: "row-actions" },
el("button", { class: "btn btn-sm", onclick: () => { formSlot.innerHTML = ""; } }, "Cancel"),
create)
));
}

if (!users.length) slot.appendChild(el("div", { class: "empty" }, "No users yet."));
users.forEach(u => {
const isMe = state.user && String(u.id) === String(state.user.id);
slot.appendChild(el("div", { class: "list-row" },
el("div", { class: "row-main" },
el("h3", {}, (u.name || "(no name)") + (isMe ? " (you)" : "")),
el("div", { class: "meta" }, u.email + (u.created_at ? " · added " + u.created_at : ""))),
el("div", { class: "row-actions" },
el("button", { class: "btn btn-sm", onclick: () => setPassword(u) }, "Set password"),
(users.length > 1 && !isMe)
? el("button", { class: "btn btn-sm btn-danger", onclick: () => deleteUser(u) }, "Delete")
: null)
));
});

async function setPassword(u) {
const pw = prompt("New password for " + (u.name || u.email) + " (at least 8 characters):");
if (pw == null) return;
try { await api.put("/api/users/" + u.id, { password: pw }); toast("Password updated"); }
catch (e) { toast(e.message, true); }
}

async function deleteUser(u) {
if (!confirm("Delete user \"" + (u.name || u.email) + "\"? They will no longer be able to log in.")) return;
try { await api.del("/api/users/" + u.id); toast("User deleted"); renderTab(); }
catch (e) { toast(e.message, true); }
}
}

/* ============================================================
MEDIA LIBRARY
============================================================ */
async function uploadMediaFiles(files, onProgress) {
const out = [];
for (const file of files) {
if (!file.type.startsWith("image/")) continue;
const fd = new FormData();
fd.append("file", file);
fd.append("label", file.name);
try {
const r = await fetch("/api/media", { method: "POST", body: fd });
const d = await r.json();
if (!r.ok) throw new Error(d.error || "Upload failed");
out.push(d);
} catch (e) { toast(file.name + ": " + e.message, true); }
if (onProgress) onProgress();
}
return out;
}

function mediaDropzone(onDone) {
const input = el("input", { type: "file", accept: "image/*", multiple: "multiple", style: "display:none;" });
const zone = el("div", { class: "media-drop" },
el("div", { class: "media-drop-inner" },
el("strong", {}, "Drop images here"),
el("div", { class: "help" }, "or click to choose files — JPG, PNG, WebP up to 15MB")));
const busy = el("div", { class: "help", style: "margin-top:6px;" }, "");
zone.addEventListener("click", () => input.click());
input.addEventListener("change", async () => {
if (!input.files.length) return;
let n = 0; busy.textContent = "Uploading...";
const res = await uploadMediaFiles([...input.files], () => { busy.textContent = "Uploaded " + (++n) + "..."; });
busy.textContent = "";
input.value = "";
if (res.length) { toast(res.length + " image" + (res.length > 1 ? "s" : "") + " uploaded"); onDone(); }
});
["dragover", "dragenter"].forEach(ev => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add("drag"); }));
["dragleave", "drop"].forEach(ev => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove("drag"); }));
zone.addEventListener("drop", async (e) => {
const files = [...(e.dataTransfer.files || [])];
if (!files.length) return;
let n = 0; busy.textContent = "Uploading...";
const res = await uploadMediaFiles(files, () => { busy.textContent = "Uploaded " + (++n) + "..."; });
busy.textContent = "";
if (res.length) { toast(res.length + " image" + (res.length > 1 ? "s" : "") + " uploaded"); onDone(); }
});
return el("div", {}, zone, input, busy);
}

async function viewMedia(slot) {
slot.appendChild(el("div", { class: "spinner" }, "Loading media..."));
let media = [];
try { media = (await api.get("/api/media")).media; }
catch (e) { slot.innerHTML = ""; slot.appendChild(el("div", { class: "empty" }, e.message)); return; }
slot.innerHTML = "";

slot.appendChild(el("div", { class: "page-title" }, "Media library"));
slot.appendChild(el("div", { class: "page-sub" }, "Upload and manage images. Use 'Choose from library' on any image field across the site to insert them."));

slot.appendChild(mediaDropzone(() => renderTab()));

if (!media.length) { slot.appendChild(el("div", { class: "empty" }, "No images yet. Upload some above.")); return; }

const grid = el("div", { class: "media-grid" });
media.forEach(m => {
const card = el("div", { class: "media-card" },
el("div", { class: "media-thumb", style: "background-image:url('" + m.url + "')" }),
el("div", { class: "media-meta" },
el("div", { class: "media-label", title: m.label || "" }, m.label || m.url),
el("div", { class: "row-actions" },
el("button", { class: "btn btn-sm", onclick: () => { navigator.clipboard.writeText(m.url); toast("URL copied"); } }, "Copy URL"),
el("button", { class: "btn btn-sm btn-danger", onclick: async () => {
if (!confirm("Delete this image? It will disappear anywhere it is used.")) return;
try { await api.del("/api/media/" + m.id); toast("Deleted"); renderTab(); }
catch (e) { toast(e.message, true); }
}}, "Delete"))));
grid.appendChild(card);
});
slot.appendChild(grid);
}

/* ---------- media picker modal (used by image fields) ---------- */
async function openMediaPicker(onPick) {
const overlay = el("div", { class: "modal-overlay" });
const close = () => overlay.remove();
overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });

const body = el("div", { class: "modal-body" }, el("div", { class: "spinner" }, "Loading media..."));
const modal = el("div", { class: "modal" },
el("div", { class: "modal-head" },
el("strong", {}, "Choose an image"),
el("button", { class: "btn btn-sm", onclick: close }, "Close")),
body);
overlay.appendChild(modal);
document.body.appendChild(overlay);

async function load() {
let media = [];
try { media = (await api.get("/api/media")).media; }
catch (e) { body.innerHTML = ""; body.appendChild(el("div", { class: "empty" }, e.message)); return; }
body.innerHTML = "";
body.appendChild(mediaDropzone(load));
if (!media.length) { body.appendChild(el("div", { class: "empty" }, "No images yet — upload above.")); return; }
const grid = el("div", { class: "media-grid" });
media.forEach(m => {
grid.appendChild(el("div", { class: "media-card pickable", onclick: () => { onPick(m.url); close(); } },
el("div", { class: "media-thumb", style: "background-image:url('" + m.url + "')" }),
el("div", { class: "media-meta" }, el("div", { class: "media-label" }, m.label || m.url))));
});
body.appendChild(grid);
}
load();
}

/* ============================================================
REDIRECTS + 404 TRACKER
============================================================ */
async function viewRedirects(slot) {
slot.appendChild(el("div", { class: "spinner" }, "Loading..."));
let notfound = [], redirects = [];
try {
notfound = (await api.get("/api/notfound")).notfound || [];
redirects = (await api.get("/api/redirects")).redirects || [];
} catch (e) { slot.innerHTML = ""; slot.appendChild(el("div", { class: "empty" }, e.message)); return; }
slot.innerHTML = "";

slot.appendChild(el("div", { class: "page-title" }, "Redirects & 404s"));
slot.appendChild(el("div", { class: "page-sub" }, "See which missing pages visitors hit, and send those URLs somewhere useful so no one lands on a dead end."));

/* --- add redirect form (also targeted by 'Create redirect' buttons) --- */
const fromInp = el("input", { type: "text", placeholder: "/old-page" });
const toInp = el("input", { type: "text", placeholder: "/new-page" });
async function saveRedirect(from, to) {
try { await api.post("/api/redirects", { from_path: from, to_path: to }); toast("Redirect saved — live now"); renderTab(); }
catch (e) { toast(e.message, true); }
}
slot.appendChild(el("div", { class: "section-label" }, "Add a redirect"));
slot.appendChild(el("div", { class: "card" },
el("div", { class: "grid-2", style: "gap:10px;" },
el("div", { class: "field" }, el("label", {}, "Old path (what visitors hit)"), fromInp),
el("div", { class: "field" }, el("label", {}, "Send them to"), toInp)),
el("div", { class: "row-actions", style: "margin-top:6px;" },
el("button", { class: "btn btn-gold btn-sm", onclick: () => {
if (!fromInp.value.trim() || !toInp.value.trim()) { toast("Fill in both paths", true); return; }
saveRedirect(fromInp.value.trim(), toInp.value.trim());
}}, "Save redirect")),
el("div", { class: "help" }, "301 (permanent) redirect. Destination can be a path like /services or a full URL.")
));

/* --- existing redirects --- */
slot.appendChild(el("div", { class: "section-label" }, "Active redirects (" + redirects.length + ")"));
if (!redirects.length) slot.appendChild(el("div", { class: "empty" }, "No redirects yet."));
redirects.forEach(r => {
slot.appendChild(el("div", { class: "list-row" },
el("div", { class: "row-main" },
el("h3", { style: "font-size:0.95rem;" }, r.from_path, el("span", { style: "color:var(--muted);" }, "  →  "), el("span", { style: "color:var(--gold);" }, r.to_path))),
el("div", { class: "row-actions" },
el("button", { class: "btn btn-sm btn-danger", onclick: async () => {
if (!confirm("Delete this redirect?")) return;
try { await api.del("/api/redirects/" + r.id); toast("Deleted"); renderTab(); } catch (e) { toast(e.message, true); }
}}, "Delete"))));
});

/* --- 404 log --- */
slot.appendChild(el("div", { class: "section-label", style: "margin-top:28px;" }, "404 errors logged (" + notfound.length + ")"));
if (!notfound.length) {
slot.appendChild(el("div", { class: "empty" }, "No 404s recorded. Nice — every visited URL is resolving."));
} else {
slot.appendChild(el("div", { class: "head-flex" },
el("div", { class: "page-sub" }, "Most-hit first. Click 'Create redirect' to point one at a real page."),
el("button", { class: "btn btn-sm", onclick: async () => {
if (!confirm("Clear the whole 404 log?")) return;
try { await api.del("/api/notfound?all=1"); toast("Log cleared"); renderTab(); } catch (e) { toast(e.message, true); }
}}, "Clear log")));
notfound.forEach(n => {
slot.appendChild(el("div", { class: "list-row" },
el("div", { class: "row-main" },
el("h3", { style: "font-size:0.95rem;" }, n.path, el("span", { class: "pill off", style: "margin-left:10px;" }, n.hits + (n.hits === 1 ? " hit" : " hits"))),
el("div", { class: "meta" }, "Last seen " + (n.last_seen || "") + (n.last_referer ? " · from " + n.last_referer : ""))),
el("div", { class: "row-actions" },
el("button", { class: "btn btn-sm btn-gold", onclick: () => {
fromInp.value = n.path; toInp.value = ""; toInp.focus();
window.scrollTo({ top: 0, behavior: "smooth" });
}}, "Create redirect"),
el("button", { class: "btn btn-sm", onclick: async () => {
try { await api.del("/api/notfound?path=" + encodeURIComponent(n.path)); toast("Dismissed"); renderTab(); } catch (e) { toast(e.message, true); }
}}, "Dismiss"))));
});
}
}

/* ---------- go ---------- */
boot();
})();
