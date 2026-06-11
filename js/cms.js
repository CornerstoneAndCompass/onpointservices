/* ============================================================
   On Point CMS — settings injector
   Fetches /api/settings once on page-load and applies CMS
   values to the nav, footer and any data-cms elements.
   Fails silently — static HTML is always the fallback.
   ============================================================ */
(function () {
  'use strict';

  fetch('/api/settings', { credentials: 'include' })
    .then(function (r) { return r.json(); })
    .then(function (d) { inject(d.settings || {}); })
    .catch(function () {});

  function inject(s) {

    /* ── Logo ──────────────────────────────────────────── */
    if (s.logo_url) {
      each('img.logo-mark', function (img) { img.src = s.logo_url; });
    }

    /* ── Phone href ────────────────────────────────────── */
    var raw = s.phone_href ? s.phone_href.replace(/[\s\-()]/g, '') : '';
    if (raw) {
      var href = 'tel:' + raw;
      each('a[href^="tel:"]', function (a) { a.href = href; });
    }

    /* ── Nav CTA label ─────────────────────────────────── */
    if (s.nav_cta_label) {
      each('a.nav-cta', function (a) {
        // Replace the trailing text node (after the SVG icon)
        var nodes = a.childNodes;
        for (var i = nodes.length - 1; i >= 0; i--) {
          if (nodes[i].nodeType === 3) {
            nodes[i].textContent = '\n      ' + s.nav_cta_label + '\n    ';
            break;
          }
        }
      });
    }

    /* ── Footer phone text ─────────────────────────────── */
    if (s.phone) {
      each('.footer-contact-row a[href^="tel:"]', function (a) {
        a.textContent = s.phone;
      });
    }

    /* ── Email ─────────────────────────────────────────── */
    if (s.email) {
      each('a[href^="mailto:"]', function (a) {
        a.href = 'mailto:' + s.email;
        a.textContent = s.email;
      });
    }

    /* ── Social ────────────────────────────────────────── */
    if (s.facebook_url) {
      each('a[href*="facebook.com"]', function (a) { a.href = s.facebook_url; });
    }
    if (s.instagram_url) {
      each('a[href*="instagram.com"]', function (a) { a.href = s.instagram_url; });
    }

    /* ── Footer tagline ────────────────────────────────── */
    if (s.footer_tagline) {
      each('.footer-tagline', function (el) { el.textContent = s.footer_tagline; });
    }

    /* ── Generic data-cms text targets ────────────────── */
    var textKeys = ['footer_address', 'footer_service_area', 'business_name'];
    textKeys.forEach(function (k) {
      if (s[k]) {
        each('[data-cms="' + k + '"]', function (el) { el.textContent = s[k]; });
      }
    });
  }

  function each(sel, fn) {
    try { document.querySelectorAll(sel).forEach(fn); } catch (e) {}
  }

})();
