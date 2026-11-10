/* Zrish — процедурные текстуры на canvas: зерно матового стекла, шлифовка титана,
   линзы в полярной развёртке (u — угол, v — от края к центру), вспышка, LiDAR и AO-карты. */
import * as THREE from 'three';

const TAU = Math.PI * 2;
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const tex = (c, srgb = false) => {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = 8;
  return t;
};
const rnd = (seed) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

function blur(a, n, r) {
  const tmp = new Float32Array(a.length), k = 2 * r + 1;
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += a[y * n + ((x + i + n) % n)];
    tmp[y * n + x] = s / k;
  }
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
    let s = 0;
    for (let i = -r; i <= r; i++) s += tmp[((y + i + n) % n) * n + x];
    a[y * n + x] = s / k;
  }
}

// Бесшовная карта нормалей мелкого зерна — матовое «травлёное» стекло.
export function grainNormal(size = 256, amp = 9) {
  const r = rnd(7), h = new Float32Array(size * size);
  for (let i = 0; i < h.length; i++) h[i] = r();
  blur(h, size, 1);
  blur(h, size, 1);
  const c = mk(size, size), ctx = c.getContext('2d'), img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = h[y * size + ((x + 1) % size)] - h[y * size + ((x - 1 + size) % size)];
    const dy = h[((y + 1) % size) * size + x] - h[((y - 1 + size) % size) * size + x];
    const nx = -dx * amp, ny = -dy * amp, l = Math.hypot(nx, ny, 1), k = (y * size + x) * 4;
    img.data[k] = (nx / l * 0.5 + 0.5) * 255;
    img.data[k + 1] = (ny / l * 0.5 + 0.5) * 255;
    img.data[k + 2] = (1 / l * 0.5 + 0.5) * 255;
    img.data[k + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

export const Z_PATH = 'M8 7h16v3.6L13.6 21.4H24V25H8v-3.6L18.4 10.6H8z';

// Задняя крышка: R — затенение у плато камеры, G — шероховатость (глянцевый знак «Z» в центре).
// box — габарит крышки в мм, plateau — {x, y, size, r} в тех же координатах.
export function backMap(box, plateau) {
  const W = 512, H = Math.round((W * (box.maxY - box.minY)) / (box.maxX - box.minX));
  const k = W / (box.maxX - box.minX);
  const px = (x) => (x - box.minX) * k, py = (y) => (box.maxY - y) * k;
  const c = mk(W, H), ctx = c.getContext('2d');
  ctx.fillStyle = 'rgb(255,100,0)';
  ctx.fillRect(0, 0, W, H);
  // мелкий шум шероховатости
  const img = ctx.getImageData(0, 0, W, H), r = rnd(11);
  for (let i = 0; i < img.data.length; i += 4) img.data[i + 1] = 66 + r() * 14;
  ctx.putImageData(img, 0, 0);
  // мягкая тень вокруг плато
  if ('filter' in ctx) {
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.filter = `blur(${(2.2 * k).toFixed(1)}px)`;
    ctx.fillStyle = 'rgb(150,255,255)';
    const s = (plateau.size + 2.2) * k;
    roundRect(ctx, px(plateau.x) - s / 2, py(plateau.y) - s / 2, s, s, (plateau.r + 1) * k);
    ctx.fill();
    ctx.restore();
  }
  // знак «Z»: глянцевый на матовом. Крышку видно со спины, то есть зеркально, — рисуем отражённым.
  ctx.save();
  ctx.translate(px(0), py(-4));
  ctx.scale(-0.75 * k, 0.75 * k);
  ctx.translate(-16, -16);
  ctx.fillStyle = 'rgb(255,22,0)';
  ctx.fill(new Path2D(Z_PATH));
  ctx.restore();
  return tex(c);
}

// Шлифовка рамки: полосы вдоль контура (u), разная шероховатость поперёк (v).
export function brushed() {
  const W = 64, H = 512, c = mk(W, H), ctx = c.getContext('2d'), r = rnd(3);
  const img = ctx.createImageData(W, H);
  let drift = 0;
  for (let y = 0; y < H; y++) {
    drift = drift * 0.85 + (r() - 0.5) * 0.3;
    const base = 78 + drift * 30 + (r() - 0.5) * 22;
    for (let x = 0; x < W; x++) {
      const v = Math.max(40, Math.min(120, base + (r() - 0.5) * 4)), k = (y * W + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = v;
      img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// Линза в полярной развёртке: верх холста — центр, низ — край. tele — квадратное окно перископа.
export function lensMap(tele = false) {
  const W = 256, H = 256, c = mk(W, H), ctx = c.getContext('2d'), img = ctx.createImageData(W, H);
  const mix = (a, b, t) => a + (b - a) * t;
  const ss = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  for (let y = 0; y < H; y++) {
    const rho = y / (H - 1); // 0 — центр, 1 — край
    for (let x = 0; x < W; x++) {
      const th = (x / W) * TAU;
      let R = 6, G = 7, B = 10;
      // кольца оправы и внутренних линз
      const ring1 = Math.exp(-(((rho - 0.8) / 0.025) ** 2)), ring2 = Math.exp(-(((rho - 0.6) / 0.035) ** 2));
      R += ring1 * 22 + ring2 * 9; G += ring1 * 28 + ring2 * 12; B += ring1 * 44 + ring2 * 20;
      const edge = ss(0.9, 1, rho);
      R = mix(R, 26, edge); G = mix(G, 27, edge); B = mix(B, 30, edge);
      // апертура
      let ap;
      if (tele) {
        const m = Math.pow(Math.pow(Math.abs(Math.cos(th)), 6) + Math.pow(Math.abs(Math.sin(th)), 6), 1 / 6);
        ap = 0.4 / m;
      } else ap = 0.42;
      const inAp = 1 - ss(ap - 0.03, ap + 0.01, rho);
      const apEdge = Math.exp(-(((rho - ap) / 0.018) ** 2));
      R = mix(R, 1, inAp) + apEdge * 24; G = mix(G, 1, inAp) + apEdge * 30; B = mix(B, 2, inAp) + apEdge * 52;
      // слабый отблеск внутри апертуры
      const glint = Math.exp(-(((rho - 0.2) / 0.08) ** 2)) * (0.5 + 0.5 * Math.cos(th * 2 - 0.6));
      R += glint * 8; G += glint * 10; B += glint * 22;
      const k = (y * W + x) * 4;
      img.data[k] = R; img.data[k + 1] = G; img.data[k + 2] = B; img.data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return tex(c, true);
}

// Вспышка: кремовый рассеиватель с кольцами Френеля и двумя светодиодами.
export function flashMap() {
  const S = 256, c = mk(S, S), ctx = c.getContext('2d'), m = S / 2;
  const g = ctx.createRadialGradient(m, m, 0, m, m, m);
  g.addColorStop(0, '#f6efd9'); g.addColorStop(0.8, '#e6dcc0'); g.addColorStop(0.94, '#b8ae95'); g.addColorStop(1, '#5c574b');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  for (let r = 10; r < m * 0.92; r += 7) {
    ctx.strokeStyle = `rgba(120,105,70,${0.1 + 0.06 * Math.sin(r)})`;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(m, m, r, 0, TAU); ctx.stroke();
  }
  ctx.fillStyle = '#f3d88a'; ctx.fillRect(m - 30, m - 13, 26, 26);
  ctx.fillStyle = '#fbf6e8'; ctx.fillRect(m + 4, m - 13, 26, 26);
  return tex(c, true);
}

export function lidarMap() {
  const S = 128, c = mk(S, S), ctx = c.getContext('2d'), m = S / 2;
  ctx.fillStyle = '#0c0c0f'; ctx.fillRect(0, 0, S, S);
  const g = ctx.createRadialGradient(m, m, m * 0.5, m, m, m);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.85, 'rgba(40,40,48,.6)'); g.addColorStop(1, 'rgba(10,10,12,1)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, S, S);
  for (const [x, y, r] of [[m - 16, m, 13], [m + 17, m, 10]]) {
    ctx.fillStyle = '#020203'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(90,80,120,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
  }
  return tex(c, true);
}

// AO для крышки плато: тень у основания колец и мелочей. holes — [{x, y, r}] в мм от центра плато.
export function plateauAO(size, holes) {
  const S = 512, k = S / size, c = mk(S, S), ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, S, S);
  for (const h of holes) {
    const x = (h.x + size / 2) * k, y = (size / 2 - h.y) * k, r = h.r * k, f = (h.r + h.spread) * k;
    const g = ctx.createRadialGradient(x, y, r * 0.98, x, y, f);
    g.addColorStop(0, `rgba(0,0,0,${h.dark})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, f, 0, TAU); ctx.fill();
  }
  return tex(c);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
