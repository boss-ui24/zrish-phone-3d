/* Zrish — геометрия. Единицы — миллиметры: x — ширина, y — высота, z — толщина (+z — экран).
   Контур («сквиркл») ресэмплится по длине, а профиль сечения протягивается вдоль него (sweep):
   так у рамки, стёкол, плато и колец объективов честные нормали на скруглениях и ровные блики.
   Кольца объективов — тот же sweep по «контуру» нулевого радиуса, то есть токарное тело. */
import * as THREE from 'three';

const TAU = Math.PI * 2;

// Замкнутый контур w×h с углами-суперэллипсами радиуса r (n = 2 — обычная дуга, 4 — «сквиркл»).
export function squircle(w, h, r, n = 4, count = 400) {
  const raw = [];
  const hw = w / 2 - r, hh = h / 2 - r, seg = 64;
  const centers = [[hw, hh], [-hw, hh], [-hw, -hh], [hw, -hh]];
  for (let q = 0; q < 4; q++) {
    const [cx, cy] = centers[q];
    for (let i = 0; i <= seg; i++) {
      const t = (q + i / seg) * Math.PI / 2;
      const c = Math.cos(t), s = Math.sin(t);
      raw.push(cx + r * Math.sign(c) * Math.pow(Math.abs(c), 2 / n), cy + r * Math.sign(s) * Math.pow(Math.abs(s), 2 / n));
    }
  }
  return resample(raw, count);
}

export const stadium = (len, wid, count = 120) => squircle(len, wid, wid / 2, 2, count);
export const circle = (r, count = 96) => squircle(2 * r, 2 * r, r, 2, count);

// Равномерно по длине: тогда полоса развёртки (u) идёт без растяжек.
function resample(raw, count) {
  const n = raw.length / 2;
  const cum = new Float64Array(n + 1);
  for (let i = 1; i <= n; i++) {
    const a = (i - 1) * 2, b = (i % n) * 2;
    cum[i] = cum[i - 1] + Math.hypot(raw[b] - raw[a], raw[b + 1] - raw[a + 1]);
  }
  const L = cum[n], pts = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const s = (k / count) * L;
    while (j < n - 1 && cum[j + 1] < s) j++;
    const a = j * 2, b = ((j + 1) % n) * 2, len = cum[j + 1] - cum[j];
    const t = len > 1e-9 ? (s - cum[j]) / len : 0;
    pts.push({ x: raw[a] + (raw[b] - raw[a]) * t, y: raw[a + 1] + (raw[b + 1] - raw[a + 1]) * t, s });
  }
  return frame(pts, L);
}

function frame(pts, L) {
  const N = pts.length;
  for (let k = 0; k < N; k++) {
    const p = pts[(k + N - 1) % N], q = pts[(k + 1) % N];
    let tx = q.x - p.x, ty = q.y - p.y;
    const l = Math.hypot(tx, ty) || 1;
    tx /= l; ty /= l;
    Object.assign(pts[k], { tx, ty, nx: ty, ny: -tx });
  }
  pts.L = L;
  return pts;
}

// «Контур» для токарного тела: все точки в центре, нормали смотрят по радиусу.
export function lathe(count = 72) {
  const pts = [];
  for (let k = 0; k < count; k++) {
    const a = (k / count) * TAU, c = Math.cos(a), s = Math.sin(a);
    pts.push({ x: 0, y: 0, s: k / count, nx: c, ny: s, tx: -s, ty: c });
  }
  pts.L = 1;
  return pts;
}

export function outlineAt(o, s) {
  const N = o.length, L = o.L;
  s = ((s % L) + L) % L;
  const f = (s / L) * N, i = Math.floor(f) % N, t = f - Math.floor(f);
  const a = o[i], b = o[(i + 1) % N];
  let nx = a.nx + (b.nx - a.nx) * t, ny = a.ny + (b.ny - a.ny) * t;
  const l = Math.hypot(nx, ny) || 1;
  nx /= l; ny /= l;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, nx, ny, tx: -ny, ty: nx, s };
}

export function nearestS(o, x, y) {
  let best = Infinity, s = 0;
  for (const p of o) { const d = (p.x - x) ** 2 + (p.y - y) ** 2; if (d < best) { best = d; s = p.s; } }
  return s;
}

// Кусок контура [s0, s1] — для накладок вроде антенных полосок.
export function slice(o, s0, s1, n = 6) {
  const pts = [];
  for (let i = 0; i <= n; i++) pts.push(outlineAt(o, s0 + ((s1 - s0) * i) / n));
  pts.forEach((p, i) => { p.s = s0 + ((s1 - s0) * i) / n; });
  pts.L = s1 - s0;
  return pts;
}

