// Fillet Frenzy rules with no rendering. The browser game and the balance bot both run this.
// Rendering reads the state and the `events` list each frame.
import {
  ITEMS, RECIPES, FISH, PLAYER, HELPER, CUSTOMERS, STARS, AREAS, PLACES,
  STATIONS, SPOTS, TABLES, PADS, PADS_SHOWN, SELL_PAD, LEVELS, NAMES, BOAT,
} from './config.js';

export const ZONE = 1.7;       // reach for drop/pick zones, spots and pads
export const TABLE_ZONE = 2.6;
export const BUFFER_MAX = 12;
export const COUNTER_MAX = 24;
const SELL_HOLD = 1.5;
export const PAD_HOLD = 0.35;

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const sellable = (item) => ITEMS[item]?.price !== undefined;

export function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeAgent(id, kind, x, z, extra = {}) {
  const base = kind === 'player' ? PLAYER : HELPER;
  return { id, kind, x, z, stack: [], cap: base.cap, speed: base.speed, speedMult: 1,
    opT: 0, catchT: 0, mode: 'collect', tx: x, tz: z, moving: false, ...extra };
}

function makeStation(id) {
  return { id, ...STATIONS[id], inQ: [], outQ: [], busy: null, timer: 0 };
}

export function createGame(stars = 0, seed = 7) {
  const g = {
    t: 0, rng: mulberry32(seed), stars, mult: 1 + STARS.priceBonus * stars,
    cash: 0, earned: 0, cashPile: 0,
    areas: new Set(['beach', 'pier1']),
    stations: { cut1: makeStation('cut1') },
    spots: { s1: { id: 's1', ...SPOTS.s1 } },
    tables: {},
    counter: [],
    agents: [],
    customers: [], custT: 1.5, custSeq: 0,
    built: new Set(), padPaid: {}, levels: {},
    squidCaught: false, sellT: 0,
    boat: { state: 'away', t: BOAT.first, offer: null, hold: 0 }, boosts: { cash: 0, rush: 0 },
    events: [],
  };
  g.player = makeAgent('player', 'player', PLACES.start.x, PLACES.start.z);
  g.agents.push(g.player);
  return g;
}

// ---------- geometry ----------
export function walkable(g, x, z) {
  for (const a of g.areas) {
    const r = AREAS[a];
    if (x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1) return true;
  }
  return false;
}

export function clampToAreas(g, x, z) {
  if (walkable(g, x, z)) return { x, z };
  let best = null, bd = Infinity;
  for (const a of g.areas) {
    const r = AREAS[a];
    const cx = Math.min(r.x1, Math.max(r.x0, x)), cz = Math.min(r.z1, Math.max(r.z0, z));
    const d = Math.hypot(cx - x, cz - z);
    if (d < bd) { bd = d; best = { x: cx, z: cz }; }
  }
  return best;
}

// ---------- pads ----------
export function padPos(p) {
  if (p.x !== undefined) return { x: p.x, z: p.z };
  const src = p.kind === 'station' ? STATIONS[p.ref] : p.kind === 'spot' ? SPOTS[p.ref] : TABLES[p.ref];
  return { x: src.x, z: src.z };
}

export function visiblePads(g) {
  const out = [];
  for (const p of PADS) {
    if (g.built.has(p.id)) continue;
    const pos = padPos(p);
    if (!walkable(g, pos.x, pos.z)) continue;
    out.push(p);
    if (out.length >= PADS_SHOWN) break;
  }
  return out;
}

function build(g, p) {
  g.built.add(p.id);
  if (p.kind === 'station') g.stations[p.ref] = makeStation(p.ref);
  else if (p.kind === 'spot') g.spots[p.ref] = { id: p.ref, ...SPOTS[p.ref] };
  else if (p.kind === 'table') g.tables[p.ref] = { id: p.ref, ...TABLES[p.ref], state: 'free', plates: 0 };
  else if (p.kind === 'area') {
    g.areas.add(p.ref);
    if (p.then) g.spots[p.then] = { id: p.then, ...SPOTS[p.then] };
  } else if (p.kind === 'helper') {
    const h = makeAgent(`${p.ref}${g.agents.length}`, p.ref, PLACES.helperHome.x, PLACES.helperHome.z, { spot: p.spot });
    applyStaff(g, h);
    g.agents.push(h);
  } else if (p.kind === 'upgrade') {
    if (p.ref === 'cap') g.player.cap = p.value;
    if (p.ref === 'speed') g.player.speedMult = p.value;
  }
  g.events.push({ type: 'built', pad: p });
}

