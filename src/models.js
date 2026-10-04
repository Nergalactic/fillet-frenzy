// Low-poly models. Everything sits with its base at y = 0 and faces +z.
import * as THREE from 'three';

const mats = new Map();
export function mat(color, opts = {}) {
  const key = color + JSON.stringify(opts);
  if (!mats.has(key)) mats.set(key, new THREE.MeshLambertMaterial({ color, flatShading: true, ...opts }));
  return mats.get(key);
}
const geos = new Map();
function geo(key, make) { if (!geos.has(key)) geos.set(key, make()); return geos.get(key); }

export function part(group, g, color, x = 0, y = 0, z = 0, shadow = true) {
  const m = new THREE.Mesh(g, typeof color === 'number' ? mat(color) : color);
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  group.add(m);
  return m;
}
const box = (w, h, d) => geo(`b${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
const cyl = (rt, rb, h, s = 10) => geo(`c${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const sph = (r, w = 8, h = 6) => geo(`s${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));

// ---------- people ----------
// Returns { group, legs, arms } so the caller can animate walking.
export function person({ shirt = 0xffffff, pants = 0x3d405b, skin = 0xf1c27d, hat = null, apron = null, hair = 0x4a3426 } = {}) {
  const g = new THREE.Group();
  const legs = [], arms = [];
  for (const x of [-0.17, 0.17]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.75, 0);
    part(pivot, box(0.24, 0.75, 0.26), pants, 0, -0.375, 0);
    part(pivot, box(0.26, 0.12, 0.34), 0x2b2b2b, 0, -0.7, 0.04);
    g.add(pivot);
    legs.push(pivot);
  }
  part(g, box(0.62, 0.72, 0.38), shirt, 0, 1.12, 0);
  if (apron) part(g, box(0.5, 0.8, 0.05), apron, 0, 1.0, 0.21);
  for (const x of [-0.4, 0.4]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.42, 0);
    part(pivot, box(0.18, 0.6, 0.2), shirt, 0, -0.28, 0);
    part(pivot, box(0.16, 0.14, 0.16), skin, 0, -0.62, 0);
    g.add(pivot);
    arms.push(pivot);
  }
  part(g, sph(0.27, 10, 8), skin, 0, 1.75, 0);
  part(g, box(0.07, 0.07, 0.04), 0x222222, -0.1, 1.8, 0.25);
  part(g, box(0.07, 0.07, 0.04), 0x222222, 0.1, 1.8, 0.25);
  if (hat === 'chef') {
    part(g, cyl(0.24, 0.24, 0.22, 12), 0xffffff, 0, 2.02, 0);
    part(g, sph(0.32, 10, 6), 0xffffff, 0, 2.22, 0).scale.set(1, 0.6, 1);
  } else if (typeof hat === 'number') {
    part(g, cyl(0.29, 0.29, 0.14, 12), hat, 0, 1.97, 0);
    part(g, box(0.3, 0.04, 0.22), hat, 0, 1.92, 0.3);
  } else {
    part(g, sph(0.28, 10, 6, ), hair, 0, 1.85, -0.03).scale.set(1, 0.55, 1);
  }
  return { group: g, legs, arms };
}

// ---------- items ----------
// Height of each item when stacked
export const ITEM_H = {
  salmon: 0.34, crab: 0.32, lobster: 0.34, octopus: 0.5, salmonFillet: 0.17, tentacles: 0.2,
  grilledSalmon: 0.26, smokedSalmon: 0.24, steamedCrab: 0.36, steamedLobster: 0.36, crabRoll: 0.3,
  lobsterRoll: 0.32, takoyaki: 0.3, bread: 0.3, cleanPlate: 0.08,
  sardine: 0.3, tuna: 0.42, squid: 0.75, sardineFillet: 0.17, tunaSteak: 0.22, calamari: 0.2,
  grilledSardine: 0.26, fishAndChips: 0.4, grilledTuna: 0.28, sushi: 0.3, friedCalamari: 0.3, plate: 0.1, cash: 0.06,
};

function fish(g, len, body, belly, fin) {
  const b = part(g, sph(0.5, 10, 8), body, 0, len * 0.22, 0);
  b.scale.set(len * 0.32, len * 0.3, len);
  const u = part(g, sph(0.5, 10, 8), belly, 0, len * 0.17, 0.02);
  u.scale.set(len * 0.26, len * 0.18, len * 0.85);
  const t = part(g, geo(`tail${len}`, () => new THREE.ConeGeometry(len * 0.22, len * 0.35, 4)), fin, 0, len * 0.22, -len * 0.6);
  t.rotation.x = -Math.PI / 2; t.scale.z = 0.3;
  part(g, sph(0.04 * len + 0.02, 6, 4), 0x111111, len * 0.12, len * 0.27, len * 0.33);
  part(g, sph(0.04 * len + 0.02, 6, 4), 0x111111, -len * 0.12, len * 0.27, len * 0.33);
}

function crab(g, color) {
  const b = part(g, sph(0.3, 10, 6), color, 0, 0.18, 0);
  b.scale.set(1.2, 0.5, 0.9);
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const l = part(g, box(0.04, 0.04, 0.3), color, s * 0.33, 0.08, -0.12 + i * 0.12);
      l.rotation.y = s * (Math.PI / 2 - 0.3); l.rotation.z = s * 0.4;
    }
    part(g, sph(0.1, 6, 4), color, s * 0.28, 0.2, 0.32).scale.set(1, 0.7, 1.3);
    part(g, sph(0.04, 6, 4), 0x111111, s * 0.08, 0.3, 0.22);
  }
}
function lobster(g, color) {
  const b = part(g, sph(0.2, 10, 6), color, 0, 0.16, 0);
  b.scale.set(0.8, 0.7, 2.2);
  const t = part(g, geo('ltail', () => new THREE.ConeGeometry(0.16, 0.3, 5)), color, 0, 0.12, -0.5);
  t.rotation.x = -Math.PI / 2; t.scale.z = 0.4;
  for (const s of [-1, 1]) {
    const arm = part(g, box(0.05, 0.05, 0.3), color, s * 0.15, 0.16, 0.48);
    arm.rotation.y = s * 0.4;
    part(g, sph(0.11, 6, 4), color, s * 0.24, 0.17, 0.66).scale.set(0.8, 0.6, 1.4);
    part(g, cyl(0.01, 0.01, 0.5, 3), 0x7a2a1a, s * 0.06, 0.25, 0.55).rotation.x = Math.PI / 2 - 0.3;
  }
}
function octopus(g, color) {
  part(g, sph(0.28, 10, 8), color, 0, 0.32, -0.05).scale.set(1, 1.1, 1.2);
  part(g, sph(0.05, 6, 4), 0xffffff, 0.12, 0.35, 0.22); part(g, sph(0.05, 6, 4), 0xffffff, -0.12, 0.35, 0.22);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const t = part(g, cyl(0.06, 0.03, 0.55, 5), color, Math.cos(a) * 0.25, 0.08, Math.sin(a) * 0.25 + 0.05);
    t.rotation.z = Math.cos(a) * 1.2; t.rotation.x = -Math.sin(a) * 1.2;
  }
}

function plateUnder(g) { part(g, cyl(0.42, 0.36, 0.06, 14), 0xf8f8f4, 0, 0.03, 0); }
function grillMarks(g, y, w, color = 0x3b2414) {
  for (const x of [-0.12, 0.05, 0.22]) part(g, box(0.04, 0.01, w), color, x - 0.05, y, 0, false).rotation.y = 0.5;
}

export function item(type) {
  const g = new THREE.Group();
  switch (type) {
    case 'sardine': fish(g, 0.8, 0x9fb3c2, 0xe6eef2, 0x7f93a2); break;
    case 'tuna': fish(g, 1.25, 0x2c4f7c, 0xdfe6ec, 0xf2c94c); break;
    case 'squid': {
      const b = part(g, geo('sqb', () => new THREE.ConeGeometry(0.32, 1.0, 8)), 0xe86f8a, 0, 0.35, -0.2);
      b.rotation.x = -Math.PI / 2;
      part(g, sph(0.3, 10, 8), 0xf08aa2, 0, 0.32, 0.35);
      part(g, sph(0.07, 6, 4), 0x111111, 0.2, 0.42, 0.5);
      part(g, sph(0.07, 6, 4), 0x111111, -0.2, 0.42, 0.5);
      for (let i = 0; i < 6; i++) {
        const tn = part(g, cyl(0.05, 0.03, 0.8, 5), 0xd95c78, (i - 2.5) * 0.1, 0.15, 0.8);
        tn.rotation.x = Math.PI / 2 - 0.2; tn.rotation.z = (i - 2.5) * 0.12;
      }
      break;
    }
    case 'sardineFillet':
      part(g, box(0.8, 0.12, 0.36), 0xf4a582, 0, 0.06, 0);
      part(g, box(0.78, 0.02, 0.06), 0xffd3bd, 0, 0.125, 0);
      break;
    case 'tunaSteak':
      part(g, box(0.7, 0.18, 0.5), 0xb3263a, 0, 0.09, 0);
      part(g, box(0.72, 0.02, 0.06), 0xe58a98, 0, 0.18, 0.1);
      break;
    case 'calamari':
      for (const [x, z] of [[-0.2, 0], [0.2, 0.05], [0, -0.18]]) {
        const r = part(g, geo('ring', () => new THREE.TorusGeometry(0.15, 0.06, 6, 12)), 0xf6e3d8, x, 0.07, z);
        r.rotation.x = Math.PI / 2;
      }
      break;
    case 'grilledSardine':
      plateUnder(g);
      for (const z of [-0.1, 0.1]) { const f = new THREE.Group(); fish(f, 0.55, 0xa8763e, 0xc9975a, 0x7a522a); f.position.set(0, 0.04, z); f.rotation.y = Math.PI / 2; g.add(f); }
      part(g, sph(0.07, 6, 4), 0xf7e05a, 0.28, 0.1, 0.15);
      break;
    case 'fishAndChips':
      part(g, box(0.6, 0.22, 0.42), 0xe63946, 0, 0.11, 0);
      part(g, box(0.62, 0.05, 0.44), 0xffffff, 0, 0.2, 0);
      part(g, box(0.36, 0.13, 0.2), 0xe0a63a, -0.08, 0.3, 0.06).rotation.y = 0.3;
      for (let i = 0; i < 5; i++) part(g, box(0.05, 0.22, 0.05), 0xf6d55c, 0.14 + (i % 3) * 0.06, 0.32, -0.08 + (i % 2) * 0.06).rotation.z = (i - 2) * 0.15;
      break;
    case 'grilledTuna':
      plateUnder(g);
      part(g, box(0.5, 0.16, 0.36), 0x7a3b2a, 0, 0.14, 0);
      grillMarks(g, 0.225, 0.36);
      part(g, box(0.12, 0.04, 0.12), 0x6bbf59, 0.25, 0.08, 0.15);
      break;
    case 'sushi':
      part(g, box(0.8, 0.08, 0.42), 0xb07c4a, 0, 0.04, 0);
      for (let i = 0; i < 4; i++) {
        const x = -0.27 + i * 0.18;
        part(g, box(0.14, 0.1, 0.22), 0xfaf7f0, x, 0.13, 0);
        part(g, box(0.15, 0.05, 0.24), i % 2 ? 0xff8c5a : 0xd8344a, x, 0.2, 0);
      }
      break;
    case 'friedCalamari':
      plateUnder(g);
      for (const [x, z, y] of [[-0.15, 0, 0.1], [0.15, 0.06, 0.1], [0, -0.14, 0.1], [0, 0.04, 0.18]]) {
        const r = part(g, geo('fring', () => new THREE.TorusGeometry(0.13, 0.065, 6, 12)), 0xe2a13f, x, y, z);
        r.rotation.x = Math.PI / 2;
      }
      part(g, sph(0.07, 6, 4), 0xf7e05a, 0.28, 0.1, 0.18);
      break;
    case 'salmon': fish(g, 1.0, 0x8a9aa8, 0xf2b8a0, 0x6f7f8c); break;
    case 'crab': crab(g, 0xd9482b); break;
    case 'lobster': lobster(g, 0x2e4a7d); break;
    case 'octopus': octopus(g, 0xb04a8f); break;
    case 'salmonFillet':
      part(g, box(0.8, 0.12, 0.38), 0xff8a5b, 0, 0.06, 0);
      for (const x of [-0.2, 0, 0.2]) part(g, box(0.03, 0.01, 0.36), 0xffd2bd, x, 0.125, 0, false);
      break;
    case 'tentacles':
      for (let i = 0; i < 4; i++) {
        const t = part(g, cyl(0.06, 0.03, 0.7, 5), 0xc65fa0, -0.2 + i * 0.13, 0.08, 0);
        t.rotation.x = Math.PI / 2; t.rotation.z = (i - 1.5) * 0.15;
      }
      break;
    case 'grilledSalmon':
      plateUnder(g);
      part(g, box(0.5, 0.12, 0.3), 0xe0703e, 0, 0.12, 0);
      grillMarks(g, 0.185, 0.3);
      part(g, sph(0.07, 6, 4), 0xf7e05a, 0.28, 0.1, 0.15);
      break;
    case 'smokedSalmon':
      part(g, box(0.75, 0.06, 0.45), 0x8a5a33, 0, 0.03, 0);
      for (let i = 0; i < 4; i++) part(g, box(0.16, 0.05, 0.36), 0xf26b3a, -0.25 + i * 0.17, 0.09, 0).rotation.z = 0.25;
      part(g, box(0.1, 0.04, 0.1), 0x6bbf59, 0.3, 0.12, 0.12);
      break;
    case 'steamedCrab': plateUnder(g); { const c = new THREE.Group(); crab(c, 0xf05a3a); c.scale.setScalar(0.8); c.position.y = 0.04; g.add(c); } break;
    case 'steamedLobster': plateUnder(g); { const c = new THREE.Group(); lobster(c, 0xe8452c); c.scale.setScalar(0.75); c.position.y = 0.04; g.add(c); } break;
    case 'bread':
      part(g, box(0.62, 0.24, 0.34), 0xd99a4e, 0, 0.12, 0);
      part(g, cyl(0.17, 0.17, 0.62, 10), 0xe4ac60, 0, 0.24, 0).rotation.z = Math.PI / 2;
      break;
    case 'crabRoll':
    case 'lobsterRoll': {
      part(g, box(0.7, 0.14, 0.32), 0xe4ac60, 0, 0.07, 0);
      const fill = type === 'lobsterRoll' ? 0xf06a4a : 0xf3a07a;
      for (let i = 0; i < 4; i++) part(g, sph(0.09, 6, 4), fill, -0.24 + i * 0.16, 0.18, 0);
      part(g, box(0.62, 0.04, 0.1), 0x6bbf59, 0, 0.15, 0.12);
      if (type === 'lobsterRoll') part(g, box(0.72, 0.03, 0.34), 0xffd23f, 0, 0.01, 0, false);
      break;
    }
    case 'takoyaki':
      part(g, box(0.62, 0.06, 0.4), 0xc8955c, 0, 0.03, 0);
      for (let i = 0; i < 6; i++) {
        part(g, sph(0.1, 8, 6), 0xd38a3a, -0.18 + (i % 3) * 0.18, 0.13, i < 3 ? -0.09 : 0.09);
        part(g, box(0.12, 0.01, 0.03), 0x3b2414, -0.18 + (i % 3) * 0.18, 0.235, i < 3 ? -0.09 : 0.09, false);
      }
      break;
    case 'cleanPlate':
      part(g, cyl(0.42, 0.36, 0.06, 14), 0xffffff, 0, 0.03, 0);
      part(g, cyl(0.3, 0.3, 0.01, 14), 0xe8f4ff, 0, 0.065, 0, false);
      break;
    case 'plate':
      plateUnder(g);
      part(g, box(0.18, 0.01, 0.12), 0x8a6a3a, 0.08, 0.065, -0.05, false);
      part(g, box(0.1, 0.01, 0.08), 0x8a6a3a, -0.12, 0.065, 0.08, false);
      break;
    case 'cash':
      part(g, box(0.62, 0.05, 0.32), 0x5cb85c, 0, 0.03, 0);
      part(g, box(0.2, 0.052, 0.2), 0x8fd18f, 0, 0.03, 0, false);
      break;
  }
  return g;
}

// ---------- stations ----------
function table(g, w, d, top = 0xc8955c, leg = 0x8d5f35) {
  part(g, box(w, 0.16, d), top, 0, 1.0, 0);
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) part(g, box(0.14, 1.0, 0.14), leg, x * (w / 2 - 0.15), 0.5, z * (d / 2 - 0.15));
}

export function station(type) {
  const g = new THREE.Group();
  const anim = {};
  if (type === 'cut') {
    table(g, 3.2, 1.6);
    part(g, box(1.4, 0.12, 0.9), 0xe7c08d, 0, 1.14, 0);
    const knife = new THREE.Group();
    part(knife, box(0.08, 0.06, 0.6), 0x3b2b20, 0, 0, -0.35);
    part(knife, box(0.04, 0.22, 0.7), 0xd9dee2, 0, -0.06, 0.3);
    knife.position.set(0.45, 1.5, 0);
    g.add(knife);
    anim.knife = knife;
  } else if (type === 'grill') {
    part(g, box(3.2, 1.0, 1.6), 0x3a3d42, 0, 0.5, 0);
    part(g, box(2.4, 0.08, 1.2), mat(0xff7a2a, { emissive: 0xc2410c }), 0, 1.02, 0, false);
    for (let i = 0; i < 9; i++) part(g, box(0.05, 0.05, 1.25), 0x1c1c1c, -1.1 + i * 0.275, 1.1, 0, false);
    part(g, cyl(0.12, 0.12, 1.2, 8), 0x55595f, 1.3, 1.6, -0.6);
    anim.smoke = true;
  } else if (type === 'fryer') {
    part(g, box(3.0, 1.1, 1.6), 0xc9d1d6, 0, 0.55, 0);
    part(g, box(2.4, 0.06, 1.1), mat(0xf2c14e, { emissive: 0x7a5200 }), 0, 1.11, 0, false);
    for (const x of [-0.6, 0.6]) {
      part(g, box(0.9, 0.3, 0.8), mat(0x9aa3ab, { wireframe: true }), x, 1.25, 0, false);
      part(g, box(0.06, 0.06, 0.8), 0x2b2b2b, x, 1.45, 0.75);
    }
    anim.bubbles = true;
  } else if (type === 'sushi') {
    table(g, 3.2, 1.6, 0xd9b38c, 0x6b4a2b);
    part(g, box(1.6, 0.04, 1.0), 0x7fa650, 0, 1.1, 0);
    for (let i = 0; i < 8; i++) part(g, box(1.6, 0.045, 0.03), 0x5e7f38, 0, 1.11, -0.45 + i * 0.13, false);
    part(g, box(0.6, 0.4, 0.4), 0x2b2b2b, -1.1, 1.3, -0.5);
  } else if (type === 'smoker') {
    part(g, box(2.6, 1.8, 1.6), 0x5b4a3f, 0, 0.9, 0);
    part(g, box(2.7, 0.15, 1.7), 0x3b2f28, 0, 1.85, 0);
    part(g, box(1.2, 0.9, 0.05), 0x2b2b2b, 0, 1.0, 0.82);
    part(g, cyl(0.15, 0.15, 1.2, 8), 0x55595f, 0.9, 2.4, -0.4);
    anim.smoke = true;
  } else if (type === 'steam') {
    part(g, box(3.0, 0.8, 1.6), 0x8d969c, 0, 0.4, 0);
    part(g, cyl(0.75, 0.65, 0.9, 14), 0xb8c0c6, 0, 1.25, 0);
    part(g, cyl(0.78, 0.78, 0.08, 14), 0x8d969c, 0, 1.72, 0);
    part(g, sph(0.12, 6, 4), 0x2b2b2b, 0, 1.82, 0);
    anim.steam = true;
  } else if (type === 'bakery') {
    part(g, box(2.8, 1.8, 1.8), 0xc9733e, 0, 0.9, 0);
    const dome = part(g, sph(1.2, 12, 8, ), 0xb5612f, 0, 1.8, 0);
    dome.scale.set(1.1, 0.6, 0.75);
    part(g, box(0.9, 0.6, 0.05), mat(0xff9a3c, { emissive: 0xc2410c }), 0, 1.0, 0.92, false);
    part(g, cyl(0.2, 0.2, 1.0, 8), 0x8a4a28, 0.8, 2.5, -0.3);
    anim.smoke = true;
  } else if (type === 'roll') {
    table(g, 3.2, 1.6, 0xf4e3c3, 0x8d5f35);
    for (let i = 0; i < 3; i++) part(g, box(0.5, 0.2, 0.3), 0xe4ac60, -0.9 + i * 0.6, 1.2, -0.45);
    part(g, box(0.9, 0.06, 0.6), 0xffffff, 0.6, 1.11, 0.2);
  } else if (type === 'griddle') {
    part(g, box(3.0, 1.0, 1.6), 0x2b2d42, 0, 0.5, 0);
    part(g, box(2.6, 0.12, 1.3), 0x1c1c1c, 0, 1.06, 0);
    for (let i = 0; i < 12; i++) part(g, cyl(0.16, 0.16, 0.02, 10), mat(0x6b3a1a, { emissive: 0x3a1a05 }), -1.0 + (i % 6) * 0.4, 1.13, i < 6 ? -0.3 : 0.3, false);
    anim.smoke = true;
  } else if (type === 'sink') {
    part(g, box(3.0, 1.0, 1.6), 0xd9dee2, 0, 0.5, 0);
    part(g, box(2.2, 0.1, 1.1), mat(0x7fc8f0, { emissive: 0x1d5a7a }), 0, 1.02, 0, false);
    part(g, cyl(0.05, 0.05, 0.8, 6), 0x9aa3ab, 0, 1.4, -0.6);
    part(g, box(0.05, 0.05, 0.4), 0x9aa3ab, 0, 1.8, -0.42);
    anim.bubbles = true;
  } else if (type === 'dock') {
    for (let i = 0; i < 6; i++) part(g, box(4.2, 0.18, 0.9), i % 2 ? 0xa77a4b : 0xb98a5a, 0, -0.02, 2.6 - i * 1.0);
    for (const [x, z] of [[-1.9, -2.6], [1.9, -2.6], [-1.9, 0.2], [1.9, 0.2]]) part(g, cyl(0.2, 0.2, 2.4, 8), 0x7a5634, x, -1.0, z);
    for (const [x, z] of [[-1.2, 2.4], [-0.4, 2.6]]) part(g, box(0.7, 0.6, 0.7), 0xc8955c, x, 0.3, z);
  }
  return { group: g, anim };
}

// A crab/lobster trap: a cage that sits in the water and bobs up when something's caught
export function trap() {
  const g = new THREE.Group();
  const wire = mat(0x6c757d, { wireframe: true });
  part(g, box(0.9, 0.6, 0.9), wire, 0, 0.3, 0, false);
  part(g, box(0.95, 0.06, 0.95), 0x5b4a3f, 0, 0.0, 0);
  part(g, sph(0.15, 8, 6), 0xff9f1c, 0, 1.0, 0);
  return g;
}

export function counterModel() {
  const g = new THREE.Group();
  part(g, box(5.2, 1.1, 1.6), 0x9c6b3f, 0, 0.55, 0);
  part(g, box(5.4, 0.12, 1.8), 0xe9d7b8, 0, 1.16, 0);
  return g;   // the renderer adds the registers and stretches the counter as more open
}

export function tableModel() {
  const g = new THREE.Group();
  part(g, cyl(1.0, 1.0, 0.12, 14), 0xf4efe6, 0, 0.95, 0);
  part(g, cyl(0.1, 0.12, 0.95, 8), 0x8d969c, 0, 0.47, 0);
  for (const z of [-1.3, 1.3]) part(g, cyl(0.35, 0.35, 0.55, 10), 0x4fa3c7, 0, 0.27, z);
  part(g, cyl(0.05, 0.05, 2.0, 6), 0xdddddd, 0, 1.9, 0);
  const um = part(g, geo('umb', () => new THREE.ConeGeometry(0.9, 0.4, 8, 1, true)), mat(0xff6b5a, { side: THREE.DoubleSide }), 0, 3.05, 0);
  um.castShadow = true;
  return g;
}

export function binModel() {
  const g = new THREE.Group();
  part(g, cyl(0.55, 0.45, 1.2, 12), 0x2e7d4f, 0, 0.6, 0);
  part(g, cyl(0.6, 0.6, 0.12, 12), 0x24633e, 0, 1.24, 0);
  return g;
}

export function palm(rng) {
  const g = new THREE.Group();
  const h = 4 + rng() * 2;
  for (let i = 0; i < 6; i++) {
    const s = part(g, cyl(0.22 - i * 0.015, 0.26 - i * 0.015, h / 6, 7), 0x9c7a4f, Math.sin(i * 0.5) * 0.15 * i, (i + 0.5) * (h / 6), 0);
    s.rotation.z = 0.05 * i;
  }
  for (let i = 0; i < 7; i++) {
    const leaf = part(g, box(0.5, 0.06, 2.2), 0x4caf50, 0, h + 0.1, 0);
    leaf.geometry = box(0.5, 0.06, 2.2);
    leaf.position.set(Math.sin((i / 7) * 6.28) * 0.9 + 0.5, h, Math.cos((i / 7) * 6.28) * 0.9);
    leaf.rotation.y = (i / 7) * 6.28;
    leaf.rotation.x = 0.35;
  }
  return g;
}
