/* Zrish — «воздух» сцены: силуэты ёлок (SVG в .pines, цвета из CSS-переменных)
   и светлые точки на 2D-холсте #air. Цвет точек задаёт scene.js в ZRISH.state.dust. */
(() => {
  const Z = (window.ZRISH = window.ZRISH || {});
  const S = (Z.state = Z.state || {});
  const rnd = (seed) => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // ---- ёлки: ярусы-треугольники, три ряда ----
  function row(seed, base, hMin, hMax, gap) {
    const r = rnd(seed);
    let d = '', x = -20 - r() * 40;
    while (x < 1640) {
      const h = hMin + r() * (hMax - hMin), w = h * (0.32 + r() * 0.1), tiers = 5 + Math.floor(r() * 3);
      for (let t = 0; t < tiers; t++) {
        const k0 = t / tiers, k1 = (t + 1.7) / tiers;
        const yB = base - h * k0 * 0.88, yT = base - h * Math.min(1, k1), ww = (w * (1 - k0 * 0.8)) / 2;
        d += `M${(x - ww).toFixed(1)} ${yB.toFixed(1)}L${x.toFixed(1)} ${yT.toFixed(1)}L${(x + ww).toFixed(1)} ${yB.toFixed(1)}Z`;
      }
      d += `M${(x - 1.5).toFixed(1)} ${base}h3v-${(h * 0.12).toFixed(1)}h-3Z`;
      x += w * gap * (0.6 + r() * 0.8);
    }
    return `${d}M-40 ${base - 1}H1640V400H-40Z`;
  }
  const host = document.getElementById('pines');
  if (host) {
    // каждый ряд — свой svg: CSS сдвигает их с разной скоростью (параллакс глубины)
    host.innerHTML = [row(4, 312, 150, 260, 0.62), row(9, 352, 110, 210, 0.8), row(17, 392, 80, 170, 1.05)]
      .map((d, i) => `<svg class="l${i + 1}" viewBox="0 0 1600 400" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><path class="p${i + 1}" d="${d}"/></svg>`)
      .join('');
  }

  // ---- точки в воздухе ----
  const cv = document.getElementById('air');
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const r = rnd(29), P = [];
  let W = 0, H = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    W = cv.clientWidth || innerWidth; H = cv.clientHeight || innerHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  addEventListener('resize', resize);
  const N = innerWidth < 760 ? 46 : 90;
  for (let i = 0; i < N; i++) {
    const z = 0.3 + r() * 0.7;
    P.push({ x: r(), y: r(), z, r: 0.5 + z * 1.5, vy: 0.00004 + r() * 0.00012, ph: r() * 6.28, sw: 0.4 + r() * 1.2 });
  }
  let last = null;
  function draw(now) {
    const dt = last === null ? 16 : Math.max(0, Math.min(64, now - last));
    last = now;
    ctx.clearRect(0, 0, W, H);
    const rgb = S.dust || '255,214,226', vel = (S.vel || 0) * 0.00004;
    ctx.globalCompositeOperation = 'lighter';
    for (const p of P) {
      if (!reduce) {
        p.y -= p.vy * dt + vel * p.z;
        p.ph += dt * 0.0012 * p.sw;
        if (p.y < -0.05) { p.y = 1.05; p.x = r(); }
        if (p.y > 1.06) p.y = -0.04;
      }
      const x = (p.x + Math.sin(p.ph) * 0.006) * W, y = p.y * H;
      const a = (0.25 + 0.5 * (0.5 + 0.5 * Math.sin(p.ph * 2.3))) * p.z * (S.dustA ?? 1);
      const g = ctx.createRadialGradient(x, y, 0, x, y, p.r * 3);
      g.addColorStop(0, `rgba(${rgb},${a.toFixed(3)})`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x - p.r * 3, y - p.r * 3, p.r * 6, p.r * 6);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  if (window.gsap) gsap.ticker.add((t) => draw(t * 1000));
  else (function loop(t) { draw(t); requestAnimationFrame(loop); })(performance.now());
})();