// ---------- upgrades ----------
export const level = (g, id) => g.levels[id] || 1;
export const bufMax = (g, st) => BUFFER_MAX + LEVELS.station.buffer * (level(g, `st:${st.id}`) - 1);
export const counterMax = (g) => COUNTER_MAX + LEVELS.counter.stock * (level(g, 'counter') - 1);
const cost = (base, lv) => Math.round(base * Math.pow(LEVELS.growth, lv - 1));

// Every upgrade pad that's on the map right now
export function upgradePads(g) {
  const out = [];
  const add = (id, name, base, pos) => {
    const lv = level(g, id);
    if (lv < LEVELS.max) out.push({ id, name, level: lv, price: cost(base, lv), x: pos.x, z: pos.z, key: `${id}#${lv}` });
  };
  for (const st of Object.values(g.stations)) add(`st:${st.id}`, NAMES[st.type], LEVELS.station.base[st.type], { x: st.x, z: st.z + 2.7 });
  add('counter', 'Counter', LEVELS.counter.base, LEVELS.counter);
  for (const s of Object.values(g.spots)) if (s.up) add(`spot:${s.id}`, 'Fishing spot', LEVELS.spot.base[s.fish], s.up);
  if (g.agents.length > 1) add('staff', 'Staff training', LEVELS.staff.base, LEVELS.staff);
  return out;
}

function applyStaff(g, a) {
  const lv = level(g, 'staff');
  a.cap = HELPER.cap + LEVELS.staff.cap * (lv - 1);
  a.speed = HELPER.speed * (1 + LEVELS.staff.speed * (lv - 1));
}

function upgrade(g, u) {
  g.levels[u.id] = u.level + 1;
  if (u.id === 'staff') for (const a of g.agents) if (a.kind !== 'player') applyStaff(g, a);
  g.events.push({ type: 'upgraded', up: u, level: u.level + 1 });
}

// Stand on a pad and cash pours in over about a second
function payInto(g, a, key, price, dt) {
  const paid = g.padPaid[key] || 0;
  const pay = Math.min(g.cash, price - paid, Math.max(price * 1.1 * dt, 20 * dt));
  g.cash -= pay;
  g.padPaid[key] = paid + pay;
  g.events.push({ type: 'cash', amount: pay, from: 'agent:player', to: `pad:${key}` });
  return g.padPaid[key] >= price - 1e-6;
}

// ---------- what each kind of worker is allowed to do ----------
const cookers = ['grill', 'fryer', 'sushi'];
function accepts(st, item) { return !!RECIPES[st.type].makes[item]; }
function cookable(g, item) {
  return Object.values(g.stations).some((s) => cookers.includes(s.type) && accepts(s, item));
}

const can = {
  fish: (a, spot) => a.kind === 'player' || (a.kind === 'fisher' && a.spot === spot.id),
  dropAt: (a, st) => a.kind === 'player' || (a.kind === 'fisher' && st.type === 'cut') || (a.kind === 'runner' && cookers.includes(st.type)),
  pickFrom: (g, a, st, item) => a.kind === 'player'
    || (a.kind === 'runner' && st.type === 'cut' && cookable(g, item))
    || (a.kind === 'server' && (cookers.includes(st.type) || !cookable(g, item))),
  counter: (a) => a.kind === 'player' || a.kind === 'server',
  plates: (a) => a.kind === 'player' || a.kind === 'busser',
};

// ---------- menu ----------
export function menu(g) {
  const have = new Set();
  for (const s of Object.values(g.spots)) have.add(s.fish);
  let grew = true;
  while (grew) {
    grew = false;
    for (const st of Object.values(g.stations)) {
      for (const [from, to] of Object.entries(RECIPES[st.type].makes)) {
        if (have.has(from) && !have.has(to)) { have.add(to); grew = true; }
      }
    }
  }
  return [...have].filter(sellable);
}

