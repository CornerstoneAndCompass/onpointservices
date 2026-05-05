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

  // -------- Form submit --------
  const form = document.querySelector('[data-form="quote"]');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const status = form.querySelector('[data-form-status]');
      if (status) {
        status.textContent = 'Cheers, your message is on its way to Jeff. We will be in touch within one business day.';
        status.style.color = '#F4C518';
      }
      form.reset();
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
