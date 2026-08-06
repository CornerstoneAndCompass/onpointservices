/* ============================================================
   On Point CMS - rich text editor
   A dependency-free WYSIWYG for post bodies and richtext fields,
   plus an importer that turns pasted Markdown / plain text into
   clean HTML. Loaded before admin.js; exposes window.RichText.
   ============================================================ */
(function () {
  "use strict";

  /* ---------- tiny DOM helper (admin.js has its own, inside its IIFE) ---------- */
  function elm(tag, attrs, ...kids) {
    const n = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      if (attrs[k] == null) continue;
      if (k === "class") n.className = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      n.appendChild(typeof kid === "object" ? kid : document.createTextNode(String(kid)));
    }
    return n;
  }

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* Anything that could execute is dropped. Relative paths, http(s), mailto
     and tel all pass; data: only for images. */
  function safeUrl(u) {
    const s = String(u == null ? "" : u).replace(/[\u0000-\u0020]/g, "").trim();
    if (!s) return "";
    if (/^(javascript|vbscript|file|about|blob):/i.test(s)) return "";
    if (/^data:/i.test(s) && !/^data:image\//i.test(s)) return "";
    return s;
  }

  /* ============================================================
     MARKDOWN / PLAIN TEXT  ->  HTML
     ============================================================ */

  /* Inline runs: bold, italic, links, images, code, bare URLs.
     Generated tags are parked as \u0000n\u0000 placeholders so later passes
     can never chew through markup they did not write. */
  function inline(text) {
    const tokens = [];
    const keep = (h) => "\u0000" + (tokens.push(h) - 1) + "\u0000";
    let s = esc(text);

    s = s.replace(/`([^`]+)`/g, (m, c) => keep("<code>" + c + "</code>"));

    // ![alt](src "title"). The title's quotes are already escaped by esc()
    s = s.replace(/!\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\s*\)/g, (m, alt, src) => {
      const u = safeUrl(src);
      return u ? keep('<img src="' + u + '" alt="' + alt + '" loading="lazy" />') : m;
    });

    // [label](href). The label stays in the stream so it still gets bolded
    s = s.replace(/\[([^\]]+)\]\(\s*([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\s*\)/g, (m, label, href) => {
      const u = safeUrl(href);
      if (!u) return label;
      if (label === href) return keep('<a href="' + u + '">' + label + "</a>");
      return keep('<a href="' + u + '">') + label + keep("</a>");
    });

    s = s.replace(/\*\*(\S(?:[\s\S]*?\S)?)\*\*/g, (m, t) => keep("<strong>") + t + keep("</strong>"));
    s = s.replace(/__(\S(?:[\s\S]*?\S)?)__/g, (m, t) => keep("<strong>") + t + keep("</strong>"));
    s = s.replace(/~~(\S(?:[\s\S]*?\S)?)~~/g, (m, t) => keep("<s>") + t + keep("</s>"));
    // every ** is spoken for by now, so a lone * is always italic
    s = s.replace(/\*(\S(?:[^*]*?\S)?)\*/g, (m, t) => keep("<em>") + t + keep("</em>"));
    // _underscores_ need word boundaries or snake_case_names get mangled
    s = s.replace(/(^|[\s(])_(\S(?:[^_]*?\S)?)_(?=$|[\s).,;:!?])/g,
      (m, pre, t) => pre + keep("<em>") + t + keep("</em>"));

    s = s.replace(/(^|[\s(])((?:https?:\/\/|www\.)[^\s<>"')\]]+)/g, (m, pre, url) => {
      let tail = "";
      const punct = url.match(/[.,;:!?]+$/);
      if (punct) { tail = punct[0]; url = url.slice(0, -tail.length); }
      const href = /^www\./i.test(url) ? "https://" + url : url;
      return pre + keep('<a href="' + href + '">' + url + "</a>") + tail;
    });

    return s.replace(/\u0000(\d+)\u0000/g, (m, i) => tokens[+i]);
  }

  const RE_HR = /^\s*([-*_])(?:\s*\1){2,}\s*$/;
  const RE_HEAD = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/;
  const RE_QUOTE = /^\s{0,3}>\s?/;
  const RE_UL = /^(\s*)[-*+]\s+(.+)$/;
  const RE_OL = /^(\s*)\d+[.)]\s+(.+)$/;

  function blocks(lines) {
    const out = [];
    let para = [];
    const flush = () => {
      if (!para.length) return;
      out.push("<p>" + para.map(inline).join("<br />") + "</p>");
      para = [];
    };

    for (let i = 0; i < lines.length; i++) {
      const line = String(lines[i]).replace(/\s+$/, "");
      if (!line.trim()) { flush(); continue; }

      if (RE_HR.test(line)) { flush(); out.push("<hr />"); continue; }

      // Setext heading: a line of ==== underneath the words
      const next = lines[i + 1] == null ? "" : String(lines[i + 1]).trim();
      if (next && /^=+$/.test(next)) {
        flush();
        out.push("<h2>" + inline(line.trim()) + "</h2>");
        i++;
        continue;
      }

      const head = line.match(RE_HEAD);
      if (head) {
        flush();
        // The post title is already the page's H1, so a body "# " starts at h2.
        const tag = "h" + Math.min(6, Math.max(2, head[1].length));
        out.push("<" + tag + ">" + inline(head[2]) + "</" + tag + ">");
        continue;
      }

      if (RE_QUOTE.test(line)) {
        flush();
        const buf = [];
        while (i < lines.length && RE_QUOTE.test(lines[i])) {
          buf.push(String(lines[i]).replace(RE_QUOTE, ""));
          i++;
        }
        i--;
        out.push("<blockquote>" + blocks(buf) + "</blockquote>");
        continue;
      }

      if (RE_UL.test(line) || RE_OL.test(line)) {
        flush();
        const ordered = RE_OL.test(line) && !RE_UL.test(line);
        const re = ordered ? RE_OL : RE_UL;
        const items = [];
        while (i < lines.length) {
          const l = String(lines[i]).replace(/\s+$/, "");
          const m = l.match(re);
          if (m) { items.push([m[2]]); i++; continue; }
          // an indented line is the rest of a wrapped item, not a new block
          if (items.length && /^\s{2,}\S/.test(l)) { items[items.length - 1].push(l.trim()); i++; continue; }
          break;
        }
        i--;
        const tag = ordered ? "ol" : "ul";
        out.push("<" + tag + ">" +
          items.map((p) => "<li>" + p.map(inline).join("<br />") + "</li>").join("") +
          "</" + tag + ">");
        continue;
      }

      para.push(line.replace(/^\s+/, ""));
    }
    flush();
    return out.join("\n");
  }

  function fromMarkdown(src) {
    return blocks(String(src == null ? "" : src).replace(/\r\n?/g, "\n").split("\n"));
  }

  /* Does this string already carry its own markup? */
  function looksLikeHtml(s) {
    return /<(p|div|h[1-6]|ul|ol|li|br|img|blockquote|section|article|figure|table|strong|em|b|i|a)\b[^>]*>/i
      .test(String(s == null ? "" : s));
  }

  /* Markdown wins over a clipboard's HTML flavour when both are present -
     copying from a notes app or a chat window often hands over rendered HTML
     with the ** and ## still sitting in the text. */
  function looksLikeMarkdown(s) {
    const t = String(s == null ? "" : s);
    return /(^|\n)\s{0,3}#{1,6}\s+\S/.test(t) ||
      /\*\*\S[\s\S]*?\S\*\*/.test(t) ||
      /(^|\n)\s*[-*+]\s+\S/.test(t) ||
      /(^|\n)\s*\d+[.)]\s+\S/.test(t) ||
      /(^|\n)\s{0,3}>\s+\S/.test(t) ||
      /\[[^\]]+\]\([^)\s]+\)/.test(t);
  }

  /* ============================================================
     SANITISER
     Everything the editor stores goes through here. Unknown wrappers are
     unwrapped rather than deleted, so nothing a client wrote disappears -
     only the handful of tags that can actually run something are removed.
     ============================================================ */
  const ALLOWED = {
    p: [], br: [], strong: [], em: [], u: [], s: [], sub: [], sup: [],
    h2: [], h3: [], h4: [], h5: [], h6: [],
    ul: [], ol: ["start"], li: [], blockquote: [], hr: [],
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height", "loading"],
    figure: [], figcaption: [], code: [], pre: [],
    table: [], thead: [], tbody: [], tfoot: [], tr: [],
    th: ["colspan", "rowspan"], td: ["colspan", "rowspan"],
    iframe: ["src", "width", "height", "title", "allow", "allowfullscreen", "frameborder", "loading"],
  };
  const RENAME = { b: "strong", i: "em", strike: "s", del: "s", ins: "u", h1: "h2", mark: "strong" };
  const DROP = ["script", "style", "noscript", "object", "embed", "applet", "form",
    "input", "select", "textarea", "button", "link", "meta", "base", "title",
    "svg", "math", "video", "audio", "canvas"];

  function unwrap(n) {
    const parent = n.parentNode;
    const moved = [];
    while (n.firstChild) { const c = n.firstChild; parent.insertBefore(c, n); moved.push(c); }
    n.remove();
    return moved;
  }

  function replaceTag(n, tag) {
    const fresh = n.ownerDocument.createElement(tag);
    while (n.firstChild) fresh.appendChild(n.firstChild);
    n.parentNode.replaceChild(fresh, n);
    return fresh;
  }

  function scrubAttrs(n, allowed) {
    for (const a of [...n.attributes]) {
      const name = a.name.toLowerCase();
      if (name.slice(0, 2) === "on" || allowed.indexOf(name) < 0) { n.removeAttribute(a.name); continue; }
      if (name === "href" || name === "src") {
        const u = safeUrl(a.value);
        if (!u) n.removeAttribute(a.name);
        else n.setAttribute(a.name, u);
      }
    }
    if (n.tagName === "IFRAME" && !/^https?:\/\//i.test(n.getAttribute("src") || "")) n.remove();
    else if (n.tagName === "A" && n.getAttribute("target") === "_blank") n.setAttribute("rel", "noopener");
  }

  function cleanNodes(list) {
    for (const n of list) {
      if (!n.parentNode) continue;
      if (n.nodeType === 8) { n.remove(); continue; }
      if (n.nodeType !== 1) continue;
      let node = n;
      let tag = node.tagName.toLowerCase();
      if (DROP.indexOf(tag) >= 0) { node.remove(); continue; }
      if (RENAME[tag]) { node = replaceTag(node, RENAME[tag]); tag = RENAME[tag]; }
      if (!ALLOWED[tag]) { cleanNodes(unwrap(node)); continue; }
      scrubAttrs(node, ALLOWED[tag]);
      if (!node.parentNode) continue;
      cleanNodes([...node.childNodes]);
    }
  }

  /* House style, set in 7854ecb: no em or en dashes anywhere in site copy.
     Pasted writing is full of them, so they are swapped for the punctuation the
     rest of the site uses. Code samples are left exactly as typed. */
  function deDash(root) {
    const walk = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const hits = [];
    for (let n = walk.nextNode(); n; n = walk.nextNode()) {
      if (n.nodeValue.indexOf("—") < 0 && n.nodeValue.indexOf("–") < 0) continue;
      if (n.parentElement && n.parentElement.closest("code, pre")) continue;
      hits.push(n);
    }
    for (const n of hits) {
      n.nodeValue = n.nodeValue
        .replace(/\s*—\s*/g, ", ")
        .replace(/\s*–\s*/g, "-");
    }
  }

  const BLANKABLE = ["p", "h2", "h3", "h4", "h5", "h6", "li", "blockquote", "figcaption"];

  function dropBlanks(root) {
    for (const n of [...root.querySelectorAll(BLANKABLE.join(","))]) {
      if (n.textContent.trim()) continue;
      if (n.querySelector("img, iframe, hr")) continue;
      n.remove();
    }
    // a link the sanitiser stripped the href from is just text now
    for (const a of [...root.querySelectorAll("a:not([href])")]) unwrap(a);
  }

  const BLOCK_TAGS = "p|h2|h3|h4|h5|h6|ul|ol|blockquote|hr|figure|figcaption|pre|table|thead|tbody|tfoot|tr";

  /* One block-level tag per line, so the Source view stays readable. Only
     whitespace touching a block tag is collapsed - never a gap between words. */
  function tidy(html) {
    return String(html)
      .replace(new RegExp("\\s*<(" + BLOCK_TAGS + ")(\\s|>|/)", "gi"), "\n<$1$2")
      .replace(new RegExp("</(" + BLOCK_TAGS + ")>\\s*", "gi"), "</$1>\n")
      .replace(/\s*<li(\s|>)/gi, "\n  <li$1")
      .replace(/\n{2,}/g, "\n")
      .trim();
  }

  function sanitize(html) {
    const src = String(html == null ? "" : html);
    if (!src.trim()) return "";
    const doc = new DOMParser().parseFromString("<body>" + src + "</body>", "text/html");
    cleanNodes([...doc.body.childNodes]);
    deDash(doc.body);
    dropBlanks(doc.body);
    return tidy(doc.body.innerHTML);
  }

  /* Clipboard -> HTML. A single line with no block markers comes back as
     inline HTML so it drops into the paragraph the cursor is already in. */
  function fromClipboard(text) {
    const t = String(text == null ? "" : text).replace(/\r\n?/g, "\n");
    if (!t.trim()) return "";
    const oneLine = t.indexOf("\n") < 0;
    if (oneLine && !RE_HEAD.test(t) && !RE_UL.test(t) && !RE_OL.test(t) && !RE_QUOTE.test(t) && !RE_HR.test(t)) {
      return inline(t);
    }
    return fromMarkdown(t);
  }

  /* ============================================================
     EDITOR
     ============================================================ */
  let docReady = false;
  function prepDoc() {
    if (docReady) return;
    docReady = true;
    try { document.execCommand("defaultParagraphSeparator", false, "p"); } catch (e) {}
  }

  // One selectionchange listener for every editor on screen; detached ones
  // fall off the list instead of piling up as the admin re-renders views.
  const live = [];
  document.addEventListener("selectionchange", () => {
    for (let i = live.length - 1; i >= 0; i--) {
      if (!live[i].area.isConnected) live.splice(i, 1);
      else live[i].sync();
    }
  });

  function create(opts) {
    opts = opts || {};
    prepDoc();

    const area = elm("div", { class: "rte-area", contenteditable: "true", spellcheck: "true" });
    const source = elm("textarea", { class: "rte-source hidden", spellcheck: "false" });
    const counter = elm("span", { class: "rte-count" });
    const bar = elm("div", { class: "rte-bar" });
    const wrap = elm("div", { class: "rte" }, bar, area, source,
      elm("div", { class: "rte-foot" }, counter,
        elm("span", {}, "Paste anything - Word, a website, or plain text with **bold** and ## headings - and it is tidied up for you.")));

    let sourceOn = false;
    let timer = null;

    /* ---- value in / out ---- */
    function getValue() {
      return sanitize(sourceOn ? source.value : area.innerHTML);
    }
    function setValue(html) {
      const clean = sanitize(html);
      area.innerHTML = clean || "<p><br /></p>";
      if (sourceOn) source.value = clean;
      count();
    }
    function count() {
      const words = String(area.innerText || area.textContent || "").trim().split(/\s+/).filter(Boolean).length;
      counter.textContent = words + (words === 1 ? " word" : " words");
    }
    function changed(now) {
      count();
      if (!opts.onChange) return;
      clearTimeout(timer);
      if (now) opts.onChange(getValue());
      else timer = setTimeout(() => opts.onChange(getValue()), 250);
    }
    function flush() { clearTimeout(timer); if (opts.onChange) opts.onChange(getValue()); }

    /* ---- commands ---- */
    function exec(cmd, val) {
      area.focus();
      try { document.execCommand("styleWithCSS", false, false); } catch (e) {}
      try { document.execCommand(cmd, false, val == null ? null : val); } catch (e) {}
      changed(true);
      sync();
    }

    function blockName() {
      const sel = window.getSelection();
      let n = sel && sel.anchorNode;
      while (n && n !== area) {
        if (n.nodeType === 1) {
          const t = n.tagName.toLowerCase();
          if (t === "blockquote" || t === "p" || /^h[2-6]$/.test(t)) return t;
        }
        n = n.parentNode;
      }
      return "p";
    }
    function closestTag(tag) {
      const sel = window.getSelection();
      let n = sel && sel.anchorNode;
      while (n && n !== area) {
        if (n.nodeType === 1 && n.tagName.toLowerCase() === tag) return n;
        n = n.parentNode;
      }
      return null;
    }

    // The media picker is a modal, so the caret has to be put back by hand.
    let saved = null;
    function saveRange() {
      const sel = window.getSelection();
      if (sel && sel.rangeCount && area.contains(sel.anchorNode)) saved = sel.getRangeAt(0).cloneRange();
    }
    function restoreRange() {
      if (!saved) { area.focus(); return; }
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(saved);
      area.focus();
    }

    function doLink() {
      const current = closestTag("a");
      const sel = window.getSelection();
      const collapsed = !current && (!sel || sel.isCollapsed);
      const typed = prompt("Link address (https://... or /contact):", current ? current.getAttribute("href") : "https://");
      if (typed === null) return;
      if (!typed.trim()) { exec("unlink"); return; }
      const url = safeUrl(typed.trim());
      if (!url) { alert("That link address cannot be used."); return; }
      if (collapsed) exec("insertHTML", '<a href="' + esc(url) + '">' + esc(typed.trim()) + "</a>");
      else exec("createLink", url);
    }

    function refit() {
      const html = fromMarkdown(area.innerText || area.textContent || "");
      setValue(html);
      changed(true);
    }

    function toggleSource(btnEl) {
      if (sourceOn) setValue(source.value);
      else source.value = getValue();
      sourceOn = !sourceOn;
      area.classList.toggle("hidden", sourceOn);
      source.classList.toggle("hidden", !sourceOn);
      btnEl.classList.toggle("on", sourceOn);
      bar.classList.toggle("rte-bar-dim", sourceOn);
      (sourceOn ? source : area).focus();
    }

    /* ---- toolbar ---- */
    function btn(label, title, run, cls) {
      const b = elm("button", { type: "button", class: "rte-btn" + (cls ? " " + cls : ""), title: title }, label);
      b.addEventListener("mousedown", (e) => { e.preventDefault(); run(b); });
      return b;
    }
    function sep() { return elm("span", { class: "rte-sep" }); }

    const blockBtns = {
      p: btn("Text", "Normal paragraph", () => exec("formatBlock", "<p>")),
      h2: btn("H2", "Section heading", () => exec("formatBlock", "<h2>")),
      h3: btn("H3", "Sub heading", () => exec("formatBlock", "<h3>")),
      blockquote: btn("Quote", "Pull quote", () => exec("formatBlock", "<blockquote>")),
    };
    const boldBtn = btn("B", "Bold (Ctrl/Cmd + B)", () => exec("bold"), "rte-b");
    const italBtn = btn("I", "Italic (Ctrl/Cmd + I)", () => exec("italic"), "rte-i");
    const ulBtn = btn("List", "Bulleted list", () => exec("insertUnorderedList"));
    const olBtn = btn("1. List", "Numbered list", () => exec("insertOrderedList"));

    bar.appendChild(blockBtns.p);
    bar.appendChild(blockBtns.h2);
    bar.appendChild(blockBtns.h3);
    bar.appendChild(blockBtns.blockquote);
    bar.appendChild(sep());
    bar.appendChild(boldBtn);
    bar.appendChild(italBtn);
    bar.appendChild(btn("Link", "Add or edit a link (Ctrl/Cmd + K)", doLink));
    bar.appendChild(btn("Unlink", "Remove the link", () => exec("unlink")));
    bar.appendChild(sep());
    bar.appendChild(ulBtn);
    bar.appendChild(olBtn);
    bar.appendChild(sep());
    if (opts.onPickImage) {
      bar.appendChild(btn("Image", "Insert an image from the media library", () => {
        saveRange();
        opts.onPickImage((url) => {
          restoreRange();
          exec("insertHTML", '<img src="' + esc(safeUrl(url)) + '" alt="" loading="lazy" />');
        });
      }));
    }
    bar.appendChild(btn("Line", "Insert a divider", () => exec("insertHorizontalRule")));
    bar.appendChild(btn("Clear", "Strip formatting from the selected text", () => exec("removeFormat")));
    bar.appendChild(elm("span", { class: "rte-spacer" }));
    bar.appendChild(btn("Reformat", "Read the whole thing as plain text and rebuild the headings, bold and lists", () => {
      if (!String(area.innerText || "").trim()) return;
      if (!confirm("Rebuild the layout from the text?\n\n** ## and - written in the text become real bold, headings and lists. Formatting you added by hand is replaced.")) return;
      refit();
    }));
    bar.appendChild(btn("Source", "Show the underlying HTML", (b) => toggleSource(b)));

    function sync() {
      if (sourceOn) return;
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount || !area.contains(sel.anchorNode)) return;
      let bold = false, ital = false, ul = false, ol = false;
      try {
        bold = document.queryCommandState("bold");
        ital = document.queryCommandState("italic");
        ul = document.queryCommandState("insertUnorderedList");
        ol = document.queryCommandState("insertOrderedList");
      } catch (e) {}
      boldBtn.classList.toggle("on", bold);
      italBtn.classList.toggle("on", ital);
      ulBtn.classList.toggle("on", ul);
      olBtn.classList.toggle("on", ol);
      const block = blockName();
      for (const k in blockBtns) blockBtns[k].classList.toggle("on", k === block);
    }

    /* ---- typing, pasting ---- */
    area.addEventListener("input", () => changed());
    area.addEventListener("blur", () => changed(true));
    source.addEventListener("input", () => changed());
    source.addEventListener("blur", () => changed(true));

    area.addEventListener("keydown", (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const k = String(e.key || "").toLowerCase();
      if (k === "b") { e.preventDefault(); exec("bold"); }
      else if (k === "i") { e.preventDefault(); exec("italic"); }
      else if (k === "k") { e.preventDefault(); doLink(); }
    });

    area.addEventListener("paste", (e) => {
      const dt = e.clipboardData;
      if (!dt) return;
      const text = dt.getData("text/plain");
      const html = dt.getData("text/html");
      let insert = "";
      if (text && looksLikeMarkdown(text)) insert = fromClipboard(text);
      else if (html && html.trim()) insert = sanitize(html);
      else if (text) insert = fromClipboard(text);
      if (!insert) return;
      e.preventDefault();
      exec("insertHTML", insert);
    });

    // Dropping text in bypasses paste, and dropped HTML is unfiltered.
    area.addEventListener("drop", (e) => {
      const dt = e.dataTransfer;
      if (!dt) return;
      const text = dt.getData("text/plain");
      if (!text) return;
      e.preventDefault();
      exec("insertHTML", fromClipboard(text));
    });

    setValue(opts.value || "");
    live.push({ area: area, sync: sync, flush: flush });

    return { el: wrap, area: area, getValue: getValue, setValue: setValue, flush: flush };
  }

  /* Belt and braces before a save: push every open editor's current value
     through its onChange, in case a debounce is still pending. */
  function flushAll() {
    for (const ed of live) if (ed.area.isConnected && ed.flush) ed.flush();
  }

  window.RichText = {
    create: create,
    fromMarkdown: fromMarkdown,
    fromClipboard: fromClipboard,
    sanitize: sanitize,
    looksLikeHtml: looksLikeHtml,
    looksLikeMarkdown: looksLikeMarkdown,
    flushAll: flushAll,
  };
})();