// ---------- per-agent interactions ----------
function interact(g, a, dt) {
  a.opT += dt;
  const ready = () => { if (a.opT >= PLAYER.transfer) { a.opT = 0; return true; } return false; };
  const room = () => a.stack.length < a.cap;

  // Fishing
  let fishing = false;
  for (const spot of Object.values(g.spots)) {
    if (dist(a, spot) > ZONE || !can.fish(a, spot)) continue;
    fishing = true;
    if (!room()) { a.catchT = 0; break; }
    a.catchT += dt;
    if (a.catchT >= FISH[spot.fish].every / (1 + LEVELS.spot.speed * (level(g, `spot:${spot.id}`) - 1))) {
      a.catchT = 0;
      a.stack.push(spot.fish);
      g.events.push({ type: 'catch', agent: a.id, spot: spot.id, item: spot.fish });
      if (spot.fish === 'squid' && !g.squidCaught) { g.squidCaught = true; g.events.push({ type: 'legend' }); }
    }
    break;
  }
  if (!fishing) a.catchT = 0;

  for (const st of Object.values(g.stations)) {
    // Drop raw/prepped items into a station
    if (dist(a, st.in) < ZONE && can.dropAt(a, st) && st.inQ.length < bufMax(g, st)) {
      const i = a.stack.findLastIndex((it) => accepts(st, it));
      if (i >= 0 && ready()) {
        const [it] = a.stack.splice(i, 1);
        st.inQ.push(it);
        g.events.push({ type: 'move', item: it, from: `agent:${a.id}`, fromIndex: i, to: `in:${st.id}` });
      }
    }
    // Pick finished items up
    if (dist(a, st.out) < ZONE && st.outQ.length && room()) {
      const it = st.outQ[st.outQ.length - 1];
      if (can.pickFrom(g, a, st, it) && ready()) {
        st.outQ.pop();
        a.stack.push(it);
        g.events.push({ type: 'move', item: it, from: `out:${st.id}`, fromIndex: st.outQ.length, to: `agent:${a.id}` });
      }
    }
  }

  // Counter: drop anything sellable
  if (can.counter(a) && dist(a, PLACES.counter.drop) < ZONE && g.counter.length < counterMax(g)) {
    const i = a.stack.findLastIndex(sellable);
    if (i >= 0 && ready()) {
      const [it] = a.stack.splice(i, 1);
      g.counter.push(it);
      g.events.push({ type: 'move', item: it, from: `agent:${a.id}`, fromIndex: i, to: 'counter' });
    }
  }

  // Dirty tables and the bin
  if (can.plates(a)) {
    for (const tb of Object.values(g.tables)) {
      if (tb.state === 'dirty' && dist(a, tb) < TABLE_ZONE && room() && ready()) {
        tb.plates--;
        a.stack.push('plate');
        g.events.push({ type: 'move', item: 'plate', from: `table:${tb.id}`, fromIndex: 0, to: `agent:${a.id}` });
        if (tb.plates <= 0) tb.state = 'free';
      }
    }
    // The bin takes plates from anyone, and anything at all from the chef (the escape hatch for a jammed kitchen)
    if (dist(a, PLACES.bin) < ZONE + 0.5) {
      let i = a.stack.lastIndexOf('plate');
      if (i < 0 && a.kind === 'player') i = a.stack.length - 1;
      if (i >= 0 && ready()) {
        const [it] = a.stack.splice(i, 1);
        g.events.push({ type: 'move', item: it, from: `agent:${a.id}`, fromIndex: i, to: 'bin' });
        if (it !== 'plate') g.events.push({ type: 'trash', item: it });
      }
    }
  }

  if (a.kind !== 'player') return;

  // Cash pile
  if (g.cashPile > 0 && dist(a, PLACES.counter.cash) < ZONE + 0.4) {
    const take = Math.min(g.cashPile, Math.max(1, g.cashPile * 7 * dt, 25 * dt));
    g.cashPile -= take;
    if (g.cashPile < 0.01) { g.cashPile = 0; }
    g.cash += take;
    g.events.push({ type: 'cash', amount: take, from: 'cash', to: 'agent:player' });
  }

  // Build pads and upgrade pads. Cash only starts flowing after you've stood on a pad for a moment,
  // so walking across one on the way somewhere doesn't spend anything.
  let on = null;
  for (const p of visiblePads(g)) if (dist(a, padPos(p)) <= ZONE) { on = { key: p.id, price: p.price, done: () => build(g, p) }; break; }
  if (!on) for (const u of upgradePads(g)) if (dist(a, u) <= 1.3) { on = { key: u.key, price: u.price, done: () => upgrade(g, u) }; break; }
  if (on && on.key === g.padHold?.key) g.padHold.t += dt;
  else g.padHold = on ? { key: on.key, t: 0 } : null;
  if (on && g.padHold.t >= PAD_HOLD && g.cash > 0 && payInto(g, a, on.key, on.price, dt)) on.done();

  // Sell the shack
  if (g.squidCaught && dist(a, SELL_PAD) < ZONE) {
    g.sellT += dt;
    if (g.sellT >= SELL_HOLD) {
      g.sellT = -Infinity;
      g.events.push({ type: 'sell', stars: starsFor(g) });
    }
  } else if (g.sellT > 0) g.sellT = 0;
}

