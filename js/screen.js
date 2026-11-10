/* Zrish — экран блокировки на canvas. Холст покрывает всю крышку переднего стекла (UV крышки),
   дисплей вписан с рамкой. Кроме общей картинки рисуются отдельные слои (часы, виджеты,
   уведомление) — в секции Display они «отлетают» от обоев на своих плоскостях. */
import * as THREE from 'three';

const TAU = Math.PI * 2;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const rnd = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const rgba = (h, a = 1) => { const [r, g, b] = hex(h); return `rgba(${r},${g},${b},${a})`; };
const shade = (h, t) => { const c = hex(h).map((v) => Math.round(t < 0 ? v * (1 + t) : v + (255 - v) * t)); return `rgb(${c[0]},${c[1]},${c[2]})`; };

function squirclePath(ctx, x, y, w, h, r, n = 4) {
  const hw = w / 2 - r, hh = h / 2 - r, cx = x + w / 2, cy = y + h / 2;
  const cs = [[hw, -hh], [-hw, -hh], [-hw, hh], [hw, hh]];
  ctx.beginPath();
  for (let q = 0; q < 4; q++) {
    for (let i = 0; i <= 24; i++) {
      const t = (q + i / 24) * Math.PI / 2, c = Math.cos(t), s = Math.sin(t);
      const px = cx + cs[q][0] + r * Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
      const py = cy + cs[q][1] - r * Math.sign(s) * Math.pow(Math.abs(s), 2 / n);
      q === 0 && i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
    }
  }
  ctx.closePath();
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Ряд ёлок: ярусы-треугольники, как на фоне страницы.
function pines(ctx, x0, x1, base, hMin, hMax, seed, fill) {
  const r = rnd(seed);
  ctx.fillStyle = fill;
  ctx.beginPath();
  let x = x0 - r() * 30;
  while (x < x1 + 40) {
    const h = hMin + r() * (hMax - hMin), w = h * (0.34 + r() * 0.1), tiers = 4 + Math.floor(r() * 3);
    for (let t = 0; t < tiers; t++) {
      const k0 = t / tiers, k1 = (t + 1.6) / tiers;
      const yB = base - h * k0 * 0.86, yT = base - h * Math.min(1, k1);
      const ww = w * (1 - k0 * 0.78) / 2;
      ctx.moveTo(x - ww, yB); ctx.lineTo(x, yT); ctx.lineTo(x + ww, yB); ctx.closePath();
    }
    x += w * (0.45 + r() * 0.5);
  }
  ctx.fill();
  ctx.fillRect(x0, base - 2, x1 - x0, 4000);
}

export function makeScreen(box) {
  const Wmm = box.maxX - box.minX, Hmm = box.maxY - box.minY;
  const CW = 1024, k = CW / Wmm, CH = Math.round(Hmm * k);
  const bez = 0.9 * k, D = { x: bez, y: bez, w: CW - 2 * bez, h: CH - 2 * bez, r: 13.5 * k };
  const u = D.w / 100, v = D.h / 100;

  const full = mk(CW, CH), base = mk(CW, CH);
  const L = [
    { key: 'clock', y0: D.y + 6 * v, y1: D.y + 30 * v, lift: 14 },
    { key: 'widgets', y0: D.y + 30 * v, y1: D.y + 40 * v, lift: 27 },
    { key: 'note', y0: D.y + 52 * v, y1: D.y + 68 * v, lift: 42 },
  ].map((l) => {
    l.y0 = Math.floor(l.y0); l.y1 = Math.ceil(l.y1);
    l.canvas = mk(CW, l.y1 - l.y0);
    l.texture = new THREE.CanvasTexture(l.canvas);
    l.texture.colorSpace = THREE.SRGBColorSpace;
    l.hmm = (l.y1 - l.y0) / k;
    l.ymm = Hmm / 2 - (l.y0 + l.y1) / 2 / k;
    return l;
  });
  const texFull = new THREE.CanvasTexture(full), texBase = new THREE.CanvasTexture(base);
  for (const t of [texFull, texBase]) { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; }

  const font = (w, px, fam = 'Inter') => `${w} ${Math.round(px)}px "${fam}", system-ui, sans-serif`;

  function wallpaper(ctx, pal) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, CW, CH);
    ctx.save();
    squirclePath(ctx, D.x, D.y, D.w, D.h, D.r, 3);
    ctx.clip();
    const g = ctx.createLinearGradient(0, D.y, 0, D.y + D.h);
    g.addColorStop(0, shade(pal.bgLo, -0.45)); g.addColorStop(0.42, pal.bgMid);
    g.addColorStop(0.7, shade(pal.bgMid, -0.3)); g.addColorStop(1, shade(pal.bgLo, -0.5));
    ctx.fillStyle = g;
    ctx.fillRect(D.x, D.y, D.w, D.h);
    const cx = D.x + D.w / 2, cy = D.y + 44 * v;
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, D.w * 0.62);
    rg.addColorStop(0, rgba(pal.bgHi, 0.95)); rg.addColorStop(0.35, rgba(pal.bgHi, 0.45)); rg.addColorStop(1, rgba(pal.bgHi, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(D.x, D.y, D.w, D.h);
    const r = rnd(5);
    for (let i = 0; i < 140; i++) {
      const sx = D.x + r() * D.w, sy = D.y + r() * D.h * 0.55, s = 0.6 + r() * 1.8;
      ctx.fillStyle = `rgba(255,255,255,${0.25 + r() * 0.6})`;
      ctx.fillRect(sx, sy, s, s);
    }
    pines(ctx, D.x, D.x + D.w, D.y + 80 * v, 16 * v, 26 * v, 21, shade(pal.bgMid, -0.45));
    pines(ctx, D.x, D.x + D.w, D.y + 88 * v, 14 * v, 24 * v, 37, shade(pal.bgLo, -0.55));
    pines(ctx, D.x, D.x + D.w, D.y + 96 * v, 12 * v, 20 * v, 53, shade(pal.bgLo, -0.8));
    ctx.restore();
  }

  function chrome(ctx, pal) {
    // «островок»
    const iw = 22.6 * u, ih = 6.5 * u, iy = D.y + 2.3 * u;
    ctx.fillStyle = '#000';
    rr(ctx, CW / 2 - iw / 2, iy, iw, ih, ih / 2); ctx.fill();
    ctx.fillStyle = '#0b0d14';
    ctx.beginPath(); ctx.arc(CW / 2 + iw / 2 - ih / 2, iy + ih / 2, ih * 0.22, 0, TAU); ctx.fill();
    // статус-бар
    const sy = iy + ih / 2;
    ctx.fillStyle = '#fff';
    ctx.font = font(600, 3.7 * u);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText('Zrish', D.x + 8 * u, sy);
    const bx = D.x + D.w - 15 * u;
    for (let i = 0; i < 4; i++) { const h = (1.1 + i * 0.55) * u; rr(ctx, bx - 9.5 * u + i * 1.5 * u, sy + 1.4 * u - h, 1 * u, h, 0.3 * u); ctx.fill(); }
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 0.35 * u;
    rr(ctx, bx, sy - 1.6 * u, 6.4 * u, 3.2 * u, 0.9 * u); ctx.stroke();
    rr(ctx, bx + 0.6 * u, sy - 1 * u, 4.4 * u, 2 * u, 0.5 * u); ctx.fill();
    // кнопки фонарика и камеры, полоска «домой»
    for (const [x, icon] of [[D.x + 15 * u, 'torch'], [D.x + D.w - 15 * u, 'cam']]) {
      const y = D.y + D.h - 10.5 * v;
      ctx.fillStyle = 'rgba(0,0,0,.32)';
      ctx.beginPath(); ctx.arc(x, y, 6.6 * u, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 0.45 * u; ctx.lineJoin = 'round';
      if (icon === 'torch') {
        rr(ctx, x - 1.3 * u, y - 0.4 * u, 2.6 * u, 4.2 * u, 0.5 * u); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 1.8 * u, y - 0.4 * u); ctx.lineTo(x - 2.2 * u, y - 3 * u); ctx.lineTo(x + 2.2 * u, y - 3 * u); ctx.lineTo(x + 1.8 * u, y - 0.4 * u); ctx.stroke();
      } else {
        rr(ctx, x - 3 * u, y - 2 * u, 6 * u, 4.4 * u, 0.9 * u); ctx.stroke();
        ctx.beginPath(); ctx.arc(x, y + 0.2 * u, 1.2 * u, 0, TAU); ctx.stroke();
      }
    }
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    rr(ctx, CW / 2 - 18 * u, D.y + D.h - 2.6 * v, 36 * u, 1.3 * u, 0.65 * u); ctx.fill();
  }

  function clock(ctx, pal, date) {
    const cx = CW / 2;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,.9)';
    ctx.font = font(600, 4.3 * u);
    ctx.fillText(date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }), cx, D.y + 13.2 * v);
    const hh = String(date.getHours()).padStart(2, '0'), mm = String(date.getMinutes()).padStart(2, '0');
    const g = ctx.createLinearGradient(0, D.y + 14 * v, 0, D.y + 27 * v);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, shade(pal.accent, 0.35));
    ctx.fillStyle = g;
    ctx.font = font(700, 29 * u, 'Archivo');
    ctx.fillText(`${hh}:${mm}`, cx, D.y + 27 * v);
  }

  function widgets(ctx, pal) {
    const y = D.y + 35 * v, R = 7.6 * u, gap = 19 * u;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    [-1, 0, 1].forEach((i) => {
      const x = CW / 2 + i * gap;
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 0.3 * u; ctx.stroke();
      ctx.fillStyle = '#fff';
      if (i === -1) {
        ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 0.9 * u;
        ctx.beginPath(); ctx.arc(x, y, R - 1.6 * u, 0, TAU); ctx.stroke();
        ctx.strokeStyle = '#7dffa8';
        ctx.beginPath(); ctx.arc(x, y, R - 1.6 * u, -Math.PI / 2, -Math.PI / 2 + TAU * 0.82); ctx.stroke();
        ctx.font = font(700, 4.2 * u); ctx.fillText('82', x, y + 0.2 * u);
      } else if (i === 0) {
        ctx.font = font(700, 4.6 * u); ctx.fillText('−2°', x + 0.4 * u, y - 0.6 * u);
        ctx.font = font(600, 2.2 * u); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.fillText('CLEAR', x, y + 3.6 * u);
      } else {
        ctx.strokeStyle = '#ffd36e'; ctx.lineWidth = 0.6 * u;
        ctx.beginPath(); ctx.arc(x, y + 1 * u, 3 * u, Math.PI, TAU); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x - 4.4 * u, y + 1 * u); ctx.lineTo(x + 4.4 * u, y + 1 * u); ctx.stroke();
        ctx.font = font(600, 2.6 * u); ctx.fillStyle = '#fff'; ctx.fillText('07:12', x, y + 4.4 * u);
      }
    });
  }

  function note(ctx, pal) {
    const x = D.x + 4 * u, w = D.w - 8 * u, y = D.y + 56 * v, h = 8.6 * v;
    ctx.fillStyle = 'rgba(18,14,22,.55)';
    rr(ctx, x, y, w, h, 4.4 * u); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.12)'; ctx.lineWidth = 0.25 * u; ctx.stroke();
    const ix = x + 3.6 * u, iy = y + h / 2 - 5 * u, is = 10 * u;
    const g = ctx.createLinearGradient(ix, iy, ix + is, iy + is);
    g.addColorStop(0, pal.accent); g.addColorStop(1, pal.glow);
    ctx.fillStyle = g; rr(ctx, ix, iy, is, is, 2.4 * u); ctx.fill();
    ctx.save();
    ctx.translate(ix + is / 2, iy + is / 2);
    ctx.scale(is / 40, is / 40);
    ctx.translate(-16, -16);
    ctx.fillStyle = '#140a0f';
    ctx.fill(new Path2D('M8 7h16v3.6L13.6 21.4H24V25H8v-3.6L18.4 10.6H8z'));
    ctx.restore();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,.62)'; ctx.font = font(600, 2.9 * u);
    ctx.fillText('ZRISH CAMERA', ix + is + 3.4 * u, y + h / 2 - 1.2 * u);
    ctx.textAlign = 'right'; ctx.fillText('now', x + w - 4 * u, y + h / 2 - 1.2 * u);
    ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.font = font(600, 3.8 * u);
    ctx.fillText('Night shot saved — 3 s, handheld', ix + is + 3.4 * u, y + h / 2 + 4 * u);
  }

  const parts = { clock, widgets, note };

  function draw(pal, date = new Date()) {
    const b = base.getContext('2d');
    wallpaper(b, pal);
    chrome(b, pal);
    const f = full.getContext('2d');
    f.clearRect(0, 0, CW, CH);
    f.drawImage(base, 0, 0);
    clock(f, pal, date); widgets(f, pal); note(f, pal);
    for (const l of L) {
      const c = l.canvas.getContext('2d');
      c.clearRect(0, 0, CW, l.canvas.height);
      c.save();
      c.translate(0, -l.y0);
      c.shadowColor = rgba(pal.accent, 0.7);
      c.shadowBlur = 3 * u;
      parts[l.key](c, pal, date);
      c.restore();
      l.texture.needsUpdate = true;
    }
    texFull.needsUpdate = true;
    texBase.needsUpdate = true;
  }

  return { texFull, texBase, layers: L, draw, Wmm, Hmm };
}
