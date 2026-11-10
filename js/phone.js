/* Zrish — процедурный телефон в миллиметрах (77.6 × 163 × 8.25). Ни одной загружаемой модели:
   рамка, стёкла, плато камеры, кольца объективов, кнопки и разъём собраны из sweep-геометрии,
   материалы — физические (матовое стекло с зерном, шлифованный титан с анизотропией,
   просветлённые линзы с иридисценцией). Цвет отделки меняет setFinish(). */
import * as THREE from 'three';
import { squircle, stadium, lathe, nearestS, slice, Profile, sweep, plate, disc, orient } from './geo.js';
import { grainNormal, backMap, brushed, lensMap, flashMap, lidarMap, plateauAO } from './tex.js';
import { makeScreen } from './screen.js';

export const DIM = { W: 77.6, H: 163, D: 8.25 };
const { W, H, D } = DIM, D2 = D / 2;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// Плато камеры (центр — в осях телефона) и всё, что на нём (от центра плато).
// Пропорции сверены с фото iPhone 16 Pro Max: плато ~42 мм, объективы Ø 17.6 мм почти вплотную.
// Со спины ось x зеркальна: столбец из двух объективов (x > 0) виден слева.
export const PLATEAU = { x: 15.2, y: 57.6, size: 42, r: 12.5, h: 1.1 };
const LENS_R = 8.8;
const CAMS = [
  { key: 'main', x: 9.4, y: 10 },
  { key: 'ultra', x: 9.4, y: -10 },
  { key: 'tele', x: -9.5, y: 0 },
];
const FLASH = { x: -12.5, y: 14, r: 2.8 };
const LIDAR = { x: -12.5, y: -14, r: 2.7 };
const MIC = { x: -2.5, y: 17.2, r: 0.55 };
const Z_BACK = -(D2 + 0.06);
const Z_PLATEAU = Z_BACK - PLATEAU.h;

