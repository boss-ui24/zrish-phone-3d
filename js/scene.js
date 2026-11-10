/* Zrish — 3D-сцена. Рендерер с прозрачным фоном поверх CSS-фона, студийное окружение
   (PMREM из «софтбоксов», перепекается при смене отделки), путь телефона по ключам секций,
   тема (отделка + «темнота» секции) → материалы, свет, CSS-переменные, свечение и выноски. */
import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { buildPhone, PLATEAU } from './phone.js';

const Z = window.ZRISH, S = Z.state;
const PI = Math.PI, TAU = PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const canvas = document.getElementById('gl');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
} catch (err) {
  dispatchEvent(new Event('zrish:fail'));
  throw err;
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NeutralToneMapping;
renderer.toneMappingExposure = 1;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const FOV = 26, CAMZ = 4.64, SCALE = 0.01;
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.2, 40);
camera.position.set(0, 0, CAMZ);
const tanH = Math.tan((FOV * PI) / 360);

const phone = buildPhone();
const holder = new THREE.Group();
phone.group.scale.setScalar(SCALE);
holder.add(phone.group);
scene.add(holder);

// ---------- палитры ----------
const hexRGB = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const PAL = Z.PALETTES.map((p) => {
  const C = {}, R = {};
  for (const k of ['glass', 'plateau', 'frame', 'ring', 'bgHi', 'bgMid', 'bgLo', 'accent', 'glow']) { C[k] = new THREE.Color(p[k]); R[k] = hexRGB(p[k]); }
  return { ...p, C, R };
});
const finish = { glass: new THREE.Color(), plateau: new THREE.Color(), frame: new THREE.Color(), ring: new THREE.Color() };
const tint = { bgHi: new THREE.Color(), bgMid: new THREE.Color(), bgLo: new THREE.Color(), glow: new THREE.Color() };
function blend(c) {
  const i0 = ((Math.floor(c) % 4) + 4) % 4, i1 = (i0 + 1) % 4, f = ease(c - Math.floor(c));
  return { a: PAL[i0], b: PAL[i1], f };
}

// ---------- студийное окружение ----------
const env = new THREE.Scene();
const dome = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() } },
  vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'uniform vec3 top, mid, bot; varying vec3 vP; void main(){ float y = vP.y; vec3 c = y > 0.0 ? mix(mid, top, smoothstep(0.0, 0.85, y)) : mix(mid, bot, smoothstep(0.0, -0.6, y)); gl_FragColor = vec4(c, 1.0); }',
});
env.add(new THREE.Mesh(new THREE.SphereGeometry(20, 48, 24), dome));
const O = V(0, 0, 0);
const softbox = (w, h, k, pos, color = 0xffffff) => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
  m.position.copy(pos);
  m.lookAt(O);
  env.add(m);
  return m;
};
softbox(10, 4, 2.4, V(0, 8, 1.5));      // большой верхний
softbox(1.3, 10, 3.6, V(-7.5, 1, 2.5)); // левый стрип
softbox(1.1, 10, 2.6, V(7.5, 0.5, -2)); // правый задний стрип
softbox(4.5, 5.5, 1.7, V(-3.6, 2.4, 7)); // ключевой спереди-слева
softbox(0.9, 7, 2.2, V(5.2, -1, 6.2));  // второй блик спереди-справа
softbox(0.5, 0.5, 14, V(1.6, 3.2, 6.5)); // маленький яркий — «искра» в линзах
const rimBox = softbox(1.0, 9, 1, V(4.2, 1, -7));
const floorBox = softbox(16, 16, 1, V(0, -7.5, 0));
const pmrem = new THREE.PMREMGenerator(renderer);
let envRT = null;
function bakeEnv(bl) {
  const L = (k) => tint[k].copy(bl.a.C[k]).lerp(bl.b.C[k], bl.f);
  dome.uniforms.top.value.copy(L('bgHi')).multiplyScalar(0.3);
  dome.uniforms.mid.value.copy(L('bgMid')).multiplyScalar(0.12);
  dome.uniforms.bot.value.copy(L('bgLo')).multiplyScalar(0.2);
  rimBox.material.color.copy(L('glow')).multiplyScalar(2.6);
  floorBox.material.color.copy(tint.glow).multiplyScalar(0.35);
  const rt = pmrem.fromScene(env, 0.02, 0.1, 60);
  if (envRT) envRT.dispose();
  envRT = rt;
  scene.environment = rt.texture;
}

