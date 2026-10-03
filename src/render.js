// Draws the game state. Logic never touches Three.js; this file reads `g` and reacts to g.events.
import * as THREE from 'three';
import {
  ITEMS, AREAS, PLACES, STATIONS, SPOTS, TABLES, STATION_LABELS, SELL_PAD,
} from './config.js';
import { visiblePads, padPos, ZONE, TABLE_ZONE } from './logic.js';
import * as M from './models.js';
import { sfx } from './sound.js';

// ---------- text labels ----------
function labelTexture(lines, { bg = 'rgba(255,255,255,0.95)', fg = '#1d2b36', w = 512, h = 192, radius = 36 } = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const draw = () => {
    g.clearRect(0, 0, w, h);
    if (bg) {
      g.fillStyle = bg;
      g.beginPath(); g.roundRect(6, 6, w - 12, h - 12, radius); g.fill();
    }
    g.textAlign = 'center'; g.textBaseline = 'middle';
    lines.forEach((l, i) => {
      let size = l.size;
      const font = () => `${size}px "Lilita One", system-ui, sans-serif`;
      g.font = font();
      while (g.measureText(l.text).width > w * 0.86 && size > 10) { size -= 2; g.font = font(); }
      g.fillStyle = l.color || fg;
      g.fillText(l.text, w / 2, h * ((i + 0.5) / lines.length) + (lines.length > 1 ? (i ? -6 : 6) : 0));
    });
    tex.needsUpdate = true;
  };
  draw();
  document.fonts?.load('40px "Lilita One"').then(draw, () => {});
  return tex;
}

function sprite(lines, scale = 2.6, opts) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(lines, opts), depthWrite: false }));
  const w = opts?.w || 512, h = opts?.h || 192;
  s.scale.set(scale, scale * (h / w), 1);
  s.renderOrder = 10;
  return s;
}

function ring(r, color, opacity = 0.75) {
  const m = new THREE.Mesh(new THREE.RingGeometry(r - 0.14, r, 40), new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, depthWrite: false,
  }));
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.12;
  return m;
}

function flat(w, d, color, x, z, y) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), M.mat(color));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

const RIGS = {
  player: { shirt: 0xffffff, apron: 0xe63946, hat: 'chef' },
  fisher: { shirt: 0x8ecae6, pants: 0x264653, hat: 0x2b7bb9 },
  runner: { shirt: 0xffffff, apron: 0xf4a261, hat: 'chef' },
  server: { shirt: 0x2b2d42, pants: 0x2b2d42, apron: 0xffffff, hat: 0x2a9d8f },
  busser: { shirt: 0xadb5bd, apron: 0x6c757d, hat: 0x6c757d },
};
const HELPER_NAMES = { fisher: 'FISHER', runner: 'RUNNER', server: 'SERVER', busser: 'BUSSER' };
const SPOT_NAMES = { sardine: 'SARDINES', tuna: 'TUNA', squid: 'GIANT SQUID' };

