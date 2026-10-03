// Fillet Frenzy rules with no rendering. The browser game and the balance bot both run this.
// Rendering reads the state and the `events` list each frame.
import {
  ITEMS, RECIPES, FISH, PLAYER, HELPER, CUSTOMERS, STARS, AREAS, PLACES,
  STATIONS, SPOTS, TABLES, PADS, PADS_SHOWN, SELL_PAD,
} from './config.js';

export const ZONE = 1.7;       // reach for drop/pick zones, spots and pads
export const TABLE_ZONE = 2.6;
export const BUFFER_MAX = 12;
export const COUNTER_MAX = 24;
const SELL_HOLD = 1.5;

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
    built: new Set(), padPaid: {},
    squidCaught: false, sellT: 0,
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
    g.agents.push(h);
  } else if (p.kind === 'upgrade') {
    if (p.ref === 'cap') g.player.cap = p.value;
    if (p.ref === 'speed') g.player.speedMult = p.value;
  }
  g.events.push({ type: 'built', pad: p });
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
    if (a.catchT >= FISH[spot.fish].every) {
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
    if (dist(a, st.in) < ZONE && can.dropAt(a, st) && st.inQ.length < BUFFER_MAX) {
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
  if (can.counter(a) && dist(a, PLACES.counter.drop) < ZONE && g.counter.length < COUNTER_MAX) {
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

  // Build pads drain cash over about a second
  for (const p of visiblePads(g)) {
    if (dist(a, padPos(p)) > ZONE || g.cash <= 0) continue;
    const paid = g.padPaid[p.id] || 0;
    const pay = Math.min(g.cash, p.price - paid, Math.max(p.price * 1.1 * dt, 20 * dt));
    g.cash -= pay;
    g.padPaid[p.id] = paid + pay;
    g.events.push({ type: 'cash', amount: pay, from: 'agent:player', to: `pad:${p.id}` });
    if (g.padPaid[p.id] >= p.price - 1e-6) build(g, p);
    break;
  }

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
    if (sellable(it) && g.counter.length < COUNTER_MAX) return false;
    if (Object.values(g.stations).some((s) => accepts(s, it) && s.inQ.length < BUFFER_MAX)) return false;
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
    if (!st.busy && st.inQ.length && st.outQ.length < BUFFER_MAX) {
      st.busy = st.inQ.shift();
      st.timer = r.time * (r.slow?.[st.busy] || 1);
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
function queueSlot(k) { return { x: PLACES.counter.front.x, z: PLACES.counter.front.z + k * 2.3 }; }

function stepCustomers(g, dt) {
  const tables = Object.values(g.tables);
  const queued = g.customers.filter((c) => c.state === 'queue');
  const every = Math.max(CUSTOMERS.minEvery, CUSTOMERS.baseEvery / (1 + CUSTOMERS.perTable * tables.length));
  g.custT -= dt;
  if (g.custT <= 0) {
    g.custT = every;
    const m = menu(g);
    if (queued.length < CUSTOMERS.queueMax && m.length) {
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

  queued.forEach((c, k) => {
    const slot = queueSlot(k);
    walk(c, slot, CUSTOMERS.speed, dt);
    if (k !== 0 || dist(c, slot) > 0.4) return;
    c.waitT += dt;
    let i = g.counter.lastIndexOf(c.want);
    if (i < 0 && c.waitT > CUSTOMERS.pickyFor && g.counter.length) {
      i = 0;
      g.counter.forEach((it, j) => { if (ITEMS[it].price > ITEMS[g.counter[i]].price) i = j; });
    }
    if (i < 0) return;
    const [it] = g.counter.splice(i, 1);
    c.food = it;
    const pay = ITEMS[it].price * g.mult;
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
        const tip = ITEMS[c.food].price * CUSTOMERS.tip * g.mult;
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
export function collectTarget(g, a) {
  if (a.kind === 'fisher') return g.spots[a.spot];
  if (a.kind === 'runner') {
    const st = nearest(a, stationsOf(g, ['cut']).filter((s) => s.outQ.length && cookable(g, s.outQ.at(-1))));
    return st && st.out;
  }
  if (a.kind === 'server') {
    const st = nearest(a, Object.values(g.stations).filter((s) => s.outQ.length && can.pickFrom(g, a, s, s.outQ.at(-1))));
    return st && st.out;
  }
  if (a.kind === 'busser') {
    return nearest(a, Object.values(g.tables).filter((t) => t.state === 'dirty'));
  }
  return null;
}

export function deliverTarget(g, a) {
  if (a.kind === 'fisher') {
    const st = nearest(a, stationsOf(g, ['cut']).filter((s) => s.inQ.length < BUFFER_MAX));
    return st && st.in;
  }
  if (a.kind === 'runner') {
    const st = nearest(a, stationsOf(g, cookers).filter((s) => s.inQ.length < BUFFER_MAX && a.stack.some((it) => accepts(s, it))));
    return st && st.in;
  }
  if (a.kind === 'server') return g.counter.length < COUNTER_MAX ? PLACES.counter.drop : null;
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
  walk(a, target || home, a.speed, dt);
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
}