// ---------- прямой свет ----------
// Прямоугольные софтбоксы дают на матовом стекле мягкий градиент, а на глянце — чёткий блик.
RectAreaLightUniformsLib.init();
const keyRect = new THREE.RectAreaLight(0xffffff, 7, 2.4, 3.4);
keyRect.position.set(-2.6, 2.4, 5.2);
keyRect.lookAt(0, 0, 0);
const stripRect = new THREE.RectAreaLight(0xffffff, 10, 0.5, 4.5);
stripRect.position.set(3.4, 0.4, 3.2);
stripRect.lookAt(0, 0, 0);
const key = new THREE.DirectionalLight(0xffffff, 0.5);
key.position.set(-3, 4, 5);
const rim = new THREE.DirectionalLight(0xffffff, 2);
rim.position.set(4, 2, -4);
const fill = new THREE.DirectionalLight(0xffffff, 0.3);
fill.position.set(3, -2.5, 4);
scene.add(keyRect, stripRect, key, rim, fill);

// ---------- ключи пути ----------
// x, y — доля половины кадра на глубине z; px/py/pz — точка телефона (мм), которую ставим в (x, y, z).
// c — отделка (дробная — смешение), d — «темнота» фона, g — свечение под телефоном, s — экран, e — разлёт слоёв.
// thru — ключ, через который телефон проходит без остановки.
const PX = PLATEAU.x, PY = PLATEAU.y, PZ = -(8.25 / 2 + 0.06 + PLATEAU.h);
const CB = 3 * PI - 0.45;
const FIELDS = ['x', 'y', 'z', 'rx', 'ry', 'rz', 'px', 'py', 'pz', 'c', 'd', 'g', 's', 'e'];
const RAW = [
  // первая прокрутка — полный оборот с креном: спина → экран (вспыхивает) → спина справа
  ['hero', 0, { x: 0, y: -0.25, z: 1.9, rx: -0.38, ry: 0.18 - PI, rz: -0.32, px: PX, py: PY, pz: PZ, c: 0, d: 0.5, g: 0.75, s: 0, e: 0 }, { y: -0.52, z: 1.1 }],
  ['intro', 0, { x: -0.04, y: 0.03, z: 0.8, rx: 0.14, ry: 0.3, rz: 0.34, px: 0, py: 0, pz: 0, d: 0.36, g: 1.3, s: 1, thru: 1 }, { x: 0, y: -0.06, z: -0.1 }],
  ['intro', 0.3, { x: 0.42, y: 0, z: 0, rx: 0.04, ry: PI + 0.5, rz: -0.05, d: 0.55, g: 0.7, s: 0 }, { x: 0.05, y: -0.42, z: -0.9 }],
  ['intro', 0.92, { x: 0.4, y: 0.02, z: 0.05, rx: 0.02, ry: PI + 0.36, rz: -0.03 }, { x: 0.04, y: -0.42, z: -0.9 }],
  ['frame', 0.12, { x: 0.3, y: 0, z: 0.32, rx: 0, ry: PI / 2 - 0.24, rz: 0, d: 0.88, g: 0.5 }, { x: 0, y: -0.42, z: -0.6 }],
  ['frame', 0.45, { ry: PI / 2 - 0.18 }],
  ['frame', 0.62, { ry: 1.5 * PI - 0.3 }],
  ['frame', 0.9, { ry: 1.5 * PI - 0.24 }],
  ['camera', 0.15, { x: 0.2, y: 0.02, z: 3.0, rx: -0.1, ry: PI - 0.2, rz: 0.1, px: PX, py: PY, pz: PZ, d: 0.94, g: 0.2 }, { x: 0, y: -0.28, z: 2.3 }],
  ['camera', 0.9, { x: 0.17, z: 3.15, rx: 0.06, ry: PI + 0.1, rz: 0.04 }, { x: 0, y: -0.26, z: 2.4 }],
  ['display', 0.16, { x: 0.3, y: 0, z: 0.35, rx: 0, ry: TAU, rz: 0, px: 0, py: 0, pz: 0, d: 0.9, g: 0.85, s: 0 }, { x: 0, y: -0.34, z: -0.9 }],
  ['display', 0.3, { s: 1 }],
  ['display', 0.5, { ry: TAU - 0.08 }],
  ['display', 0.62, { e: 0 }],
  ['display', 0.84, { x: 0.27, z: 0.5, rx: 0.14, ry: TAU - 0.62, rz: 0.04, e: 1 }, { x: 0, y: -0.32, z: -0.8 }],
  ['display', 0.98, { ry: TAU - 0.55 }],
  ['battery', 0.14, { x: 0.33, y: -0.03, z: 0.1, rx: 0.05, ry: TAU - 0.32, rz: 0.1, e: 0, d: 0.93, g: 1.3 }, { x: 0, y: -0.3, z: -1.0 }],
  ['battery', 0.88, { ry: TAU - 0.18, rz: 0.06 }],
  ['colors', Z.COLOR_P[0], { x: 0.4, y: 0, z: 0, rx: 0.03, ry: CB, rz: -0.05, c: 0, d: 0.12, g: 0.8, s: 0 }, { x: 0.03, y: -0.42, z: -1.2 }],
  ['colors', Z.COLOR_P[0] + 0.08, {}],
  ['colors', Z.COLOR_P[1], { c: 1, ry: CB + TAU }],
  ['colors', Z.COLOR_P[1] + 0.08, {}],
  ['colors', Z.COLOR_P[2], { c: 2, ry: CB + 2 * TAU }],
  ['colors', Z.COLOR_P[2] + 0.08, {}],
  ['colors', Z.COLOR_P[3], { c: 3, ry: CB + 3 * TAU }],
  ['colors', 1, { ry: CB + 3 * TAU + 0.1 }],
  ['finale', 0.16, { x: 0, y: 0.16, z: -0.8, rx: 0.06, ry: 10 * PI - 0.35, rz: 0.02, c: 4, d: 0.55, g: 1.1, s: 1 }, { x: 0, y: 0.16, z: -1.2 }],
  ['finale', 0.9, { y: 0.17, ry: 10 * PI - 0.2 }, { y: 0.16 }],
  ['specs', 0, { y: 1.75, z: -0.6, rx: -0.3, ry: 10 * PI + 0.4, d: 0.94, g: 0 }],
];
// Незаданные поля тянутся из предыдущего ключа; m — правки позы для узкого экрана.
function fillKeys(mobile) {
  let cur = {};
  return RAW.map(([sec, p, { thru, ...pose }, m]) => {
    cur = { ...cur, ...pose, ...(mobile && m ? m : {}) };
    return { sec, p, thru: !!thru, pose: { ...cur } };
  });
}
const KEYS = { d: fillKeys(false), m: fillKeys(true) };
let keys = KEYS.d, keysLayout = -1;
function placeKeys() {
  for (const k of keys) { const R = Z.ranges[k.sec]; k.y = R ? R.start + k.p * R.len : 0; }
  keysLayout = Z.layoutId;
}
const pose = {}, goal = {};
// Между «остановочными» ключами — один плавный разгон и торможение; ключи thru внутри
// участка задают только путь, поэтому телефон не замирает на них.
function sample(y) {
  const n = keys.length;
  if (y <= keys[0].y || y >= keys[n - 1].y) {
    const k = y <= keys[0].y ? keys[0] : keys[n - 1];
    for (const f of FIELDS) goal[f] = k.pose[f];
    return;
  }
  let i = 0;
  while (i < n - 2 && y > keys[i + 1].y) i++;
  let a = i, c = i + 1;
  while (a > 0 && keys[a].thru) a--;
  while (c < n - 1 && keys[c].thru) c++;
  const y0 = keys[a].y, y1 = keys[c].y;
  const ye = y0 + ease(clamp((y - y0) / Math.max(1, y1 - y0), 0, 1)) * (y1 - y0);
  let j = a;
  while (j < c - 1 && ye > keys[j + 1].y) j++;
  const A = keys[j], B = keys[j + 1], t = clamp((ye - A.y) / Math.max(1, B.y - A.y), 0, 1);
  for (const f of FIELDS) goal[f] = lerp(A.pose[f], B.pose[f], t);
}