export function createRenderer(g, scene, { popup }) {
  const rng = (() => { let s = 11; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const tmp = new THREE.Vector3();

  // ---------- static world ----------
  const waterGeo = new THREE.PlaneGeometry(420, 300, 70, 50);
  const water = new THREE.Mesh(waterGeo, new THREE.MeshLambertMaterial({ color: 0x3aa6d8, flatShading: true }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, -0.55, -120);
  water.receiveShadow = true;
  scene.add(water);
  const waterBase = Float32Array.from(waterGeo.attributes.position.array);

  const sand = new THREE.Mesh(new THREE.BoxGeometry(140, 1.2, 70), M.mat(0xf1d7a1));
  sand.position.set(0, -0.6, 34);
  sand.receiveShadow = true;
  scene.add(sand);
  scene.add(flat(140, 3, 0xe4c58a, 0, 0.5, 0.01)); // wet sand by the shore

  // Shack with sign
  const shack = new THREE.Group();
  M.part(shack, new THREE.BoxGeometry(7, 3.6, 4.4), 0xd9a066, 0, 1.8, 0);
  const roof = M.part(shack, new THREE.ConeGeometry(5.6, 2.2, 4), 0x2a9d8f, 0, 4.7, 0);
  roof.rotation.y = Math.PI / 4; roof.scale.z = 0.7;
  M.part(shack, new THREE.BoxGeometry(1.4, 2.2, 0.1), 0x7a4a24, 1.8, 1.1, 2.22);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshLambertMaterial({
    map: labelTexture([{ text: 'FILLET FRENZY', size: 110 }], { bg: '#fff3d6', fg: '#d9480f', w: 1024, h: 256, radius: 40 }),
  }));
  sign.position.set(0, 3.1, 2.25);
  shack.add(sign);
  shack.position.set(PLACES.shack.x, 0, PLACES.shack.z);
  scene.add(shack);

  // Counter, cash spot, bin
  const counter = M.counterModel();
  counter.position.set(PLACES.counter.x, 0, PLACES.counter.z);
  scene.add(counter);
  const counterLabel = sprite([{ text: 'COUNTER', size: 80 }], 3.6);
  counterLabel.position.set(PLACES.counter.x, 3.0, PLACES.counter.z);
  scene.add(counterLabel);
  const dropRing = ring(ZONE, 0xffd166);
  dropRing.position.set(PLACES.counter.drop.x, 0.12, PLACES.counter.drop.z);
  scene.add(dropRing);
  const cashRing = ring(ZONE, 0x7ee07e);
  cashRing.position.set(PLACES.counter.cash.x, 0.12, PLACES.counter.cash.z);
  scene.add(cashRing);
  const bin = M.binModel();
  bin.position.set(PLACES.bin.x, 0, PLACES.bin.z);
  scene.add(bin);
  const binLabel = sprite([{ text: 'TRASH', size: 80 }], 2.4, { bg: 'rgba(46,125,79,0.9)', fg: '#ffffff' });
  binLabel.position.set(PLACES.bin.x, 2.4, PLACES.bin.z);
  scene.add(binLabel);
  const binRing = ring(ZONE + 0.5, 0xb0b0b0, 0.5);
  binRing.position.set(PLACES.bin.x, 0.12, PLACES.bin.z);
  scene.add(binRing);

  for (let i = 0; i < 14; i++) {
    const p = M.palm(rng);
    const side = i % 2 ? 1 : -1;
    p.position.set(side * (31 + rng() * 6), 0, 2 + rng() * 32);
    p.rotation.y = rng() * 6;
    scene.add(p);
  }

  // ---------- pier sections ----------
  const piers = new Set();
  function addPier(id) {
    if (piers.has(id) || id === 'beach') return;
    piers.add(id);
    const r = AREAS[id];
    const grp = new THREE.Group();
    for (let z = r.z0 + 0.5; z < r.z1; z += 1) {
      M.part(grp, new THREE.BoxGeometry(r.x1 - r.x0, 0.2, 0.92), ((z | 0) % 2) ? 0xb98a5a : 0xa77a4b, (r.x0 + r.x1) / 2, -0.02, z);
    }
    for (let z = r.z0 + 0.6; z < r.z1; z += 4) {
      for (const x of [r.x0 + 0.3, r.x1 - 0.3]) M.part(grp, new THREE.CylinderGeometry(0.25, 0.25, 2.4, 8), 0x7a5634, x, -1.2, z);
    }
    scene.add(grp);
  }

  // ---------- containers ----------
  const hidden = {};                  // items still flying toward a container, hidden at the destination
  const hide = (id) => hidden[id] || 0;
  const pileY = (list, i, base) => { let y = base; for (let k = 0; k < i; k++) y += M.ITEM_H[list[k]] || 0.2; return y; };

  function syncPile(holder, list, place, hiddenN, key) {
    const want = list.join('|');
    if (holder.key !== want) {
      for (const m of holder.meshes) holder.parent.remove(m);
      holder.meshes = list.map((it) => { const m = M.item(it); holder.parent.add(m); return m; });
      holder.key = want;
    }
    holder.meshes.forEach((m, i) => { place(m, i); m.visible = i < list.length - hiddenN; });
  }

  // Stations
  const stations = {};
  function addStation(id) {
    if (stations[id]) return;
    const cfg = STATIONS[id];
    const { group, anim } = M.station(cfg.type);
    group.position.set(cfg.x, 0, cfg.z);
    scene.add(group);
    const label = sprite([{ text: STATION_LABELS[cfg.type], size: 80 }], 3.8);
    label.position.set(cfg.x, 3.1, cfg.z);
    scene.add(label);
    const inR = ring(ZONE, 0x5ad1ff); inR.position.set(cfg.in.x, 0.12, cfg.in.z);
    const outR = ring(ZONE, 0x7ee07e); outR.position.set(cfg.out.x, 0.12, cfg.out.z);
    scene.add(inR, outR);
    const inPile = { parent: scene, meshes: [], key: '' }, outPile = { parent: scene, meshes: [], key: '' }, busy = { parent: scene, meshes: [], key: '' };
    stations[id] = { group, anim, inPile, outPile, busy, cfg, smokeT: 0, lastChop: 0 };
    pops.push({ obj: group, t: 0 });
  }
  const pileAt = (cfg, side) => ({ x: cfg.x + (cfg[side].x - cfg.x) * 0.38, z: cfg.z });

  // Fishing spots
  const spots = {};
  function addSpot(id) {
    if (spots[id]) return;
    const s = SPOTS[id];
    const r = ring(ZONE, 0x5ad1ff); r.position.set(s.x, 0.12, s.z);
    const label = sprite([{ text: SPOT_NAMES[s.fish], size: 80 }], 3.6, { bg: 'rgba(29,53,87,0.85)', fg: '#ffffff' });
    label.position.set(s.water.x, 2.2, s.water.z);
    const bobber = new THREE.Group();
    M.part(bobber, new THREE.SphereGeometry(0.18, 8, 6), 0xe63946, 0, 0, 0);
    M.part(bobber, new THREE.SphereGeometry(0.12, 8, 6), 0xffffff, 0, 0.12, 0);
    bobber.position.set(s.water.x, -0.4, s.water.z);
    bobber.visible = false;
    const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0x222222 }));
    line.visible = false;
    line.frustumCulled = false;
    // A little rod holder post at the edge
    const post = new THREE.Group();
    M.part(post, new THREE.CylinderGeometry(0.1, 0.1, 1.2, 6), 0x7a5634, 0, 0.6, 0);
    post.position.set(s.x + Math.sign(s.water.x - s.x || 1) * 1.5, 0, s.z + (s.water.z < s.z - 2 ? -1.5 : 0));
    scene.add(r, label, bobber, line, post);
    spots[id] = { cfg: s, bobber, line, label };
  }

  // Tables
  const tables = {};
  function addTable(id) {
    if (tables[id]) return;
    const t = TABLES[id];
    const grp = M.tableModel();
    grp.position.set(t.x, 0, t.z);
    scene.add(grp);
    const plate = M.item('plate');
    plate.position.set(t.x, 1.02, t.z);
    plate.visible = false;
    const r = ring(TABLE_ZONE, 0xff9f43, 0.6);
    r.position.set(t.x, 0.12, t.z);
    r.visible = false;
    scene.add(plate, r);
    tables[id] = { grp, plate, ring: r };
    pops.push({ obj: grp, t: 0 });
  }

  // Counter stock and cash pile
  const counterPile = { parent: scene, meshes: [], key: '' };
  const counterSlot = (i) => tmp.set(
    PLACES.counter.x - 1.4 + (i % 6) * 0.62,
    1.24 + Math.floor(i / 12) * 0.34,
    PLACES.counter.z + (Math.floor(i / 6) % 2 ? 0.4 : -0.4),
  );
  const cashBills = [];
  const cashSlot = (i) => tmp.set(
    PLACES.counter.cash.x + ((i % 4) % 2 ? 0.36 : -0.36),
    0.05 + Math.floor(i / 4) * 0.065,
    PLACES.counter.cash.z + ((i % 4) > 1 ? 0.22 : -0.22),
  );

  // Pads
  const pads = {};
  const sellPad = makePad({ label: 'SELL THE SHACK', price: null, id: 'sell' }, SELL_PAD, 0xffc94d);
  sellPad.grp.visible = false;
  function makePad(p, pos, color = 0xffe08a) {
    const grp = new THREE.Group();
    const tile = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false }));
    tile.rotation.x = -Math.PI / 2; tile.position.y = 0.1;
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.8), new THREE.MeshBasicMaterial({ color: 0x5cd65c, transparent: true, opacity: 0.8, depthWrite: false }));
    fill.rotation.x = -Math.PI / 2; fill.position.y = 0.11; fill.scale.set(1, 0.001, 1);
    const border = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(2.8, 2.8)), new THREE.LineBasicMaterial({ color: 0xffffff }));
    border.rotation.x = -Math.PI / 2; border.position.y = 0.12;
    const lines = p.price === null ? [{ text: p.label, size: 66 }, { text: 'Stand here', size: 52, color: '#2f7d32' }]
      : [{ text: p.label, size: 64 }, { text: `$${p.price.toLocaleString()}`, size: 72, color: '#2f7d32' }];
    const label = sprite(lines, 3.8, { h: 230 });
    label.position.y = 2.2;
    grp.add(tile, fill, border, label);
    grp.position.set(pos.x, 0, pos.z);
    scene.add(grp);
    return { grp, fill, label };
  }

  // People
  const rigs = {};
  function rigFor(a) {
    if (rigs[a.id]) return rigs[a.id];
    const r = M.person(RIGS[a.kind]);
    scene.add(r.group);
    const pile = { parent: r.group, meshes: [], key: '' };
    let tag = null;
    if (HELPER_NAMES[a.kind]) {
      tag = sprite([{ text: HELPER_NAMES[a.kind], size: 80 }], 2.2, { bg: 'rgba(29,53,87,0.85)', fg: '#ffffff' });
      tag.position.y = 2.8;
      r.group.add(tag);
    }
    rigs[a.id] = { ...r, pile, face: 0, lean: 0, px: a.x, pz: a.z, walkT: 0 };
    if (a.kind !== 'player') pops.push({ obj: r.group, t: 0 });
    return rigs[a.id];
  }
  const stackLocal = (list, i) => new THREE.Vector3(0, pileY(list, i, 1.15), -0.5);

  const custRigs = {};
  const SHIRTS = [0xe76f51, 0x2a9d8f, 0xe9c46a, 0x8338ec, 0x3a86ff, 0xff006e, 0x06d6a0];
  const SKINS = [0xf1c27d, 0xc68642, 0x8d5524, 0xffdbac];
  function custRig(c) {
    if (custRigs[c.id]) return custRigs[c.id];
    const r = M.person({ shirt: SHIRTS[Math.floor(c.look * 7)], skin: SKINS[Math.floor(c.look * 37) % 4], pants: [0x3d405b, 0x6d597a, 0x355070][Math.floor(c.look * 13) % 3] });
    const bubble = sprite([{ text: ITEMS[c.want].label, size: 70 }], 2.6, { h: 150 });
    bubble.position.y = 2.75;
    r.group.add(bubble);
    r.group.position.set(c.x, 0, c.z);
    scene.add(r.group);
    custRigs[c.id] = { ...r, bubble, food: null, foodKey: null, px: c.x, pz: c.z, face: Math.PI, walkT: 0 };
    return custRigs[c.id];
  }

  // ---------- slot positions for flights ----------
  function slotPos(id, i, item) {
    const [kind, ref] = id.split(':');
    if (kind === 'agent') {
      const a = g.agents.find((x) => x.id === ref);
      const r = a && rigs[a.id];
      if (!r) return new THREE.Vector3(0, 1, 0);
      r.group.updateMatrixWorld();
      return r.group.localToWorld(stackLocal(a.stack, i));
    }
    if (kind === 'in' || kind === 'out') {
      const st = g.stations[ref];
      const at = pileAt(STATIONS[ref], kind);
      return new THREE.Vector3(at.x, pileY(kind === 'in' ? st.inQ : st.outQ, i, 1.12), at.z);
    }
    if (kind === 'counter') return counterSlot(i).clone();
    if (kind === 'customer') {
      const r = custRigs[ref];
      return r ? r.group.localToWorld(new THREE.Vector3(0, 1.15, 0.5)) : counterSlot(0).clone();
    }
    if (kind === 'table') return new THREE.Vector3(TABLES[ref].x, 1.05, TABLES[ref].z);
    if (kind === 'bin') return new THREE.Vector3(PLACES.bin.x, 1.3, PLACES.bin.z);
    if (kind === 'cash') return cashSlot(Math.max(0, cashBills.length - 1)).clone();
    if (kind === 'pad') { const p = pads[ref]; return p ? p.grp.position.clone().setY(0.3) : new THREE.Vector3(); }
    return new THREE.Vector3();
  }

  // ---------- flights, pops, puffs ----------
  const flights = [], pops = [], puffs = [];
  function fly(item, from, toFn, dur = 0.28, onDone) {
    const mesh = M.item(item);
    mesh.position.copy(from);
    scene.add(mesh);
    flights.push({ mesh, from: from.clone(), toFn, t: 0, dur, onDone });
  }
  function moveFlight(e) {
    const from = slotPos(e.from, e.fromIndex);
    hidden[e.to] = hide(e.to) + 1;
    fly(e.item, from, () => {
      if (e.to.startsWith('agent:')) {
        const a = g.agents.find((x) => x.id === e.to.slice(6));
        return slotPos(e.to, a ? Math.max(0, a.stack.length - 1) : 0);
      }
      if (e.to.startsWith('in:')) return slotPos(e.to, Math.max(0, g.stations[e.to.slice(3)].inQ.length - 1));
      if (e.to === 'counter') return slotPos(e.to, Math.max(0, g.counter.length - 1));
      return slotPos(e.to, 0);
    }, 0.28, () => { hidden[e.to] = Math.max(0, hide(e.to) - 1); });
  }
  function puff(pos, color = 0xfff2d6, n = 10, size = 0.5) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.DodecahedronGeometry(size, 0), new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.85, depthWrite: false }));
      m.position.set(pos.x + (Math.random() - 0.5) * 2, 0.5 + Math.random(), pos.z + (Math.random() - 0.5) * 2);
      scene.add(m);
      puffs.push({ m, t: 0, vy: 1 + Math.random() * 2 });
    }
  }
  const cashThrottle = {};

  function handleEvent(e) {
    switch (e.type) {
      case 'move':
        moveFlight(e);
        if (e.item === 'plate') sfx.plate();
        else if (e.to.startsWith('agent:')) sfx.pickup();
        else if (e.to.startsWith('customer:')) { /* sale sound plays on 'sale' */ }
        else sfx.drop();
        break;
      case 'catch': {
        const s = SPOTS[e.spot];
        const from = new THREE.Vector3(s.water.x, -0.2, s.water.z);
        hidden[`agent:${e.agent}`] = hide(`agent:${e.agent}`) + 1;
        const key = `agent:${e.agent}`;
        fly(e.item, from, () => { const a = g.agents.find((x) => x.id === e.agent); return slotPos(key, Math.max(0, a.stack.length - 1)); },
          0.45, () => { hidden[key] = Math.max(0, hide(key) - 1); });
        puff(from, 0xd6f3ff, 5, 0.3);
        sfx.catch();
        break;
      }
      case 'cash': {
        const k = `${e.from}>${e.to}`;
        const now = performance.now();
        if (now - (cashThrottle[k] || 0) < 45) break;
        cashThrottle[k] = now;
        const from = e.from === 'cash' ? slotPos('cash') : slotPos(`agent:player`, g.player.stack.length).setY(1.6);
        fly('cash', from, () => (e.to === 'agent:player' ? rigs.player.group.position.clone().setY(1.5) : slotPos(e.to)), 0.25);
        sfx.coin();
        break;
      }
      case 'sale':
        sfx.sale();
        popup(`+$${Math.round(e.amount)}`, new THREE.Vector3(PLACES.counter.x, 3, PLACES.counter.z), e.happy ? 'money' : 'money meh');
        break;
      case 'tip':
        popup(`tip +$${Math.round(e.amount)}`, new THREE.Vector3(TABLES[e.table].x, 3, TABLES[e.table].z), 'money');
        break;
      case 'built': {
        sfx.build();
        const pos = padPos(e.pad);
        puff(pos, 0xfff2d6, 14, 0.6);
        if (pads[e.pad.id]) { scene.remove(pads[e.pad.id].grp); delete pads[e.pad.id]; }
        if (e.pad.kind === 'station') addStation(e.pad.ref);
        if (e.pad.kind === 'spot') addSpot(e.pad.ref);
        if (e.pad.kind === 'table') addTable(e.pad.ref);
        if (e.pad.kind === 'area') { addPier(e.pad.ref); if (e.pad.then) addSpot(e.pad.then); }
        break;
      }
      case 'arrive': sfx.arrive(); break;
      case 'trash': popup('Tossed', new THREE.Vector3(PLACES.bin.x, 2.6, PLACES.bin.z), 'meh'); break;
      default: break;
    }
  }

  // Initial build-out
  for (const a of g.areas) addPier(a);
  for (const id of Object.keys(g.stations)) addStation(id);
  for (const id of Object.keys(g.spots)) addSpot(id);
  for (const id of Object.keys(g.tables)) addTable(id);
  pops.length = 0;

  // ---------- per-frame sync ----------
  function animateWalk(r, moving, dt, speed = 12) {
    r.walkT = moving ? r.walkT + dt * speed : r.walkT * 0.8;
    const s = moving ? Math.sin(r.walkT) * 0.6 : 0;
    r.legs[0].rotation.x = s; r.legs[1].rotation.x = -s;
    r.arms[0].rotation.x = -s * 0.8; r.arms[1].rotation.x = s * 0.8;
  }
  function turnToward(r, dx, dz, dt) {
    if (Math.hypot(dx, dz) < 1e-3) return;
    const want = Math.atan2(dx, dz);
    let d = want - r.face;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    r.face += d * (1 - Math.exp(-dt * 12));
    r.group.rotation.y = r.face;
  }

  function sync(dt, time) {
    // Water swell
    const pos = waterGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = waterBase[i * 3], y = waterBase[i * 3 + 1];
      pos.array[i * 3 + 2] = Math.sin(x * 0.15 + time * 1.3) * 0.12 + Math.cos(y * 0.2 + time) * 0.1;
    }
    pos.needsUpdate = true;

    // Workers
    for (const a of g.agents) {
      const r = rigFor(a);
      const dx = a.x - r.px, dz = a.z - r.pz;
      const moving = Math.hypot(dx, dz) > 0.002;
      r.group.position.set(a.x, 0, a.z);
      turnToward(r, dx, dz, dt);
      animateWalk(r, moving, dt);
      // Stack sways opposite to motion, more at the top
      const v = moving ? Math.min(1, Math.hypot(dx, dz) / (dt * 7 + 1e-6)) : 0;
      r.lean += (v - r.lean) * (1 - Math.exp(-dt * 6));
      syncPile(r.pile, a.stack, (m, i) => {
        m.position.copy(stackLocal(a.stack, i));
        m.position.z -= r.lean * i * 0.035;
        m.position.x = Math.sin(time * 3 + i * 0.6) * 0.012 * i;
        m.rotation.y = Math.PI / 2;
      }, hide(`agent:${a.id}`));
      r.px = a.x; r.pz = a.z;
    }

    // Stations: piles, busy item, animations, sounds
    for (const [id, st] of Object.entries(g.stations)) {
      const s = stations[id];
      if (!s) continue;
      const inAt = pileAt(s.cfg, 'in'), outAt = pileAt(s.cfg, 'out');
      syncPile(s.inPile, st.inQ, (m, i) => m.position.set(inAt.x, pileY(st.inQ, i, 1.12), inAt.z), hide(`in:${id}`));
      syncPile(s.outPile, st.outQ, (m, i) => m.position.set(outAt.x, pileY(st.outQ, i, 1.12), outAt.z), 0);
      syncPile(s.busy, st.busy ? [st.busy] : [], (m) => m.position.set(s.cfg.x, 1.22, s.cfg.z), 0);
      if (s.anim.knife) {
        const chop = st.busy ? Math.abs(Math.sin(time * 14)) : 0;
        s.anim.knife.position.y = 1.35 + chop * 0.45;
        if (st.busy && chop < 0.15 && time - s.lastChop > 0.15) { s.lastChop = time; sfx.chop(); }
      }
      if ((s.anim.smoke || s.anim.bubbles) && st.busy) {
        s.smokeT -= dt;
        if (s.smokeT <= 0) {
          s.smokeT = s.anim.smoke ? 0.18 : 0.12;
          const m = new THREE.Mesh(new THREE.DodecahedronGeometry(s.anim.smoke ? 0.3 : 0.1, 0), new THREE.MeshLambertMaterial({
            color: s.anim.smoke ? 0xdddddd : 0xfff1b0, transparent: true, opacity: 0.7, depthWrite: false }));
          m.position.set(s.cfg.x + (Math.random() - 0.5) * 2, 1.3, s.cfg.z + (Math.random() - 0.5) * 0.8);
          scene.add(m);
          puffs.push({ m, t: 0, vy: s.anim.smoke ? 1.5 : 0.6 });
          sfx.sizzle();
        }
      }
    }

    // Fishing lines: shown while someone allowed to fish stands at the spot
    for (const [id, s] of Object.entries(spots)) {
      const fisher = g.agents.find((a) => Math.hypot(a.x - s.cfg.x, a.z - s.cfg.z) < ZONE && (a.kind === 'player' || (a.kind === 'fisher' && a.spot === id)));
      s.bobber.visible = s.line.visible = !!fisher;
      if (!fisher) continue;
      s.bobber.position.y = -0.4 + Math.sin(time * 5) * 0.08 - (fisher.catchT > 0.6 ? 0.15 : 0);
      const r = rigs[fisher.id];
      const hand = r.group.localToWorld(new THREE.Vector3(0.45, 1.6, 0.4));
      const arr = s.line.geometry.attributes.position.array;
      arr[0] = hand.x; arr[1] = hand.y + 1.2; arr[2] = hand.z;
      arr[3] = s.bobber.position.x; arr[4] = s.bobber.position.y + 0.1; arr[5] = s.bobber.position.z;
      s.line.geometry.attributes.position.needsUpdate = true;
      r.arms[1].rotation.x = -1.3;
    }

    // Tables
    for (const [id, t] of Object.entries(g.tables)) {
      const v = tables[id];
      if (!v) continue;
      v.plate.visible = t.state === 'dirty';
      v.ring.visible = t.state === 'dirty';
    }

    // Counter stock and cash
    syncPile(counterPile, g.counter, (m, i) => m.position.copy(counterSlot(i)), hide('counter'));
    const unit = 5 * g.mult;
    const bills = Math.min(64, Math.ceil(g.cashPile / unit - 1e-6));
    while (cashBills.length < bills) { const m = M.item('cash'); m.position.copy(cashSlot(cashBills.length)); m.rotation.y = (Math.random() - 0.5) * 0.3; scene.add(m); cashBills.push(m); }
    while (cashBills.length > bills) scene.remove(cashBills.pop());

    // Customers
    const live = new Set();
    for (const c of g.customers) {
      live.add(String(c.id));
      const r = custRig(c);
      const dx = c.x - r.px, dz = c.z - r.pz;
      const moving = Math.hypot(dx, dz) > 0.002;
      r.group.position.set(c.x, 0, c.z);
      if (moving) turnToward(r, dx, dz, dt);
      else if (c.state === 'queue') turnToward(r, 0, -1, dt);
      else if (c.state === 'eating') turnToward(r, 0, -1, dt);
      animateWalk(r, moving, dt, 10);
      r.bubble.visible = c.state === 'queue';
      const foodKey = c.food && hide(`customer:${c.id}`) === 0 ? c.food : null;
      if (r.foodKey !== foodKey) {
        if (r.food) { r.food.parent.remove(r.food); r.food = null; }
        if (foodKey) {
          r.food = M.item(foodKey);
          if (c.state === 'eating') { r.food.position.set(TABLES[c.table].x, 1.02, TABLES[c.table].z + 0.4); scene.add(r.food); }
          else { r.food.position.set(0, 1.15, 0.5); r.group.add(r.food); }
        }
        r.foodKey = foodKey;
      }
      if (c.state === 'eating' && r.food && r.food.parent !== scene) {
        r.group.remove(r.food);
        r.food.position.set(TABLES[c.table].x, 1.02, TABLES[c.table].z + 0.4);
        scene.add(r.food);
      }
      if (c.food) { r.arms[0].rotation.x = -1.1; r.arms[1].rotation.x = -1.1; }
      r.px = c.x; r.pz = c.z;
    }
    for (const id of Object.keys(custRigs)) {
      if (live.has(id)) continue;
      const r = custRigs[id];
      if (r.food) r.food.parent.remove(r.food);
      scene.remove(r.group);
      delete custRigs[id];
    }

    // Pads
    const vis = new Set(visiblePads(g).map((p) => p.id));
    for (const p of visiblePads(g)) {
      if (!pads[p.id]) { pads[p.id] = makePad(p, padPos(p)); pops.push({ obj: pads[p.id].grp, t: 0 }); }
      const f = Math.min(1, (g.padPaid[p.id] || 0) / p.price);
      pads[p.id].fill.scale.set(1, Math.max(0.001, f), 1);
      pads[p.id].fill.position.z = 1.4 * (1 - f);
      pads[p.id].label.position.y = 2.2 + Math.sin(time * 3 + p.price) * 0.08;
    }
    for (const id of Object.keys(pads)) if (!vis.has(id)) { scene.remove(pads[id].grp); delete pads[id]; }
    sellPad.grp.visible = g.squidCaught;
    if (g.squidCaught) {
      const f = Math.min(1, Math.max(0, g.sellT) / 1.5);
      sellPad.fill.scale.set(1, Math.max(0.001, f), 1);
      sellPad.fill.position.z = 1.4 * (1 - f);
      sellPad.label.position.y = 2.2 + Math.sin(time * 4) * 0.12;
    }

    // Flights
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i];
      f.t += dt / f.dur;
      const t = Math.min(1, f.t);
      const to = f.toFn();
      f.mesh.position.lerpVectors(f.from, to, t);
      f.mesh.position.y += Math.sin(t * Math.PI) * 1.4;
      f.mesh.rotation.y += dt * 8;
      if (f.t >= 1) { scene.remove(f.mesh); flights.splice(i, 1); f.onDone?.(); }
    }
    // Pop-in for new things
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i];
      p.t = Math.min(1, p.t + dt * 3);
      const s = p.t < 1 ? 1 + Math.sin(p.t * Math.PI) * 0.25 : 1;
      p.obj.scale.setScalar(Math.max(0.01, p.t < 0.5 ? p.t * 2 * s : s));
      if (p.t >= 1) { p.obj.scale.setScalar(1); pops.splice(i, 1); }
    }
    for (let i = puffs.length - 1; i >= 0; i--) {
      const p = puffs[i];
      p.t += dt;
      p.m.position.y += p.vy * dt;
      p.m.scale.setScalar(1 + p.t * 2);
      p.m.material.opacity = Math.max(0, 0.8 - p.t * 1.2);
      if (p.t > 0.7) { scene.remove(p.m); puffs.splice(i, 1); }
    }
  }

  return { sync, handleEvent, rigs };
}
