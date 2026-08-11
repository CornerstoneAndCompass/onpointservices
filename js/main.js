// On Point Services Ltd - Main JS
(function () {
  'use strict';

  // -------- Sticky nav state --------
  const nav = document.querySelector('.nav');
  if (nav) {
    let lastY = 0;
    const updateNav = () => {
      const y = window.scrollY;
      nav.classList.toggle('scrolled', y > 60);
      lastY = y;
    };
    window.addEventListener('scroll', updateNav, { passive: true });
    updateNav();
  }

  // -------- Mobile nav toggle --------
  const toggle = document.querySelector('.nav-toggle');
  const navMobile = document.querySelector('.nav-mobile');
  if (toggle && navMobile) {
    toggle.addEventListener('click', () => {
      const open = navMobile.classList.toggle('open');
      toggle.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', open);
    });
    // Close on link click
    navMobile.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        navMobile.classList.remove('open');
        toggle.classList.remove('open');
      });
    });
  }

  // -------- Reveal on scroll --------
  const reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('visible');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.12 });
    reveals.forEach(el => io.observe(el));
  } else {
    reveals.forEach(el => el.classList.add('visible'));
  }

  // -------- Stat counter --------
  const stats = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && stats.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const el = e.target;
          const target = parseFloat(el.dataset.count);
          const dur = 1400;
          const start = performance.now();
          const tick = (now) => {
            const t = Math.min(1, (now - start) / dur);
            const eased = 1 - Math.pow(1 - t, 3);
            const val = target * eased;
            el.textContent = Number.isInteger(target) ? Math.round(val) : val.toFixed(1);
            if (t < 1) requestAnimationFrame(tick);
            else el.textContent = target;
          };
          requestAnimationFrame(tick);
          io.unobserve(el);
        }
      });
    }, { threshold: 0.4 });
    stats.forEach(s => io.observe(s));
  }

  // -------- Project filter --------
  const filterBtns = document.querySelectorAll('[data-filter]');
  const projects = document.querySelectorAll('[data-tags]');
  if (filterBtns.length && projects.length) {
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const f = btn.dataset.filter;
        filterBtns.forEach(b => b.classList.toggle('active', b === btn));
        projects.forEach(p => {
          const tags = p.dataset.tags.split(' ');
          const show = f === 'all' || tags.includes(f);
          p.style.display = show ? '' : 'none';
        });
      });
    });
  }

  // -------- Form submit (sends to the CMS enquiries inbox) --------
  const form = document.querySelector('[data-form="quote"]');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const status = form.querySelector('[data-form-status]');
      const btn = form.querySelector('button[type="submit"], button:not([type])');
      const val = (n) => { const el = form.querySelector('[name="' + n + '"]'); return el ? el.value.trim() : ''; };
      const checked = (n) => [...form.querySelectorAll('[name="' + n + '"]:checked')].map(el => el.value);

      const name = val('name');
      const email = val('email');
      const phone = val('phone');
      if (!name || (!email && !phone)) {
        if (status) { status.textContent = 'Please add your name and a phone or email so Jeff can reply.'; status.style.color = '#ff6b6b'; }
        return;
      }

      // Build a readable message from the detailed quote fields
      const lines = [];
      if (val('address')) lines.push('Location: ' + val('address'));
      const ptype = (form.querySelector('[name="ptype"]:checked') || {}).value;
      if (ptype) lines.push('Property type: ' + ptype);
      const services = checked('services');
      if (services.length) lines.push('Services: ' + services.join(', '));
      if (val('timing')) lines.push('Timing: ' + val('timing'));
      if (val('budget')) lines.push('Budget: ' + val('budget'));
      if (val('brief')) lines.push('\n' + val('brief'));
      const message = lines.join('\n');

      if (btn) { btn.disabled = true; }
      if (status) { status.textContent = 'Sending...'; status.style.color = '#9aa'; }
      try {
        const res = await fetch('/api/enquiry', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name, email, phone, message, source: 'Quote form: ' + location.pathname })
        });
        if (!res.ok) throw new Error('bad response');
        // Sent. Hand off to the thank-you page, which is what fires the ad
        // conversion events. Reset first so hitting Back does not restore the
        // filled form and invite a duplicate send. The button stays disabled
        // while the browser navigates away.
        form.reset();
        // Count the lead only now that the server has accepted it. analytics.js
        // beacons it out, which survives the navigation below.
        document.dispatchEvent(new CustomEvent('op:enquiry'));
        window.location.assign('/thank-you');
      } catch (err) {
        if (status) {
          status.innerHTML = 'Sorry, that did not send. Please call Jeff on <a href="tel:+64212255533" style="color:#F4C518">021 225 5533</a> or email <a href="mailto:jeff@onpointservices.co.nz" style="color:#F4C518">jeff@onpointservices.co.nz</a>.';
          status.style.color = '#ff6b6b';
        }
        if (btn) { btn.disabled = false; }
      }
    });
  }

  // -------- Year in footer --------
  const yearEl = document.querySelector('[data-year]');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // -------- Marquee duplicator --------
  document.querySelectorAll('.marquee-track').forEach(track => {
    if (track.dataset.dup === 'true') return;
    track.innerHTML = track.innerHTML + track.innerHTML;
    track.dataset.dup = 'true';
  });

})();
