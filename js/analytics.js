/* ============================================================
   On Point Services - first-party analytics
   Anonymous ids, no cookies, Do-Not-Track honoured. Events batch
   and flush to /api/track via sendBeacon so nothing blocks the page.
   ============================================================ */
(function () {
  "use strict";

  var VID = "op_vid";
  var SID = "op_sid";
  var SID_TTL = 30 * 60 * 1000;   // 30 idle minutes starts a new visit
  var FLUSH_MS = 4000;
  var MAX_QUEUE = 10;

  function uuid() {
    try { return crypto.randomUUID(); }
    catch (e) { return Math.random().toString(36).slice(2) + Date.now().toString(36); }
  }

  function dnt() {
    return navigator.doNotTrack === "1" || navigator.doNotTrack === "yes" ||
      window.doNotTrack === "1" || navigator.msDoNotTrack === "1";
  }
  function framed() {
    try { return window.self !== window.top; } catch (e) { return true; }
  }
  // The CMS is not the website. Staff clicking around must never look like traffic.
  function excluded() {
    return location.pathname.indexOf("/admin") === 0;
  }
  function on() {
    return !dnt() && !framed() && !excluded();
  }

  function visitorId() {
    var v = null;
    try { v = localStorage.getItem(VID); } catch (e) {}
    if (!v) {
      v = uuid();
      try { localStorage.setItem(VID, v); } catch (e) {}
    }
    return v;
  }

  function session() {
    var now = Date.now();
    try {
      var p = JSON.parse(sessionStorage.getItem(SID) || "null");
      if (p && p.id && now - p.t <= SID_TTL) {
        sessionStorage.setItem(SID, JSON.stringify({ id: p.id, t: now, entry: p.entry }));
        return p;
      }
    } catch (e) {}
    var s = { id: uuid(), t: now, entry: false };
    try { sessionStorage.setItem(SID, JSON.stringify(s)); } catch (e) {}
    return s;
  }
  function markEntrySent(id) {
    try { sessionStorage.setItem(SID, JSON.stringify({ id: id, t: Date.now(), entry: true })); } catch (e) {}
  }

  /* ---------- queue ---------- */
  var queue = [];
  var timer = null;

  function scheduleFlush() {
    if (timer !== null) return;
    timer = setTimeout(function () { timer = null; flush(false); }, FLUSH_MS);
  }

  /* Referrer and utm ride on the first event of a visit, whatever type it is.
     A pageview only commits on exit, so a visit that opens with a phone tap
     would otherwise lose where the visitor came from. */
  function withEntry(e) {
    var s = session();
    if (s.entry) return e;
    var q = new URLSearchParams(location.search);
    e.entry = true;
    if (!e.path) e.path = location.pathname;
    if (document.referrer) e.ref = document.referrer;
    var utm = {
      source: q.get("utm_source") || undefined,
      medium: q.get("utm_medium") || undefined,
      campaign: q.get("utm_campaign") || undefined
    };
    if (utm.source || utm.medium || utm.campaign) e.utm = utm;
    if (q.get("gclid")) e.utm = { source: "google", medium: "cpc", campaign: q.get("utm_campaign") || undefined };
    markEntrySent(s.id);
    return e;
  }

  function enqueue(e) {
    if (!on()) return;
    queue.push(withEntry(e));
    if (queue.length >= MAX_QUEUE) flush(false);
    else scheduleFlush();
  }

  function flush(beacon) {
    if (timer !== null) { clearTimeout(timer); timer = null; }
    if (!on() || !queue.length) return;
    var body = JSON.stringify({ visitor: visitorId(), session: session().id, events: queue });
    queue = [];
    try {
      if (beacon && navigator.sendBeacon) {
        navigator.sendBeacon("/api/track", new Blob([body], { type: "application/json" }));
      } else {
        fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: body,
          keepalive: true
        }).catch(function () {});
      }
    } catch (e) {}
  }

  function track(type, props) {
    var e = { type: type };
    if (props) for (var k in props) if (props[k] != null) e[k] = props[k];
    if (!e.path) e.path = location.pathname;
    enqueue(e);
  }

  /* ---------- pageview + dwell ---------- */
  var landed = Date.now();
  var hidden = 0;
  var hiddenAt = null;

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") hiddenAt = Date.now();
    else if (hiddenAt) { hidden += Date.now() - hiddenAt; hiddenAt = null; }
  });

  // Engaged time, not wall-clock: a tab left open in the background is not reading.
  function engagedMs() {
    var away = hidden + (hiddenAt ? Date.now() - hiddenAt : 0);
    return Math.max(0, Date.now() - landed - away);
  }

  /* ---------- scroll depth ---------- */
  var deepest = 0;
  var sentDepths = {};

  function onScroll() {
    var doc = document.documentElement;
    var scrollable = doc.scrollHeight - window.innerHeight;
    var pct = scrollable <= 0 ? 100 : Math.round(((window.scrollY || 0) / scrollable) * 100);
    if (pct > deepest) deepest = Math.min(100, pct);
    var buckets = [25, 50, 75, 100];
    for (var i = 0; i < buckets.length; i++) {
      var b = buckets[i];
      if (deepest >= b && !sentDepths[b]) {
        sentDepths[b] = 1;
        track("scroll", { value: { depth: b } });
      }
    }
  }

  /* ---------- conversions ---------- */
  // Delegated so it keeps working for markup the CMS renders later.
  document.addEventListener("click", function (ev) {
    var a = ev.target && ev.target.closest ? ev.target.closest("a, button") : null;
    if (!a) return;
    var href = (a.getAttribute("href") || "").trim();
    var label = (a.textContent || "").trim().slice(0, 60);

    if (href.indexOf("tel:") === 0) {
      track("phone_click", { value: { label: label, href: href.slice(0, 40) } });
      flush(false);
      return;
    }
    if (href.indexOf("mailto:") === 0) {
      track("email_click", { value: { label: label } });
      return;
    }
    if (/facebook\.com|instagram\.com/i.test(href)) {
      track("social_click", { value: { label: label, href: href.slice(0, 120) } });
      return;
    }
    if (/^https?:\/\//i.test(href)) {
      var host = "";
      try { host = new URL(href, location.href).host; } catch (e) {}
      if (host && host !== location.host) {
        track("outbound", { value: { href: href.slice(0, 160) } });
        return;
      }
    }
    // Quote intent: the buttons that lead to the enquiry form.
    if (/quote|contact|enquir|get in touch|free site/i.test(label) || href === "/contact") {
      track("quote_cta", { value: { label: label } });
    }
  }, true);

  // main.js fires this once the enquiry has actually been accepted, so a failed
  // send is never counted as a lead.
  document.addEventListener("op:enquiry", function () {
    track("enquiry_submit");
    flush(true); // the form navigates to /thank-you next, so this must use a beacon
  });

  /* ---------- go ---------- */
  if (on()) {
    // The pageview lands immediately so the live view is actually live. Time on
    // page can only be known at the end, so it rides a separate `dwell` event
    // rather than a second pageview that would double the count.
    track("pageview");
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    window.addEventListener("pagehide", function () {
      track("dwell", { dwell: engagedMs() });
      flush(true);
    });
  }

  // Small public hook so other scripts can record something meaningful.
  window.opTrack = track;
})();