// ---------- размер ----------
let W = 0, H = 0, mobile = false, dpr = Math.min(window.devicePixelRatio || 1, 1.75);
function resize() {
  const w = canvas.clientWidth || innerWidth, h = canvas.clientHeight || innerHeight;
  if (w === W && Math.abs(h - H) < 2) return;
  W = w; H = h;
  renderer.setPixelRatio(dpr);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const m = w < 760 || w / h < 0.8;
  if (m !== mobile || keysLayout < 0) { mobile = m; keys = mobile ? KEYS.m : KEYS.d; keysLayout = -1; }
}
resize();
addEventListener('resize', resize);

// ---------- тема → CSS ----------
const root = document.documentElement.style;
const glowEl = document.getElementById('glow');
const mixA = (a, b, t) => [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * t));
const css = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
let themeKey = '';
function theme(c, d) {
  const k = `${c.toFixed(3)}|${d.toFixed(3)}`;
  if (k === themeKey) return;
  themeKey = k;
  const { a, b, f } = blend(c);
  const P = (n) => mixA(a.R[n], b.R[n], f);
  const hi = P('bgHi'), mid = P('bgMid'), lo = P('bgLo'), acc = P('accent'), gl = P('glow');
  const hiD = mixA(hi, mixA(gl, [8, 7, 10], 0.82), d), midD = mixA(mid, [10, 9, 12], d * 0.94), loD = mixA(lo, [3, 3, 4], d);
  root.setProperty('--bg-hi', css(hiD));
  root.setProperty('--bg-mid', css(midD));
  root.setProperty('--bg-lo', css(loD));
  root.setProperty('--accent', css(acc));
  root.setProperty('--glow', css(gl));
  root.setProperty('--pine-far', css(mixA(mixA(mid, lo, 0.55), [6, 6, 7], d)));
  root.setProperty('--pine-near', css(mixA(mixA(lo, [0, 0, 0], 0.35), [2, 2, 3], d)));
  root.setProperty('--pines', (1 - d * 0.96).toFixed(3));
  root.setProperty('--spot', (1 - d * 0.7).toFixed(3));
  S.dust = acc.join(',');
  S.dustA = 1 - d * 0.35;
}