// True when the chef's basket is full and nothing they're carrying has anywhere to go.
export function playerStuck(g) {
  const a = g.player;
  if (a.stack.length < a.cap) return false;
  for (const it of a.stack) {
    if (it === 'plate') return false;
    if (sellable(it) && g.counter.length < counterMax(g)) return false;
    if (Object.values(g.stations).some((s) => accepts(s, it) && s.inQ.length < bufMax(g, s))) return false;
  }
  return true;
}

export function starsFor(g) {
  return 1 + Math.floor(g.earned / STARS.perEarned);
}

// ---------- stations ----------
function stepStations(g, dt) {
  for (const st of Object.values(g.stations)) {
    const r = RECIPES[st.type];
    if (!st.busy && st.inQ.length && st.outQ.length < bufMax(g, st)) {
      st.busy = st.inQ.shift();
      st.timer = r.time * (r.slow?.[st.busy] || 1) / (1 + LEVELS.station.speed * (level(g, `st:${st.id}`) - 1));
      st.total = st.timer;
      g.events.push({ type: 'start', station: st.id, item: st.busy });
    }
    if (st.busy) {
      st.timer -= dt;
      if (st.timer <= 0) {
        const made = r.makes[st.busy];
        st.outQ.push(made);
        g.events.push({ type: 'made', station: st.id, item: made });
        st.busy = null;
      }
    }
  }
}

// ---------- customers ----------
// Registers sit side by side along the counter; everyone else lines up behind the middle one.
export const registers = (g) => Math.min(3, level(g, 'counter'));
function registerSlot(i, r) { const f = PLACES.counter.front; return { x: f.x + (i - (r - 1) / 2) * 1.8, z: f.z }; }
function lineSlot(j) { const f = PLACES.counter.front; return { x: f.x + Math.floor(j / 6) * 1.6, z: f.z + 2.3 + (j % 6) * 2.3 }; }