export function buildPhone() {
  const group = new THREE.Group();
  const add = (geo, mat, parent = group) => { const m = new THREE.Mesh(geo, mat); parent.add(m); return m; };

  const T = { grain: grainNormal(), brush: brushed(), lens: lensMap(false), tele: lensMap(true), flash: flashMap(), lidar: lidarMap() };
  T.grain.repeat.set(9, 19);
  T.brush.repeat.set(6, 1);

  const outline = squircle(W, H, 17.5, 3, 560);
  const back = plate(outline, { inset: 1.1, base: D2 - 0.9, top: D2 + 0.06, r: 0.42, dir: -1 });
  const front = plate(outline, { inset: 0.85, base: D2 - 0.9, top: D2 + 0.12, r: 0.5, dir: 1 });
  const scr = makeScreen(front.face.userData.box);
  const tBack = backMap(back.face.userData.box, PLATEAU);

  const pOut = squircle(PLATEAU.size, PLATEAU.size, PLATEAU.r, 3, 260);
  const holes = [
    ...CAMS.map((c) => ({ x: c.x, y: c.y, r: LENS_R, spread: 2.0, dark: 0.6 })),
    { ...FLASH, r: FLASH.r + 0.2, spread: 0.9, dark: 0.3 },
    { ...LIDAR, r: LIDAR.r + 0.2, spread: 0.9, dark: 0.3 },
  ];
  const tAO = plateauAO(PLATEAU.size - 2, holes);

  const phys = (o) => new THREE.MeshPhysicalMaterial(o);
  const M = {
    glass: phys({ color: 0xe8e7e3, roughness: 1, roughnessMap: tBack, aoMap: tBack, aoMapIntensity: 1, normalMap: T.grain, normalScale: new THREE.Vector2(0.14, 0.14), sheen: 0.3, sheenRoughness: 0.5, sheenColor: 0xffffff, specularIntensity: 0.9 }),
    glassEdge: phys({ color: 0xe8e7e3, roughness: 0.24, specularIntensity: 0.9 }),
    plateau: phys({ color: 0xd98ea2, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 }),
    plateauTop: phys({ color: 0xd98ea2, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, aoMap: tAO, aoMapIntensity: 1 }),
    frame: phys({ color: 0xd9a0ad, metalness: 1, roughness: 1, roughnessMap: T.brush, anisotropy: 0.6 }),
    ring: phys({ color: 0xe3a9b7, metalness: 1, roughness: 0.16 }),
    bezel: phys({ color: 0x060607, metalness: 0.2, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06 }),
    band: phys({ color: 0x8a5a66, metalness: 0, roughness: 0.5, clearcoat: 0.3, clearcoatRoughness: 0.3 }),
    black: new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 0.7 }),
    barrel: phys({ color: 0x0d0d10, metalness: 0.6, roughness: 0.3 }),
    chrome: phys({ color: 0xa6a6ae, metalness: 1, roughness: 0.16 }),
    lens: phys({ color: 0xffffff, map: T.lens, roughness: 0.035, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.22, iridescenceIOR: 1.75, iridescenceThicknessRange: [180, 540], envMapIntensity: 0.75 }),
    tele: phys({ color: 0xffffff, map: T.tele, roughness: 0.035, clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.22, iridescenceIOR: 1.75, iridescenceThicknessRange: [180, 540], envMapIntensity: 0.75 }),
    flash: phys({ color: 0xffffff, map: T.flash, roughness: 0.38, clearcoat: 1, clearcoatRoughness: 0.04 }),
    lidar: phys({ color: 0xffffff, map: T.lidar, roughness: 0.1, clearcoat: 1, iridescence: 0.8, iridescenceIOR: 1.6 }),
    screen: phys({ color: 0x020203, roughness: 0.05, specularIntensity: 0.35, clearcoat: 1, clearcoatRoughness: 0.02, emissive: 0xffffff, emissiveMap: scr.texFull, emissiveIntensity: 0 }),
    frontEdge: phys({ color: 0x07070a, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03 }),
    sapphire: phys({ color: 0x0b0b0f, metalness: 0.3, roughness: 0.05, clearcoat: 1, iridescence: 0.5, iridescenceIOR: 1.5 }),
  };

  // ---- рамка: плоский бок, скругления к стёклам, тонкие губы вокруг них ----
  const rf = 1.5;
  const aB = -Math.acos((rf - 1.05) / rf), aF = Math.acos((rf - 0.8) / rf);
  const frameProf = new Profile()
    .to(-1.05, -D2 + 0.9)
    .to(-1.05, -D2 + rf + rf * Math.sin(aB)).hard()
    .arc(-rf, -D2 + rf, rf, aB, 0, 12)
    .to(0, D2 - rf)
    .arc(-rf, D2 - rf, rf, 0, aF, 12).hard()
    .to(-0.8, D2 - 0.9)
    .build();
  add(sweep(outline, frameProf), M.frame);

  // антенные полоски — тонкие накладки на бок
  const bandProf = new Profile()
    .arc(-rf, -D2 + rf, rf, aB + 0.12, 0, 10)
    .to(0, D2 - rf)
    .arc(-rf, D2 - rf, rf, 0, aF - 0.12, 10)
    .build()
    .map((q) => ({ ...q, o: q.o + 0.012 }));
  for (const [x, y] of [[W / 2 - 13, H / 2], [-W / 2 + 13, H / 2], [W / 2 - 13, -H / 2], [-W / 2 + 13, -H / 2], [-W / 2, H / 2 - 19], [W / 2, -H / 2 + 24]]) {
    const s = nearestS(outline, x, y);
    add(sweep(slice(outline, s - 0.45, s + 0.45, 4), bandProf, { closed: false }), M.band);
  }

  // ---- стёкла ----
  add(back.edge, M.glassEdge);
  add(back.face, M.glass);
  add(front.edge, M.frontEdge);
  add(front.face, M.screen);

  // ---- плато камеры ----
  const plG = new THREE.Group();
  plG.position.set(PLATEAU.x, PLATEAU.y, 0);
  group.add(plG);
  const pl = plate(pOut, { inset: 0, base: D2 - 0.2, top: -Z_PLATEAU, r: 1.0, dir: -1 });
  add(pl.edge, M.plateau, plG);
  add(pl.face, M.plateauTop, plG);

  // объектив: металлический «стакан» высотой 1.8 мм с полированной фаской, чёрная наклонная
  // оправа и почти плоское сапфировое стекло над тёмной линзой
  const ringGeo = sweep(lathe(128), new Profile()
    .to(LENS_R, -0.3).to(LENS_R, 1.6)
    .arc(LENS_R - 0.2, 1.6, 0.2, 0, Math.PI / 2, 5)
    .to(8.1, 1.8).hard()
    .to(7.8, 1.6).hard()
    .to(7.8, 1.2)
    .build());
  const bezelGeo = sweep(lathe(128), new Profile().to(7.82, 1.58).to(6.3, 1.24).hard().to(6.3, 0.9).build());
  const floorGeo = disc(6.32, 0.9, 1, 96);
  const Rs = (6 ** 2 + 0.16 ** 2) / (2 * 0.16), cz = 1.12 - Rs;
  const domeGeo = sweep(lathe(128), new Profile().arc(0, cz, Rs, Math.acos(6 / Rs), Math.PI / 2, 12).build());
  for (const c of CAMS) {
    const g = new THREE.Group();
    g.position.set(c.x, c.y, Z_PLATEAU);
    g.rotation.y = Math.PI;
    plG.add(g);
    add(ringGeo, M.ring, g);
    add(bezelGeo, M.bezel, g);
    add(floorGeo, M.barrel, g);
    add(domeGeo, c.key === 'tele' ? M.tele : M.lens, g);
  }
  // вспышка, LiDAR, микрофон
  for (const [p, mat] of [[FLASH, M.flash], [LIDAR, M.lidar]]) {
    add(disc(p.r + 0.22, Z_PLATEAU - 0.06, -1), M.black, plG).position.set(p.x, p.y, 0);
    add(disc(p.r, Z_PLATEAU - 0.12, -1), mat, plG).position.set(p.x, p.y, 0);
  }
  add(disc(MIC.r, Z_PLATEAU - 0.06, -1, 32), M.black, plG).position.set(MIC.x, MIC.y, 0);

  // ---- кнопки на боках (side: −1 левый, +1 правый) ----
  const onSide = (side, y, parts) => {
    const g = new THREE.Group();
    for (const [geo, mat] of parts) add(geo, mat, g);
    orient(g, V(0, 1, 0), V(0, 0, side), V(side, 0, 0));
    g.position.set((side * W) / 2, y, 0);
    group.add(g);
  };
  const btn = (len, wid, out) => plate(stadium(len, wid, 96), { base: -0.4, top: out, r: 0.28 });
  for (const [side, y, len] of [[-1, H / 2 - 30, 7.6], [-1, H / 2 - 47, 11.2], [-1, H / 2 - 61, 11.2], [1, H / 2 - 52, 19.5]]) {
    const b = btn(len, 3.0, 0.55);
    onSide(side, y, [[b.edge, M.frame], [b.face, M.frame]]);
  }
  const ccRing = plate(stadium(19.4, 4.4, 96), { base: -0.3, top: 0.05, r: 0.04 });
  const ccGlass = plate(stadium(18.4, 3.5, 96), { base: -0.3, top: 0.14, r: 0.1 });
  onSide(1, H / 2 - 108, [[ccRing.edge, M.ring], [ccRing.face, M.ring], [ccGlass.edge, M.sapphire], [ccGlass.face, M.sapphire]]);

  // ---- низ: USB-C, решётки динамиков, винты ----
  const onBottom = (x, parts) => {
    const g = new THREE.Group();
    for (const [geo, mat] of parts) add(geo, mat, g);
    orient(g, V(1, 0, 0), V(0, 0, 1), V(0, -1, 0));
    g.position.set(x, -H / 2, 0);
    group.add(g);
  };
  const port = plate(stadium(8.9, 3.1, 96), { base: -0.3, top: 0.03, r: 0.02 });
  const tongue = plate(stadium(6.2, 0.75, 48), { base: -0.3, top: 0.05, r: 0.02 });
  onBottom(0, [[port.edge, M.black], [port.face, M.black], [tongue.face, M.barrel]]);
  const hole = disc(0.55, 0.03, 1, 24);
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) onBottom(s * (10.6 + i * 2.3), [[hole, M.black]]);
  for (const s of [-1, 1]) onBottom(s * 6.7, [[disc(0.62, 0.03, 1, 32), M.chrome], [disc(0.28, 0.05, 1, 16), M.black]]);

  // ---- слои экрана для «разлёта» ----
  for (const l of scr.layers) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(scr.Wmm, l.hmm),
      new THREE.MeshBasicMaterial({ map: l.texture, transparent: true, depthWrite: false, opacity: 1 }),
    );
    m.position.set(0, l.ymm, D2 + 0.14);
    m.renderOrder = 2;
    m.visible = false;
    l.mesh = m;
    group.add(m);
  }

  // ---- якоря для выносок (мм, оси телефона) ----
  const P = (x, y, z) => V(PLATEAU.x + x, PLATEAU.y + y, z);
  const anchors = {
    action: V(-W / 2 - 0.6, H / 2 - 30, 0),
    volume: V(-W / 2 - 0.6, H / 2 - 54, 0),
    antennaL: V(-W / 2 - 0.05, H / 2 - 19, 0),
    band: V(-W / 2, -24, -1.2),
    side: V(W / 2 + 0.6, H / 2 - 52, 0),
    control: V(W / 2 + 0.15, H / 2 - 108, 0),
    usb: V(0, -H / 2 - 0.05, 0),
    main: P(CAMS[0].x, CAMS[0].y, Z_PLATEAU - 1.0),
    ultra: P(CAMS[1].x, CAMS[1].y, Z_PLATEAU - 1.0),
    tele: P(CAMS[2].x, CAMS[2].y, Z_PLATEAU - 1.0),
    flash: P(FLASH.x, FLASH.y, Z_PLATEAU),
    lidar: P(LIDAR.x, LIDAR.y, Z_PLATEAU),
    plateau: P(0, 0, Z_PLATEAU),
  };

  const band = new THREE.Color();
  function setFinish(f) {
    M.glass.color.copy(f.glass);
    M.glassEdge.color.copy(f.glass);
    M.glass.sheenColor.copy(f.glass).lerp(band.setRGB(1, 1, 1), 0.6);
    M.plateau.color.copy(f.plateau);
    M.plateauTop.color.copy(f.plateau);
    M.frame.color.copy(f.frame);
    M.ring.color.copy(f.ring);
    M.band.color.copy(f.frame).multiplyScalar(0.42);
  }

  let exploded = false;
  function setScreen(on, e) {
    M.screen.emissiveIntensity = on;
    const ex = e > 0.002 && on > 0.01;
    if (ex !== exploded) { exploded = ex; M.screen.emissiveMap = ex ? scr.texBase : scr.texFull; }
    for (const l of scr.layers) {
      l.mesh.visible = ex;
      l.mesh.position.z = D2 + 0.14 + e * l.lift;
      l.mesh.material.opacity = on;
      l.mesh.scale.setScalar(1 + e * 0.03);
    }
  }

  return { group, M, anchors, setFinish, setScreen, redraw: (pal) => scr.draw(pal, new Date()) };
}