// ---------- выноски и свечение ----------
const callouts = [...document.querySelectorAll('.co')].map((el) => ({ el, a: phone.anchors[el.dataset.anchor] }));
const pv = new THREE.Vector3();
function toScreen(local) {
  pv.copy(local).applyMatrix4(phone.group.matrixWorld).project(camera);
  return [(pv.x * 0.5 + 0.5) * W, (-pv.y * 0.5 + 0.5) * H];
}
const C0 = V(0, 0, 0), CT = V(0, 80, 0), WHITE = new THREE.Color(1, 1, 1);

// ---------- кадр ----------
const E = new THREE.Euler(0, 0, 0, 'XYZ'), T = new THREE.Vector3(), PIV = new THREE.Vector3();
let first = true, last = performance.now(), slow = 0, envKey = '', envAt = 0, drawnIdx = -1, drawnMin = -1, fontsOk = false, sleeping = false;
const sm = { mx: 0, my: 0 };
function tick() {
  const now = performance.now(), dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (keysLayout !== Z.layoutId) placeKeys();
  sample(S.y || window.scrollY);

  // заход на первом экране
  const intro = S.intro ?? 1, k = 1 - intro;
  goal.y -= k * 0.95;
  goal.rx -= k * 0.4;
  goal.ry -= k * 0.5;

  const kk = first ? 1 : 1 - Math.exp(-14 * dt);
  for (const f of FIELDS) pose[f] = first ? goal[f] : pose[f] + (goal[f] - pose[f]) * kk;
  first = false;

  // дыхание и мышь
  const t = now / 1000, macro = clamp((pose.z - 1.5) / 1.5, 0, 1);
  sm.mx += (S.mx - sm.mx) * (1 - Math.exp(-3 * dt));
  sm.my += (S.my - sm.my) * (1 - Math.exp(-3 * dt));
  const amp = 1 - macro * 0.6;
  const dist = CAMZ - pose.z, hh = tanH * dist, hw = hh * camera.aspect;
  T.set(pose.x * hw, pose.y * hh + Math.sin(t * 0.9) * 0.01 * amp, pose.z);
  E.set(pose.rx + Math.sin(t * 0.55) * 0.012 * amp + sm.my * 0.06 * amp, pose.ry + sm.mx * 0.12 * amp, pose.rz + Math.sin(t * 0.7) * 0.01 * amp);
  holder.quaternion.setFromEuler(E);
  PIV.set(pose.px, pose.py, pose.pz).multiplyScalar(SCALE).applyQuaternion(holder.quaternion);
  holder.position.copy(T).sub(PIV);

  // отделка и тема
  const { a, b, f } = blend(pose.c);
  for (const n of ['glass', 'plateau', 'frame', 'ring']) finish[n].copy(a.C[n]).lerp(b.C[n], f);
  phone.setFinish(finish);
  S.colorIdx = ((Math.round(pose.c) % 4) + 4) % 4;
  theme(pose.c, pose.d);
  const ek = (Math.round(pose.c * 25) / 25).toFixed(2);
  if (ek !== envKey && (now - envAt > 120 || !scene.environment)) { bakeEnv(blend(+ek)); envKey = ek; envAt = now; }
  scene.environmentIntensity = 1 - pose.d * 0.5;
  rim.color.copy(a.C.glow).lerp(b.C.glow, f);
  rim.intensity = 1.2 + pose.d * 1.8;
  key.intensity = 0.5 * (1 - pose.d * 0.35);
  keyRect.intensity = 7 * (1 - pose.d * 0.25);
  stripRect.color.copy(rim.color).lerp(WHITE, 0.55);

  // экран: перерисовка только когда его видно
  if (pose.s > 0.01 && fontsOk) {
    const min = new Date().getMinutes();
    if (S.colorIdx !== drawnIdx || min !== drawnMin) { phone.redraw(PAL[S.colorIdx]); drawnIdx = S.colorIdx; drawnMin = min; }
  }
  phone.setScreen(clamp(pose.s, 0, 1), clamp(pose.e, 0, 1));

  scene.updateMatrixWorld();
  // свечение под телефоном
  const [cx, cy] = toScreen(C0), [tx, ty] = toScreen(CT);
  const span = Math.hypot(tx - cx, ty - cy);
  glowEl.style.transform = `translate3d(${cx.toFixed(1)}px, ${(cy + span * 1.05).toFixed(1)}px, 0) scale(${clamp(span / 260, 0.5, 2.2).toFixed(3)})`;
  glowEl.style.opacity = clamp(pose.g * 0.75, 0, 1).toFixed(3);
  for (const c of callouts) {
    const [x, y] = toScreen(c.a);
    c.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }

  // телефон улетел за кадр — не рисуем
  const off = pose.y > 1.55;
  if (off && sleeping) return;
  sleeping = off;
  renderer.render(scene, camera);

  // адаптивное разрешение: если кадр долгий, снижаем DPR
  if (dt > 0.028) slow++; else slow = Math.max(0, slow - 1);
  if (slow > 40 && dpr > 1) { dpr = Math.max(1, dpr - 0.25); slow = 0; W = 0; resize(); }
}

// ---------- старт ----------
(async () => {
  try {
    await Promise.all([document.fonts.load('700 40px "Archivo"'), document.fonts.load('600 20px "Inter"')]);
  } catch (e) { /* шрифты не критичны */ }
  fontsOk = true;
  phone.redraw(PAL[0]);
  drawnIdx = 0;
  drawnMin = new Date().getMinutes();
  bakeEnv(blend(0));
  envKey = '0.00';
  placeKeys();
  sample(window.scrollY);
  try { if (renderer.compileAsync) await renderer.compileAsync(scene, camera); } catch (e) { /* соберётся при первом кадре */ }
  tick();
  gsap.ticker.add(tick);
  S.ready = true;
  dispatchEvent(new Event('zrish:ready'));
})();