function stepCustomers(g, dt) {
  const tables = Object.values(g.tables);
  const queued = g.customers.filter((c) => c.state === 'queue');
  const cl = level(g, 'counter') - 1;
  const every = Math.max(CUSTOMERS.minEvery / (1 + LEVELS.counter.customers * cl),
    CUSTOMERS.baseEvery / (1 + CUSTOMERS.perTable * tables.length) / (1 + LEVELS.counter.customers * cl));
  g.custT -= dt;
  if (g.custT <= 0) {
    g.custT = every;
    const m = menu(g);
    // Only people who've reached the line count toward it, so walkers on their way don't block new arrivals
    const waiting = queued.filter((c) => c.arrived).length;
    if (waiting < CUSTOMERS.queueMax + LEVELS.counter.queue * cl && queued.length < 30 && m.length) {
      // Favourite dish, weighted toward pricier things on the menu
      const w = m.map((it) => Math.sqrt(ITEMS[it].price));
      let r = g.rng() * w.reduce((a, b) => a + b, 0), want = m[0];
      for (let i = 0; i < m.length; i++) { r -= w[i]; if (r <= 0) { want = m[i]; break; } }
      const c = { id: g.custSeq++, x: PLACES.enter.x, z: PLACES.enter.z, state: 'queue', want, waitT: 0, look: g.rng() };
      g.customers.push(c);
      queued.push(c);
      g.events.push({ type: 'arrive', customer: c.id });
    }
  }

  // Each customer keeps the register they're sent to until they've bought something
  const regs = registers(g);
  g.regs = g.regs || [];
  for (let i = 0; i < regs; i++) {
    if (g.regs[i] !== undefined && queued.some((c) => c.id === g.regs[i])) continue;
    const next = queued.find((c) => c.reg === undefined);
    if (next) { next.reg = i; g.regs[i] = next.id; } else g.regs[i] = undefined;
  }
  let j = 0;
  queued.forEach((c) => {
    const slot = c.reg === undefined ? lineSlot(j++) : registerSlot(c.reg, regs);
    if (walk(c, slot, CUSTOMERS.speed, dt)) c.arrived = true;
    if (c.reg === undefined || dist(c, slot) > 0.4) return;
    c.waitT += dt;
    let i = g.counter.lastIndexOf(c.want);
    if (i < 0 && c.waitT > CUSTOMERS.pickyFor / (1 + cl) && g.counter.length) {
      i = 0;
      g.counter.forEach((it, j) => { if (ITEMS[it].price > ITEMS[g.counter[i]].price) i = j; });
    }
    if (i < 0) return;
    const [it] = g.counter.splice(i, 1);
    g.regs[c.reg] = undefined;
    c.food = it;
    const pay = ITEMS[it].price * g.mult * (g.boosts.cash > 0 ? 2 : 1);
    g.cashPile += pay;
    g.earned += pay;
    g.events.push({ type: 'move', item: it, from: 'counter', fromIndex: i, to: `customer:${c.id}` });
    g.events.push({ type: 'sale', amount: pay, customer: c.id, happy: it === c.want });
    const free = tables.find((t) => t.state === 'free');
    if (free) { free.state = 'taken'; c.table = free.id; c.state = 'toTable'; }
    else c.state = 'leaving';
  });

  for (const c of g.customers) {
    if (c.state === 'toTable') {
      const tb = g.tables[c.table];
      if (walk(c, { x: tb.x, z: tb.z + 1.4 }, CUSTOMERS.speed, dt)) { c.state = 'eating'; c.eatT = CUSTOMERS.eatTime; }
    } else if (c.state === 'eating') {
      c.eatT -= dt;
      if (c.eatT <= 0) {
        const tb = g.tables[c.table];
        tb.state = 'dirty'; tb.plates = 1;
        const tip = ITEMS[c.food].price * CUSTOMERS.tip * g.mult * (g.boosts.cash > 0 ? 2 : 1);
        g.cashPile += tip;
        g.earned += tip;
        g.events.push({ type: 'tip', amount: tip, table: tb.id });
        c.food = null;
        c.state = 'leaving';
      }
    } else if (c.state === 'leaving') {
      if (walk(c, PLACES.enter, CUSTOMERS.speed, dt)) c.state = 'gone';
    }
  }
  g.customers = g.customers.filter((c) => c.state !== 'gone');
}

// Moves toward a target; returns true on arrival.
function walk(o, to, speed, dt) {
  const dx = to.x - o.x, dz = to.z - o.z;
  const d = Math.hypot(dx, dz);
  o.moving = d > 0.05;
  if (d < 0.05) return true;
  const s = Math.min(d, speed * dt);
  o.x += (dx / d) * s; o.z += (dz / d) * s;
  o.face = Math.atan2(dx, dz);
  return d <= speed * dt;
}

// ---------- helper brains ----------
function stationsOf(g, types) { return Object.values(g.stations).filter((s) => types.includes(s.type)); }
function nearest(a, list, pos = (x) => x) {
  let best = null, bd = Infinity;
  for (const it of list) { const d = dist(a, pos(it)); if (d < bd) { bd = d; best = it; } }
  return best;
}

// Where a worker should go next: { x, z } or null to head home.
// Staff choose stations by priority, then distance:
//   dropping off  -> highest-level station with room (if all are full, wait at the best one)
//   picking up    -> the station with the most finished food waiting, so piles never back up
const lv = (g, st) => level(g, `st:${st.id}`);
function best(a, list, ...keys) {
  let pick = null, pickKey = null;
  for (const it of list) {
    const k = [...keys.map((f) => f(it)), -dist(a, it.pos || it)];
    if (!pick || k.some((v, i) => k.slice(0, i).every((w, j) => w === pickKey[j]) && v > pickKey[i])) { pick = it; pickKey = k; }
  }
  return pick;
}
function dropOff(g, a, stations, wants) {
  const open = stations.filter((s) => wants(s) && s.inQ.length < bufMax(g, s));
  const st = best(a, open.map((s) => ({ s, pos: s.in })), (o) => lv(g, o.s))
    || best(a, stations.filter(wants).map((s) => ({ s, pos: s.in })), (o) => lv(g, o.s));
  return st && st.s.in;
}
function pickUp(g, a, stations) {
  const st = best(a, stations.map((s) => ({ s, pos: s.out })), (o) => o.s.outQ.length, (o) => lv(g, o.s));
  return st && st.s.out;
}