// Профиль сечения (o — смещение наружу от контура, z — по толщине).
// Обходить сечение против часовой (o вправо, z вверх): нормаль = касательная, повёрнутая по часовой.
export class Profile {
  constructor() { this.p = []; }
  to(o, z) { this.p.push({ o, z, hard: false }); return this; }
  hard() { this.p[this.p.length - 1].hard = true; return this; }
  arc(co, cz, r, a0, a1, n = 8) {
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      this.to(co + r * Math.cos(a), cz + r * Math.sin(a));
    }
    return this;
  }
  build() {
    const p = [];
    for (const q of this.p) {
      const last = p[p.length - 1];
      if (last && Math.hypot(q.o - last.o, q.z - last.z) < 1e-7) { last.hard = last.hard || q.hard; continue; }
      p.push({ ...q });
    }
    const segN = [], cum = [0];
    for (let i = 0; i < p.length - 1; i++) {
      const d0 = p[i + 1].o - p[i].o, d1 = p[i + 1].z - p[i].z, l = Math.hypot(d0, d1);
      segN.push([d1 / l, -d0 / l]);
      cum.push(cum[i] + l);
    }
    const total = cum[cum.length - 1] || 1, out = [];
    for (let i = 0; i < p.length; i++) {
      const v = cum[i] / total, nIn = segN[i - 1], nOut = segN[i];
      const put = (n) => out.push({ o: p[i].o, z: p[i].z, no: n[0], nz: n[1], v });
      if (!nIn) put(nOut);
      else if (!nOut) put(nIn);
      else if (p[i].hard) { put(nIn); put(nOut); }
      else {
        const a = nIn[0] + nOut[0], b = nIn[1] + nOut[1], l = Math.hypot(a, b) || 1;
        put([a / l, b / l]);
      }
    }
    return out;
  }
}

export function sweep(outline, prof, { closed = true, mirror = false } = {}) {
  const N = outline.length, M = prof.length, cols = closed ? N + 1 : N;
  const pos = new Float32Array(cols * M * 3), nor = new Float32Array(cols * M * 3);
  const uv = new Float32Array(cols * M * 2), tan = new Float32Array(cols * M * 4);
  const L = outline.L || 1, s0 = outline[0].s;
  for (let i = 0; i < cols; i++) {
    const p = outline[i % N];
    const u = closed ? (i === N ? 1 : p.s / L) : (p.s - s0) / L;
    for (let j = 0; j < M; j++) {
      const q = prof[j], k = i * M + j;
      const nz = mirror ? -q.nz : q.nz;
      pos[k * 3] = p.x + p.nx * q.o;
      pos[k * 3 + 1] = p.y + p.ny * q.o;
      pos[k * 3 + 2] = mirror ? -q.z : q.z;
      const nx = p.nx * q.no, ny = p.ny * q.no, l = Math.hypot(nx, ny, nz) || 1;
      nor[k * 3] = nx / l; nor[k * 3 + 1] = ny / l; nor[k * 3 + 2] = nz / l;
      uv[k * 2] = u; uv[k * 2 + 1] = q.v;
      tan[k * 4] = p.tx; tan[k * 4 + 1] = p.ty; tan[k * 4 + 2] = 0; tan[k * 4 + 3] = 1;
    }
  }
  const idx = [];
  for (let i = 0; i < cols - 1; i++) {
    for (let j = 0; j < M - 1; j++) {
      const a = i * M + j, b = (i + 1) * M + j;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return finish(pos, nor, uv, tan, idx);
}

// Плоская крышка по контуру, утопленному на inset. UV — по габариту крышки (для текстур экрана и стекла).
export function cap(outline, inset, z, dir = 1) {
  const N = outline.length;
  const pos = new Float32Array((N + 1) * 3), nor = new Float32Array((N + 1) * 3);
  const uv = new Float32Array((N + 1) * 2), tan = new Float32Array((N + 1) * 4);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, cx = 0, cy = 0;
  const ring = outline.map((p) => {
    const x = p.x - p.nx * inset, y = p.y - p.ny * inset;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    cx += x; cy += y;
    return [x, y];
  });
  ring.unshift([cx / N, cy / N]);
  ring.forEach(([x, y], i) => {
    pos.set([x, y, z], i * 3);
    nor.set([0, 0, dir], i * 3);
    uv.set([(x - minX) / (maxX - minX), (y - minY) / (maxY - minY)], i * 2);
    tan.set([1, 0, 0, 1], i * 4);
  });
  const idx = [];
  for (let i = 0; i < N; i++) idx.push(0, 1 + i, 1 + ((i + 1) % N));
  const g = finish(pos, nor, uv, tan, idx);
  g.userData.box = { minX, maxX, minY, maxY };
  return g;
}

// Пластина: стенка от base до top − r, скругление r, плоская крышка.
// base/top — «наружу» от середины корпуса; dir = −1 — пластина смотрит назад (−z).
export function plate(outline, { inset = 0, base = 0, top = 1, r = 0.3, dir = 1, n = 7 } = {}) {
  const pr = new Profile().to(-inset, base).to(-inset, top - r).arc(-inset - r, top - r, r, 0, Math.PI / 2, n).build();
  return { edge: sweep(outline, pr, { mirror: dir < 0 }), face: cap(outline, inset + r, dir * top, dir) };
}

export function disc(r, z, dir = 1, count = 72) { return cap(circle(r, count), 0, z, dir); }

// Ставит объект по базису: локальные x, y, z объекта уходят в векторы ux, uy, uz.
export function orient(obj, ux, uy, uz) {
  obj.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(ux, uy, uz));
  return obj;
}

// Треугольники разворачиваем «лицом» туда, куда смотрят нормали вершин.
function finish(pos, nor, uv, tan, idx) {
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t] * 3, b = idx[t + 1] * 3, c = idx[t + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const sx = nor[a] + nor[b] + nor[c], sy = nor[a + 1] + nor[b + 1] + nor[c + 1], sz = nor[a + 2] + nor[b + 2] + nor[c + 2];
    if (fx * sx + fy * sy + fz * sz < 0) { const k = idx[t + 1]; idx[t + 1] = idx[t + 2]; idx[t + 2] = k; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('tangent', new THREE.BufferAttribute(tan, 4));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}
