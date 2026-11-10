/* Zrish — страница: Lenis, раскладка секций (по ней scene.js ставит 3D-ключи), появление текста
   по прогрессу секции, цифры-«перебор», выбор отделки, шкала справа, прелоадер.
   Общий объект — window.ZRISH: state (общее состояние), ranges (секции), PALETTES. */
(() => {
  const Z = (window.ZRISH = window.ZRISH || {});
  const S = (Z.state = Object.assign(Z.state || {}, { intro: 0, mx: 0, my: 0, vel: 0, y: 0, colorIdx: 0 }));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // первая отделка — основная: в ней телефон идёт по всей странице, остальные — в секции цветов
  Z.PALETTES = [
    { name: 'Frost', note: 'Frost — bright silver glass that takes on whatever light is in the room.',
      glass: '#e8e7e3', plateau: '#e0dfdb', frame: '#cfcfcb', ring: '#dcdcd8',
      bgHi: '#f3f4f6', bgMid: '#4a4d53', bgLo: '#0c0d0f', accent: '#ffffff', glow: '#d3e2ff' },
    { name: 'Glacier', note: 'Glacier — the blue of ice at four in the morning. Cold to the eye, warm in the hand.',
      glass: '#9eacbf', plateau: '#94a3b8', frame: '#8495ab', ring: '#97a7bb',
      bgHi: '#a9cbff', bgMid: '#2d5aa6', bgLo: '#0b1934', accent: '#bcd8ff', glow: '#3f8cff' },
    { name: 'Rosé', note: 'Rosé — dusk pink set into frosted glass, with a titanium band to match.',
      glass: '#e3c9c2', plateau: '#dcc0b8', frame: '#c9a197', ring: '#d6b0a6',
      bgHi: '#f7b3c8', bgMid: '#c35a7c', bgLo: '#3b1123', accent: '#ffc3d5', glow: '#ff5c8e' },
    { name: 'Obsidian', note: 'Obsidian — near-black glass and dark titanium, for nights without a moon.',
      glass: '#38393c', plateau: '#2f3033', frame: '#46474a', ring: '#505154',
      bgHi: '#ff9b63', bgMid: '#3b1f15', bgLo: '#0b0605', accent: '#ffab73', glow: '#ff5a1f' },
  ];
  // где в секции #colors каждая отделка стоит целиком (те же точки — в ключах scene.js)
  Z.COLOR_P = [0.12, 0.38, 0.62, 0.86];

  // ---- заголовки — по буквам: каждая поднимается из-под строки с поворотом; слова не рвутся ----
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  document.querySelectorAll('[data-split]').forEach((el) => {
    let i = 0;
    const label = document.createElement('div');
    label.innerHTML = el.innerHTML.replace(/<br\s*\/?>/gi, ' ');
    el.setAttribute('aria-label', label.textContent.replace(/\s+/g, ' ').trim());
    const chars = (t) => [...t].map((ch) => `<span class="c" style="--i:${i++}">${esc(ch)}</span>`).join('');
    const word = (html) => `<span class="w" aria-hidden="true">${html}</span>`;
    el.innerHTML = el.innerHTML.split(/<br\s*\/?>/i).map((line) => {
      const box = document.createElement('div');
      box.innerHTML = line;
      const out = [];
      box.childNodes.forEach((n) => {
        if (n.nodeType === 3) n.textContent.split(/\s+/).filter(Boolean).forEach((w) => out.push(word(chars(w))));
        else { n.innerHTML = chars(n.textContent); out.push(word(n.outerHTML)); }
      });
      return out.join(' ');
    }).join('<br>');
  });
  document.querySelectorAll('.mega').forEach((m) => [...m.children].forEach((s, i) => s.style.setProperty('--i', i)));

  // ---- выноски: длина и угол линии постоянные, точку двигает scene.js ----
  document.querySelectorAll('.co').forEach((el) => {
    const dx = +el.dataset.dx, dy = +el.dataset.dy;
    el.style.setProperty('--dx', `${dx}px`);
    el.style.setProperty('--dy', `${dy}px`);
    el.style.setProperty('--len', `${Math.hypot(dx, dy)}px`);
    el.style.setProperty('--ang', `${Math.atan2(dy, dx)}rad`);
    el.classList.toggle('co--l', dx < 0);
  });

  // ---- раскладка секций ----
  const secs = [...document.querySelectorAll('main > section')];
  Z.ranges = {};
  function layout() {
    for (const el of secs) {
      const top = el.getBoundingClientRect().top + window.scrollY, h = el.offsetHeight;
      const pin = el.querySelector('.pin');
      Z.ranges[el.id] = { start: top, len: pin ? Math.max(1, h - pin.offsetHeight) : h, end: top + h };
    }
    Z.layoutId = (Z.layoutId || 0) + 1;
  }
  layout();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(layout, 120); });
  addEventListener('load', layout);
  document.fonts && document.fonts.ready.then(layout);
  Z.progress = (id, y = S.y) => { const R = Z.ranges[id]; return R ? (y - R.start) / R.len : 0; };

  // ---- появление по прогрессу секции ----
  const items = [...document.querySelectorAll('[data-in]')].map((el) => ({
    el,
    sec: el.dataset.sec || el.closest('section').id,
    a: +el.dataset.in,
    b: +el.dataset.out,
    num: el.querySelector('.num[data-count]'),
    on: false,
  }));
  function scramble(el) {
    const target = el.dataset.count, t0 = performance.now(), dur = reduce ? 1 : 1400;
    cancelAnimationFrame(el._raf);
    const step = (now) => {
      const t = (now - t0) / dur, tick = Math.floor(now / 60);
      let out = '';
      for (let i = 0; i < target.length; i++) {
        const ch = target[i];
        if (!/\d/.test(ch)) { out += ch; continue; }
        out += t >= 0.3 + (i / target.length) * 0.6 ? ch : String((tick * 7 + i * 3 + ((tick * (i + 5)) % 11)) % 10);
      }
      el.textContent = out;
      if (t < 1) el._raf = requestAnimationFrame(step);
      else el.textContent = target;
    };
    el._raf = requestAnimationFrame(step);
  }
  function reveals(y) {
    for (const it of items) {
      const p = Z.progress(it.sec, y), on = p >= it.a && p < it.b;
      if (on === it.on) continue;
      it.on = on;
      it.el.classList.toggle('on', on);
      if (on && it.num) scramble(it.num);
    }
  }

  // ---- шкала справа и подсветка пунктов меню ----
  const rail = [...document.querySelectorAll('.rail i')];
  const navs = [...document.querySelectorAll('.bar__nav a')];
  let railIdx = -1;
  function railUpdate(y) {
    const mid = y + innerHeight * 0.5;
    let idx = 0;
    secs.forEach((el, i) => { if (Z.ranges[el.id].start <= mid) idx = i; });
    if (idx === railIdx) return;
    railIdx = idx;
    rail.forEach((d, i) => d.classList.toggle('on', i === idx));
    const id = secs[idx].id;
    navs.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${id}`));
  }

  // ---- отделка: имя и пояснение следуют за телефоном ----
  const colorNames = [...document.querySelectorAll('.js-color')];
  const colorNote = document.querySelector('.js-color-note');
  const sws = [...document.querySelectorAll('.sw')];
  let shownIdx = -1;
  function colorUpdate() {
    const idx = S.colorIdx | 0;
    if (idx === shownIdx) return;
    shownIdx = idx;
    const pal = Z.PALETTES[idx];
    colorNames.forEach((el) => {
      el.animate([{ opacity: 0, transform: 'translateY(60%)' }, { opacity: 1, transform: 'none' }], { duration: 450, easing: 'cubic-bezier(.2,.8,.2,1)' });
      el.textContent = pal.name;
    });
    if (colorNote) colorNote.textContent = pal.note;
    sws.forEach((b, i) => { b.classList.toggle('on', i === idx); b.setAttribute('aria-pressed', i === idx); });
  }

  // ---- скролл ----
  const lenis = !reduce && window.Lenis ? new Lenis({ lerp: 0.09, wheelMultiplier: 0.9, touchMultiplier: 1.3 }) : null;
  Z.lenis = lenis;
  if (lenis) lenis.on('scroll', (e) => { S.vel = e.velocity; });
  const goTo = (y, duration = 1.6) => {
    if (lenis) lenis.scrollTo(y, { duration, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
  };
  document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href').slice(1), R = Z.ranges[id];
    if (!R && id !== 'top') return;
    e.preventDefault();
    goTo(id === 'top' ? 0 : R.start + (+a.dataset.go || 0) * R.len, id === 'top' ? 2.2 : 1.6);
  }));
  sws.forEach((b, i) => b.addEventListener('click', () => {
    const R = Z.ranges.colors;
    goTo(R.start + Z.COLOR_P[i] * R.len, 1.3);
  }));

  if (matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', (e) => {
      S.mx = (e.clientX / innerWidth) * 2 - 1;
      S.my = (e.clientY / innerHeight) * 2 - 1;
    }, { passive: true });
  }

  // первая прокрутка: насколько ушёл первый экран (0…1) — по нему CSS разводит буквы ULTRA
  const heroEl = document.getElementById('hero');
  let hpShown = -1;
  // и доля всей прокрутки — ряды ёлок по ней сдвигаются с разной скоростью
  const pinesEl = document.getElementById('pines');
  let ppShown = -1;

  function frame(t) {
    if (lenis) lenis.raf(t * 1000);
    else S.vel = 0;
    S.y = window.scrollY;
    const hp = Math.round(Math.min(1, S.y / innerHeight) * 1000) / 1000;
    if (hp !== hpShown) { hpShown = hp; heroEl.style.setProperty('--hp', hp); }
    if (!reduce && pinesEl) {
      const pp = Math.round((S.y / Math.max(1, document.documentElement.scrollHeight - innerHeight)) * 2000) / 2000;
      if (pp !== ppShown) { ppShown = pp; pinesEl.style.setProperty('--pp', pp); }
    }
    reveals(S.y);
    railUpdate(S.y);
    colorUpdate();
  }
  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add(frame);

  // ---- загрузка ----
  const loader = document.getElementById('loader');
  const bar = loader.querySelector('.loader__bar i');
  const setP = (p) => bar.style.setProperty('--p', p);
  setP(0.15);
  let opened = false;
  function open() {
    if (opened) return;
    opened = true;
    setP(1);
    layout();
    setTimeout(() => {
      loader.classList.add('done');
      document.documentElement.classList.add('is-in');
      gsap.to(S, { intro: 1, duration: reduce ? 0.01 : 2.6, ease: 'power3.out', delay: 0.1 });
    }, 250);
  }
  const fonts = (document.fonts ? document.fonts.ready : Promise.resolve()).then(() => setP(0.45));
  const scene = new Promise((r) => addEventListener('zrish:ready', r, { once: true })).then(() => setP(0.85));
  Promise.all([fonts, scene]).then(open);
  addEventListener('zrish:fail', open);
  setTimeout(open, 9000);
})();