// Where a worker should go next: { x, z } or null to head home.
export function collectTarget(g, a) {
  if (a.kind === 'fisher') return g.spots[a.spot];
  if (a.kind === 'runner') return pickUp(g, a, stationsOf(g, ['cut']).filter((s) => s.outQ.length && cookable(g, s.outQ.at(-1))));
  if (a.kind === 'server') return pickUp(g, a, Object.values(g.stations).filter((s) => s.outQ.length && can.pickFrom(g, a, s, s.outQ.at(-1))));
  if (a.kind === 'busser') return nearest(a, Object.values(g.tables).filter((t) => t.state === 'dirty'));
  return null;
}

export function deliverTarget(g, a) {
  if (a.kind === 'fisher') return dropOff(g, a, stationsOf(g, ['cut']), () => true);
  if (a.kind === 'runner') return dropOff(g, a, stationsOf(g, cookers), (s) => a.stack.some((it) => accepts(s, it)));
  if (a.kind === 'server') return PLACES.counter.drop;
  if (a.kind === 'busser') return PLACES.bin;
  return null;
}

function stepHelper(g, a, dt) {
  if (a.mode === 'deliver' && !a.stack.length) a.mode = 'collect';
  let target;
  if (a.mode === 'collect') {
    const src = collectTarget(g, a);
    if (a.stack.length >= a.cap || (!src && a.stack.length)) { a.mode = 'deliver'; }
    else target = src;
  }
  if (a.mode === 'deliver') target = deliverTarget(g, a);
  const home = { x: PLACES.helperHome.x + (a.id.length % 3), z: PLACES.helperHome.z };
  walk(a, target || home, a.speed * (g.boosts.rush > 0 ? 2 : 1), dt);
}

// ---------- main step ----------
// Advance the game by dt. The player's position is set by the caller before this runs.
export function step(g, dt) {
  g.t += dt;
  const p = clampToAreas(g, g.player.x, g.player.z);
  g.player.x = p.x; g.player.z = p.z;
  for (const a of g.agents) {
    if (a.kind !== 'player') stepHelper(g, a, dt);
    interact(g, a, dt);
  }
  stepStations(g, dt);
  stepCustomers(g, dt);
  stepBoat(g, dt);
}

// ---------- delivery boat ----------
function stepBoat(g, dt) {
  g.boosts.cash = Math.max(0, g.boosts.cash - dt);
  g.boosts.rush = Math.max(0, g.boosts.rush - dt);
  const b = g.boat;
  if (b.state === 'away') {
    b.t -= dt;
    if (b.t <= 0) {
      const offers = BOAT.offers.filter((o) => o.id !== 'upgrade' || upgradePads(g).length);
      b.offer = offers[Math.floor(g.rng() * offers.length)];
      b.state = 'docked'; b.t = BOAT.stay; b.hold = 0;
      g.events.push({ type: 'boatArrive', offer: b.offer });
    }
  } else if (b.state === 'docked') {
    b.t -= dt;
    if (dist(g.player, BOAT.pad) < ZONE) {
      b.hold += dt;
      if (b.hold >= BOAT.hold) { b.state = 'claiming'; g.events.push({ type: 'boatClaim', offer: b.offer }); }
    } else b.hold = 0;
    if (b.state === 'docked' && b.t <= 0) { b.state = 'away'; b.t = BOAT.every; g.events.push({ type: 'boatLeave' }); }
  }
}

// Called once the (optional) ad finishes. watched=false means no reward and the boat stays a little longer.
export function claimBoat(g, watched) {
  const b = g.boat;
  if (b.state !== 'claiming') return;
  if (!watched) { b.state = 'docked'; b.t = Math.max(b.t, 5); b.hold = -1; return; }
  const o = b.offer;
  let detail = o.label;
  if (o.id === 'cash2x') g.boosts.cash = BOAT.boost;
  if (o.id === 'rush') g.boosts.rush = BOAT.boost;
  if (o.id === 'crate') {
    const rate = g.t > 30 ? g.earned / g.t : 1;
    const amount = Math.round(Math.max(60, rate * 90));
    g.cash += amount;
    detail = `+$${amount.toLocaleString()}`;
    g.events.push({ type: 'cash', amount, from: 'boat', to: 'agent:player' });
  }
  if (o.id === 'upgrade') {
    const ups = upgradePads(g);
    if (ups.length) {
      const u = ups.reduce((m, x) => (x.price < m.price ? x : m));
      upgrade(g, u);
      detail = `${u.name} to Lv ${u.level + 1}`;
    }
  }
  g.events.push({ type: 'boatReward', offer: o, detail });
  b.state = 'away'; b.t = BOAT.every; b.offer = null;
}

// ---------- saving ----------
// A save records what you've built and earned, by id, not where things sit on the map,
// so updates that move stations, change prices, or add new pads still load old saves.
//
// Rules for future updates so nobody loses progress:
//   - Never reuse or rename a pad id, station id, spot id, table id, or item id. Add new ones instead.
//   - If something must be renamed or removed, bump SAVE_VERSION and convert old saves in migrate().
export const SAVE_VERSION = 1;

// Upgrades old saves one version at a time. Example for a future v2 that renamed a pad:
//   if (data.v === 1) { data.built = data.built.map((id) => (id === 'oldId' ? 'newId' : id)); data.v = 2; }
export function migrate(data) {
  const out = JSON.parse(JSON.stringify(data || {}));
  if (!out.v) out.v = 1;
  return out;
}

export function serialize(g) {
  return {
    v: SAVE_VERSION, stars: g.stars, t: g.t,
    cash: g.cash, earned: g.earned, cashPile: g.cashPile,
    built: [...g.built], padPaid: g.padPaid, levels: g.levels,
    stations: Object.fromEntries(Object.values(g.stations).map((s) => [s.id, { inQ: s.inQ, outQ: s.outQ, busy: s.busy }])),
    tables: Object.fromEntries(Object.values(g.tables).map((t) => [t.id, { state: t.state === 'taken' ? 'free' : t.state, plates: t.plates }])),
    counter: g.counter,
    agents: g.agents.map((a) => ({ kind: a.kind, x: a.x, z: a.z, stack: a.stack })),
    squidCaught: g.squidCaught, boosts: g.boosts, boatT: g.boat.state === 'away' ? g.boat.t : 30,
  };
}

// Rebuilds a game from a save. Anything the current version doesn't recognise is skipped.
export function restore(raw) {
  const data = migrate(raw);
  const g = createGame(data.stars || 0, (Date.now() % 100000) | 0);
  const built = new Set(data.built || []);
  for (const p of PADS) if (built.has(p.id)) build(g, p);
  g.events.length = 0;
  const num = (v, d = 0) => (Number.isFinite(v) ? v : d);
  const items = (list) => (Array.isArray(list) ? list.filter((it) => ITEMS[it]) : []);
  g.t = num(data.t);
  g.cash = num(data.cash); g.earned = num(data.earned); g.cashPile = num(data.cashPile);
  g.padPaid = data.padPaid || {};
  g.levels = data.levels || {};
  for (const [id, s] of Object.entries(data.stations || {})) {
    const st = g.stations[id];
    if (!st) continue;
    st.inQ = items(s.inQ).filter((it) => accepts(st, it)).slice(0, bufMax(g, st));
    st.outQ = items(s.outQ).slice(0, bufMax(g, st));
    if (s.busy && accepts(st, s.busy)) st.inQ.unshift(s.busy);
  }
  for (const [id, t] of Object.entries(data.tables || {})) {
    if (g.tables[id] && t.state === 'dirty') { g.tables[id].state = 'dirty'; g.tables[id].plates = num(t.plates, 1); }
  }
  g.counter = items(data.counter).filter(sellable).slice(0, counterMax(g));
  (data.agents || []).forEach((s, i) => {
    const a = g.agents[i];
    if (!a || a.kind !== s.kind) return;
    a.x = num(s.x, a.x); a.z = num(s.z, a.z);
    a.stack = items(s.stack).slice(0, a.cap);
  });
  for (const a of g.agents) if (a.kind !== 'player') applyStaff(g, a);
  g.squidCaught = !!data.squidCaught;
  g.boosts = { cash: num(data.boosts?.cash), rush: num(data.boosts?.rush) };
  g.boat.t = num(data.boatT, 60);
  return g;
}
