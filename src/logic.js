// Fillet Frenzy rules with no rendering. The browser game and the balance bot both run this.
// Rendering reads the state and the `events` list each frame.
import {
  ITEMS, RECIPES, FISH, PLAYER, HELPER, CUSTOMERS, STARS, AREAS, PLACES, CASHIER, PLATES, DOCK,
  STATIONS, SPOTS, TABLES, PADS, PADS_SHOWN, SELL_PAD, LEVELS, NAMES, BOAT, HIRES, CHEF_TITLES,
} from './config.js';

export const ZONE = 1.7;       // reach for drop/pick zones, spots and pads
export const TABLE_ZONE = 2.6;
export const BUFFER_MAX = 12;
export const COUNTER_MAX = 24;
const SELL_HOLD = 1.5;
export const PAD_HOLD = 0.35;

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
export const sellable = (item) => ITEMS[item]?.price !== undefined;
const MOBILE = ['fisher', 'runner', 'server', 'busser', 'washer'];

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
  return { id, ...STATIONS[id], inQ: [], outQ: [], busy: null, timer: 0, prodT: 0 };
}

export function createGame(stars = 0, seed = 7) {
  const g = {
    t: 0, rng: mulberry32(seed), stars, mult: 1 + STARS.priceBonus * stars,
    cash: 0, earned: 0, cashPile: 0,
    areas: new Set(['beach', 'pier1']),
    stations: { cut1: makeStation('cut1') },
    spots: { s1: { id: 's1', ...SPOTS.s1 } },
    tables: {},
    counter: [], plates: 0,
    agents: [],
    customers: [], custT: 1.5, custSeq: 0,
    built: new Set(), padPaid: {}, levels: {},
    chefs: new Set(), cashier: false, dockT: 0,
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

export const squidReady = (g) => PADS.every((q) => q.id === 'squid' || g.built.has(q.id));
export const padsLeft = (g) => PADS.filter((q) => q.id !== 'squid' && !g.built.has(q.id)).length;
export function visiblePads(g) {
  const out = [];
  for (const p of PADS) {
    if (g.built.has(p.id)) continue;
    if (p.kind === 'helper' && p.ref === 'chef' && !g.stations[p.station]) continue;
    // The squid hole is the finale: it only opens once everything else on the build list is bought
    if (p.id === 'squid' && !squidReady(g)) continue;
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
    let x = PLACES.helperHome.x, z = PLACES.helperHome.z;
    if (p.ref === 'chef') { const c = STATIONS[p.station].chef; x = c.x; z = c.z; g.chefs.add(p.station); }
    if (p.ref === 'cashier') { const c = cashierPost(g); x = c.x; z = c.z; g.cashier = true; }
    hire(g, p.ref, x, z, { spot: p.spot, station: p.station });
  } else if (p.kind === 'upgrade') {
    // Bought in any order, so never step backwards (a Bigger basket after the Huge one changes nothing)
    if (p.ref === 'cap') g.player.cap = Math.max(g.player.cap, p.value);
    if (p.ref === 'speed') g.player.speedMult = Math.max(g.player.speedMult, p.value);
  }
  g.events.push({ type: 'built', pad: p });
}
function hire(g, kind, x, z, extra = {}) {
  const h = makeAgent(`${kind}${g.agents.length}`, kind, x, z, extra);
  applyStaff(g, h);
  g.agents.push(h);
  return h;
}
// Each cashier stands behind the register they opened (the ones after the counter's own)
export function cashierPost(g, i = 0) {
  const r = registers(g);
  const s = registerSlot(Math.min(r - 1, counterRegisters(g) + i), r);
  return { x: s.x, z: PLACES.counter.z - 1.6 };
}

// ---------- upgrades (no level cap) ----------
export const level = (g, id) => g.levels[id] || 1;
export const bufMax = (g, st) => BUFFER_MAX + LEVELS.station.buffer * (level(g, `st:${st.id}`) - 1);
export const counterMax = (g) => COUNTER_MAX + LEVELS.counter.stock * (level(g, 'counter') - 1);
const cost = (base, lv) => Math.round(base * Math.pow(LEVELS.growth, lv - 1));
export const stationSpeed = (g, st) => (1 + LEVELS.station.speed * (level(g, `st:${st.id}`) - 1)) * (g.chefs.has(st.id) ? 2 : 1);

// Every upgrade pad that's on the map right now
export function upgradePads(g) {
  const out = [];
  const add = (id, name, base, pos) => {
    const lv = level(g, id);
    out.push({ id, name, level: lv, price: cost(base, lv), x: pos.x, z: pos.z, key: `${id}#${lv}` });
  };
  for (const st of Object.values(g.stations)) add(`st:${st.id}`, NAMES[st.type], LEVELS.station.base[st.type], st.up || { x: st.x, z: st.z + 2.7 });
  add('counter', 'Counter', LEVELS.counter.base, LEVELS.counter);
  for (const s of Object.values(g.spots)) if (s.up) add(`spot:${s.id}`, `${ITEMS[s.fish].label} spot`, LEVELS.spot.base[s.fish], s.up);
  if (g.agents.some((a) => MOBILE.includes(a.kind))) add('staff', 'Staff training', LEVELS.staff.base, LEVELS.staff);
  return out.concat(hirePads(g));
}

// Pads for extra staff. They ride along with the upgrade pads (same pay-and-hold rules) but hire someone.
export function hirePads(g) {
  const out = [];
  for (const [kind, h] of Object.entries(HIRES)) {
    if (kind === 'fisher' || kind === 'chef') continue;
    if (!h.after || !g.built.has(h.after)) continue;
    const n = level(g, `hire:${kind}`);   // 1 = no extras yet
    if (h.max && n > h.max) continue;
    if (kind === 'cashier' && registers(g) >= 8) continue;
    out.push({ id: `hire:${kind}`, hire: kind, name: `Hire a ${h.name}`, label: `Hire ${h.name} #${n + 1}`,
      level: n, price: cost(h.base, n), x: h.x, z: h.z, key: `hire:${kind}#${n}` });
  }
  // One fisher per spot. Spots whose fisher is still coming in the build queue wait for that.
  const queued = new Set(PADS.filter((p) => p.ref === 'fisher' && !g.built.has(p.id)).map((p) => p.spot));
  const manned = new Set(g.agents.filter((a) => a.kind === 'fisher').map((a) => a.spot));
  const stations = Object.values(g.stations);
  for (const s of Object.values(g.spots)) {
    if (!s.up || manned.has(s.id) || queued.has(s.id)) continue;
    // Only once something in the kitchen takes this catch (a crab fisher with no steam pot would just stand around)
    if (!stations.some((st) => accepts(st, s.fish))) continue;
    const pos = fisherPadPos(s);
    out.push({ id: `hire:fisher:${s.id}`, hire: 'fisher', spot: s.id, name: `Hire a ${ITEMS[s.fish].label.toLowerCase()} fisher`,
      label: `Hire a ${ITEMS[s.fish].label.toLowerCase()} fisher`, level: 1,
      price: HIRES.fisher.mult * LEVELS.spot.base[s.fish], x: pos.x, z: pos.z, key: `hire:fisher:${s.id}#1` });
  }
  // Chefs for the stations that don't get one in the build queue
  for (const [id, c] of Object.entries(HIRES.chef)) {
    const st = g.stations[id];
    if (!st || g.chefs.has(id)) continue;
    const title = CHEF_TITLES[st.type];
    out.push({ id: `hire:chef:${id}`, hire: 'chef', station: id, name: `Hire a ${title}`, label: `Hire a ${title}`,
      level: 1, price: c.price, x: c.x, z: c.z, key: `hire:chef:${id}#1` });
  }
  return out;
}
export const fisherPadPos = (s) => ({ x: s.up.x, z: s.up.z + HIRES.fisher.dz });

function applyStaff(g, a) {
  const lv = level(g, 'staff');
  a.cap = HELPER.cap + LEVELS.staff.cap * (lv - 1);
  a.speed = HELPER.speed * (1 + LEVELS.staff.speed * (lv - 1));
}

function upgrade(g, u) {
  g.levels[u.id] = u.level + 1;
  if (u.hire) {
    const home = PLACES.helperHome;
    const here = u.hire === 'fisher' || u.hire === 'chef';   // they start right where they'll work
    const a = hire(g, u.hire, here ? u.x : home.x, here ? u.z : home.z, u.spot ? { spot: u.spot } : u.station ? { station: u.station } : {});
    if (u.hire === 'chef') g.chefs.add(u.station);
    g.events.push({ type: 'hired', up: u, agent: a.id });
    return;
  }
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

// ---------- what goes where ----------
export function accepts(st, item) {
  const r = RECIPES[st.type];
  if (!st.in) return false;
  if (r.makes) return !!r.makes[item];
  if (r.combo) return item === r.combo.with || !!r.combo.makes[item];
  return false;
}
// Room for this item right now. Combo stations keep half their space for each ingredient.
export function canTake(g, st, item) {
  if (!accepts(st, item)) return false;
  const r = RECIPES[st.type];
  if (r.combo) {
    const isWith = item === r.combo.with;
    const n = st.inQ.filter((it) => (it === r.combo.with) === isWith).length;
    return n < Math.ceil(bufMax(g, st) / 2);
  }
  return st.inQ.length < bufMax(g, st);
}
// Stations (other than `except`) that use this item as an ingredient
const wantedBy = (g, item, except) => Object.values(g.stations).filter((s) => s !== except && s.type !== 'sink' && accepts(s, item));

// Somewhere this item can go right now (so nobody grabs bread the roll station has no room for)
const hasRoom = (g, item, from) => wantedBy(g, item, from).some((s) => canTake(g, s, item));

// A station sitting idle until it gets this item (for the roll station: the ingredient it's missing)
function starvedFor(g, item, from) {
  return wantedBy(g, item, from).some((st) => {
    if (st.busy || !canTake(g, st, item)) return false;
    const r = RECIPES[st.type];
    if (r.combo) {
      const isWith = item === r.combo.with;
      return !st.inQ.some((it) => (isWith ? it === r.combo.with : !!r.combo.makes[it]));
    }
    return st.inQ.length === 0;
  });
}
// What this item is worth once a station with room turns it into food (bread counts as the roll it goes into)
function worth(g, item, from) {
  let v = 0;
  for (const st of wantedBy(g, item, from)) {
    if (!canTake(g, st, item)) continue;
    const r = RECIPES[st.type];
    const out = r.makes ? [r.makes[item]] : item === r.combo.with ? Object.values(r.combo.makes) : [r.combo.makes[item]];
    for (const o of out) v = Math.max(v, ITEMS[o]?.price || 0);
  }
  return v;
}
// Which item in a pile this worker takes. Runners grab whatever an idle station is waiting on first
// (even from the middle of a mixed pile like the dock's); everyone else takes from the top.
function pickIndex(g, a, st) {
  let top = -1, pick = -1, bestW = -1;
  for (let i = st.outQ.length - 1; i >= 0; i--) {
    const it = st.outQ[i];
    if (!can.pickFrom(g, a, st, it)) continue;
    if (a.kind !== 'runner') return i;
    // Runners: the most valuable thing an idle station is waiting on, else the top of the pile
    if (starvedFor(g, it, st)) { const w = worth(g, it, st); if (w > bestW) { bestW = w; pick = i; } }
    if (top < 0) top = i;
  }
  return pick >= 0 ? pick : top;
}

const can = {
  fish: (a, spot) => a.kind === 'player' || (a.kind === 'fisher' && a.spot === spot.id),
  dropAt: (a, st) => a.kind === 'player'
    || (a.kind === 'fisher' && (st.type === 'cut' || st.type === 'steam'))
    || (a.kind === 'runner' && st.type !== 'sink')
    || (a.kind === 'busser' && st.type === 'sink'),
  pickFrom: (g, a, st, item) => a.kind === 'player'
    || (a.kind === 'runner' && st.type !== 'sink' && hasRoom(g, item, st))
    || (a.kind === 'server' && sellable(item) && !hasRoom(g, item, st))
    || (a.kind === 'washer' && item === 'cleanPlate'),
  // Runners serve food themselves when no station has room for it, instead of standing around holding it
  counter: (a) => a.kind === 'player' || a.kind === 'server' || a.kind === 'washer' || a.kind === 'runner',
  plates: (a) => a.kind === 'player' || a.kind === 'busser',
};

// ---------- menu ----------
export function menu(g) {
  const have = new Set();
  for (const s of Object.values(g.spots)) have.add(s.fish);
  const types = new Set(Object.values(g.stations).map((s) => s.type));
  if (types.has('dock')) for (const s of Object.values(g.spots)) have.add(s.fish);
  let grew = true;
  while (grew) {
    grew = false;
    const add = (it) => { if (!have.has(it)) { have.add(it); grew = true; } };
    for (const t of types) {
      const r = RECIPES[t];
      if (r.makes) for (const [from, to] of Object.entries(r.makes)) if (have.has(from)) add(to);
      if (r.produce) add(r.produce);
      if (r.combo && have.has(r.combo.with)) for (const [from, to] of Object.entries(r.combo.makes)) if (have.has(from)) add(to);
    }
  }
  return [...have].filter(sellable);
}

// ---------- per-agent interactions ----------
function interact(g, a, dt) {
  if (a.kind === 'chef' || a.kind === 'cashier') return;
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
    // Drop ingredients into a station
    if (st.in && dist(a, st.in) < ZONE && can.dropAt(a, st)) {
      const i = a.stack.findLastIndex((it) => canTake(g, st, it));
      if (i >= 0 && ready()) {
        const [it] = a.stack.splice(i, 1);
        st.inQ.push(it);
        g.events.push({ type: 'move', item: it, from: `agent:${a.id}`, fromIndex: i, to: `in:${st.id}` });
      }
    }
    // Pick finished things up
    if (dist(a, st.out) < ZONE && st.outQ.length && room()) {
      const i = a.kind === 'player' ? st.outQ.length - 1 : pickIndex(g, a, st);
      if (i >= 0 && ready()) {
        const [it] = st.outQ.splice(i, 1);
        a.stack.push(it);
        g.events.push({ type: 'move', item: it, from: `out:${st.id}`, fromIndex: i, to: `agent:${a.id}` });
      }
    }
  }

  // Counter: food onto the counter, clean plates onto the rack
  if (can.counter(a) && dist(a, PLACES.counter.drop) < ZONE) {
    const i = a.stack.findLastIndex((it) => (sellable(it) && a.kind !== 'washer' && g.counter.length < counterMax(g)
        && (a.kind !== 'runner' || !hasRoom(g, it)))
      || (it === 'cleanPlate' && g.plates < PLATES.rackMax));
    if (i >= 0 && ready()) {
      const [it] = a.stack.splice(i, 1);
      if (it === 'cleanPlate') { g.plates++; g.events.push({ type: 'move', item: it, from: `agent:${a.id}`, fromIndex: i, to: 'rack' }); }
      else { g.counter.push(it); g.events.push({ type: 'move', item: it, from: `agent:${a.id}`, fromIndex: i, to: 'counter' }); }
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
    // The bin takes plates, and anything at all from the chef (the escape hatch for a jammed kitchen).
    // Staff only use it when it's where they're headed (no sink, or the sink is full), never in passing.
    const binOk = a.kind === 'player' || deliverTarget(g, a) === PLACES.bin;
    if (binOk && dist(a, PLACES.bin) < ZONE + 0.5) {
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
  for (const p of visiblePads(g)) if (dist(a, padPos(p)) <= ZONE) { on = { key: p.id, price: p.price, done: () => build(g, p), lock: true }; break; }
  if (!on) for (const u of upgradePads(g)) if (dist(a, u) <= 1.3) { on = { key: u.key, price: u.price, done: () => upgrade(g, u), lock: !!u.hire }; break; }
  // After a build or a hire, step off before the next pad takes money. Otherwise the extra-hire pad that
  // appears where you're standing would start charging right away. Upgrade pads still chain levels.
  if (!on) g.padLock = false;
  if (on && on.key === g.padHold?.key) g.padHold.t += dt;
  else g.padHold = on ? { key: on.key, t: 0 } : null;
  if (on && !g.padLock && g.padHold.t >= PAD_HOLD && g.cash > 0 && payInto(g, a, on.key, on.price, dt)) {
    on.done();
    if (on.lock) g.padLock = true;
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
    if (it === 'cleanPlate' && g.plates < PLATES.rackMax) return false;
    if (sellable(it) && g.counter.length < counterMax(g)) return false;
    if (Object.values(g.stations).some((s) => canTake(g, s, it))) return false;
  }
  return true;
}

export function starsFor(g) {
  return 1 + Math.floor(Math.sqrt(g.earned / g.mult / STARS.scale));
}

// ---------- stations ----------
function stepStations(g, dt) {
  for (const st of Object.values(g.stations)) {
    const r = RECIPES[st.type];
    const full = st.outQ.length >= bufMax(g, st);
    if (st.type === 'dock') continue;
    if (r.produce) {
      if (full) continue;
      st.prodT += dt * stationSpeed(g, st);
      st.busy = r.produce;
      if (st.prodT >= r.time) {
        st.prodT = 0;
        st.outQ.push(r.produce);
        g.events.push({ type: 'made', station: st.id, item: r.produce });
      }
      continue;
    }
    if (!st.busy && !full && st.inQ.length) {
      if (r.combo) {
        const w = st.inQ.indexOf(r.combo.with);
        const m = st.inQ.findIndex((it) => r.combo.makes[it]);
        if (w >= 0 && m >= 0) {
          st.busy = st.inQ[m];
          st.inQ = st.inQ.filter((_, k) => k !== w && k !== m);
        }
      } else {
        st.busy = st.inQ.shift();
      }
      if (st.busy) {
        st.timer = r.time * (r.slow?.[st.busy] || 1) / stationSpeed(g, st);
        st.total = st.timer;
        g.events.push({ type: 'start', station: st.id, item: st.busy });
      }
    }
    if (st.busy) {
      st.timer -= dt;
      if (st.timer <= 0) {
        const made = r.combo ? r.combo.makes[st.busy] : r.makes[st.busy];
        st.outQ.push(made);
        g.events.push({ type: 'made', station: st.id, item: made });
        st.busy = null;
      }
    }
  }
}

// The fishing dock: a trawler drops a crate of mixed fish (whatever you've unlocked, no squid)
function stepDock(g, dt) {
  const st = g.stations.dock;
  if (!st) return;
  g.dockT += dt;
  if (g.dockT < DOCK.every) return;
  g.dockT = 0;
  const kinds = [...new Set(Object.values(g.spots).map((s) => s.fish))].filter((f) => f !== 'squid');
  const n = DOCK.crate + DOCK.perLevel * (level(g, 'st:dock') - 1);
  let added = 0;
  for (let i = 0; i < n && st.outQ.length < bufMax(g, st); i++) {
    st.outQ.push(kinds[Math.floor(g.rng() * kinds.length)]);
    added++;
  }
  if (added) g.events.push({ type: 'crate', n: added });
}

// ---------- customers ----------
// Registers sit side by side along the counter; everyone else lines up behind the middle one.
// Registers: one per counter level up to 3, then one more every 3 levels up to 6, plus one per cashier (8 at most).
// The counter grows longer to fit them.
export const counterRegisters = (g) => { const lv = level(g, 'counter'); return lv <= 3 ? lv : Math.min(6, 3 + Math.floor((lv - 3) / 3)); };
export const registers = (g) => Math.min(8, counterRegisters(g) + g.agents.filter((a) => a.kind === 'cashier').length);
const regSpacing = (r) => (r <= 4 ? 1.7 : 1.35);
export const counterWidth = (r) => Math.max(5.2, (r - 1) * regSpacing(r) + 1.8);
export function registerSlot(i, r) { const f = PLACES.counter.front; return { x: f.x + (i - (r - 1) / 2) * regSpacing(r), z: f.z }; }
// Place k in register i's lane: 0 is at the register, the rest queue straight back from it
function laneSlot(i, r, k) { const s = registerSlot(i, r); return { x: s.x, z: s.z + (k ? 0.6 + 1.25 * k : 0) }; }

function stepCustomers(g, dt) {
  const tables = Object.values(g.tables);
  const queued = g.customers.filter((c) => c.state === 'queue');
  const cl = level(g, 'counter') - 1;
  const boost = 1 + LEVELS.counter.customers * cl;
  const every = Math.max(CUSTOMERS.minEvery / boost, CUSTOMERS.baseEvery / (1 + CUSTOMERS.perTable * tables.length) / boost);
  g.custT -= dt;
  if (g.custT <= 0) {
    g.custT = every;
    const m = menu(g);
    // Only people who've reached the line count toward it, so walkers on their way don't block new arrivals
    const waiting = queued.filter((c) => c.arrived).length;
    if (waiting < CUSTOMERS.queueMax + LEVELS.counter.queue * Math.min(cl, 6) && queued.length < 30 && m.length) {
      // Favourite dish, weighted toward pricier things on the menu
      const w = m.map((it) => Math.sqrt(ITEMS[it].price));
      let r = g.rng() * w.reduce((a, b) => a + b, 0), want = m[0];
      for (let i = 0; i < m.length; i++) { r -= w[i]; if (r <= 0) { want = m[i]; break; } }
      const vip = g.cashier && g.rng() < CASHIER.vipChance;
      const c = { id: g.custSeq++, x: PLACES.enter.x, z: PLACES.enter.z, state: 'queue', want, waitT: 0, look: g.rng(), vip };
      g.customers.push(c);
      queued.push(c);
      g.events.push({ type: 'arrive', customer: c.id, vip });
    }
  }

  // One lane per register, supermarket style: newcomers join the shortest lane and the next person
  // stands right behind the register, so a sale isn't held up by someone walking over from a long line.
  // VIPs step to the front of their lane.
  const regs = registers(g);
  const lanes = Array.from({ length: regs }, () => []);
  for (const c of queued) {
    if (c.reg === undefined || c.reg >= regs) c.reg = lanes.reduce((m, l, i) => (l.length < lanes[m].length ? i : m), 0);
    lanes[c.reg].push(c);
  }
  for (const l of lanes) l.sort((a, b) => (b.vip && b.arrived) - (a.vip && a.arrived) || a.id - b.id);
  const picky = CUSTOMERS.pickyFor / (1 + cl) / (g.cashier ? 2 : 1);
  queued.forEach((c) => {
    const pos = lanes[c.reg].indexOf(c);
    const slot = laneSlot(c.reg, regs, pos);
    if (walk(c, slot, CUSTOMERS.speed, dt)) c.arrived = true;
    if (pos > 0 || dist(c, slot) > 0.4) return;
    c.waitT += dt;
    let i = g.counter.lastIndexOf(c.want);
    if (i < 0 && c.waitT > picky && g.counter.length) {
      i = 0;
      g.counter.forEach((it, k) => { if (ITEMS[it].price > ITEMS[g.counter[i]].price) i = k; });
    }
    if (i < 0) return;
    const [it] = g.counter.splice(i, 1);
    c.food = it;
    let pay = ITEMS[it].price * g.mult * (g.boosts.cash > 0 ? 2 : 1) * (c.vip ? CASHIER.vipPay : 1);
    const plated = g.plates > 0;
    if (plated) { g.plates--; pay *= 1 + PLATES.bonus; }
    g.cashPile += pay;
    g.earned += pay;
    g.events.push({ type: 'move', item: it, from: 'counter', fromIndex: i, to: `customer:${c.id}` });
    g.events.push({ type: 'sale', amount: pay, customer: c.id, happy: it === c.want, vip: c.vip, plated });
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
        const tip = ITEMS[c.food].price * CUSTOMERS.tip * g.mult * (g.boosts.cash > 0 ? 2 : 1) * (c.vip ? CASHIER.vipPay : 1);
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
function nearest(a, list, pos = (x) => x) {
  let best = null, bd = Infinity;
  for (const it of list) { const d = dist(a, pos(it)); if (d < bd) { bd = d; best = it; } }
  return best;
}

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
// Where other staff of the same job are already headed, so a crew spreads out instead of piling onto one spot
const claimed = (g, a) => new Set(g.agents.filter((b) => b !== a && b.kind === a.kind && b.goal).map((b) => b.goal));
// Highest level first; among equals, the station with the shortest line (so the grill doesn't hog every
// fillet while the fryer and smoker sit idle); then the nearest.
function dropOff(g, a, wants, openOnly = false) {
  const all = Object.values(g.stations).filter((s) => s.in && can.dropAt(a, s) && a.stack.some((it) => wants(s, it)));
  const open = all.filter((s) => a.stack.some((it) => wants(s, it) && canTake(g, s, it)));
  const st = best(a, open.map((s) => ({ s, pos: s.in })), (o) => lv(g, o.s), (o) => -(o.s.inQ.length + (o.s.busy ? 1 : 0)))
    || (!openOnly && best(a, all.map((s) => ({ s, pos: s.in })), (o) => lv(g, o.s)));
  return st && st.s.in;
}
// Runners: first a pile holding something an idle station is waiting on (the most valuable such thing
// wins, so lobster for the steam pot beats sardine fillets), then the biggest pile. Everyone else: the biggest pile.
function pickUp(g, a) {
  const sources = Object.values(g.stations).map((s) => ({ s, pos: s.out, i: pickIndex(g, a, s) })).filter((o) => o.i >= 0);
  const taken = claimed(g, a);
  const free = sources.filter((o) => !taken.has(o.s.out));
  const runner = a.kind === 'runner';
  const urgent = (o) => (runner && starvedFor(g, o.s.outQ[o.i], o.s) ? 1 : 0);
  const value = (o) => (runner && urgent(o) ? worth(g, o.s.outQ[o.i], o.s) : 0);
  const st = best(a, free.length ? free : sources, urgent, value, (o) => o.s.outQ.length, (o) => lv(g, o.s));
  return st && st.s.out;
}

// Where a worker should go next: { x, z } or null to head home.
export function collectTarget(g, a) {
  if (a.kind === 'fisher') return g.spots[a.spot];
  if (a.kind === 'runner' || a.kind === 'server' || a.kind === 'washer') return pickUp(g, a);
  if (a.kind === 'busser') {
    const dirty = Object.values(g.tables).filter((t) => t.state === 'dirty');
    const taken = claimed(g, a);
    const free = dirty.filter((t) => !taken.has(t));
    return nearest(a, free.length ? free : dirty);
  }
  return null;
}

export function deliverTarget(g, a) {
  if (a.kind === 'runner') {
    const st = dropOff(g, a, (s, it) => accepts(s, it), true);
    if (st) return st;
    if (a.stack.some(sellable) && g.counter.length < counterMax(g)) return PLACES.counter.drop;
  }
  if (a.kind === 'fisher' || a.kind === 'runner') return dropOff(g, a, (s, it) => accepts(s, it));
  if (a.kind === 'server' || a.kind === 'washer') return PLACES.counter.drop;
  if (a.kind === 'busser') {
    const sink = g.stations.sink;
    return sink && canTake(g, sink, 'plate') ? sink.in : PLACES.bin;
  }
  return null;
}

function stepHelper(g, a, dt) {
  // Station chefs and the cashier stay at their posts
  if (a.kind === 'chef') { walk(a, STATIONS[a.station].chef, a.speed, dt); a.working = !!g.stations[a.station]?.busy; return; }
  if (a.kind === 'cashier') { walk(a, cashierPost(g, g.agents.filter((b) => b.kind === 'cashier').indexOf(a)), a.speed, dt); return; }
  if (a.mode === 'deliver' && !a.stack.length) a.mode = 'collect';
  let target;
  if (a.mode === 'collect') {
    const src = collectTarget(g, a);
    if (a.stack.length >= a.cap || (!src && a.stack.length)) { a.mode = 'deliver'; }
    else target = src;
  }
  if (a.mode === 'deliver') target = deliverTarget(g, a);
  a.goal = a.mode === 'collect' ? target || null : null;
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
  stepDock(g, dt);
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
      const offers = BOAT.offers.filter((o) => o.id !== 'upgrade' || upgradePads(g).some((u) => !u.hire));
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
    const ups = upgradePads(g).filter((u) => !u.hire);
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
export const SAVE_VERSION = 2;

export function migrate(data) {
  const out = JSON.parse(JSON.stringify(data || {}));
  if (!out.v) out.v = 1;
  // v2: the squid hole moved out past the new reef pier, so anyone who'd reached it gets the reef pier too
  if (out.v === 1) {
    out.built = out.built || [];
    if (out.built.includes('squid') && !out.built.includes('pier3')) out.built.push('pier3');
    out.v = 2;
  }
  return out;
}

export function serialize(g) {
  return {
    v: SAVE_VERSION, stars: g.stars, t: g.t,
    cash: g.cash, earned: g.earned, cashPile: g.cashPile, plates: g.plates, dockT: g.dockT,
    built: [...g.built], padPaid: g.padPaid, levels: g.levels,
    stations: Object.fromEntries(Object.values(g.stations).map((s) => [s.id, { inQ: s.inQ, outQ: s.outQ, busy: s.busy }])),
    tables: Object.fromEntries(Object.values(g.tables).map((t) => [t.id, { state: t.state === 'taken' ? 'free' : t.state, plates: t.plates }])),
    counter: g.counter,
    agents: g.agents.map((a) => ({ kind: a.kind, spot: a.spot, station: a.station, x: a.x, z: a.z, stack: a.stack })),
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
  g.plates = Math.min(PLATES.rackMax, num(data.plates)); g.dockT = num(data.dockT);
  g.padPaid = data.padPaid || {};
  g.levels = data.levels || {};
  // Extra runners and bussers: one per level above 1. Extra fishers: one per spot with a hire level.
  for (const kind of Object.keys(HIRES)) {
    if (kind === 'fisher' || kind === 'chef') continue;
    for (let i = 1; i < level(g, `hire:${kind}`); i++) hire(g, kind, PLACES.helperHome.x, PLACES.helperHome.z);
  }
  for (const id of Object.keys(g.levels)) {
    const m = id.match(/^hire:fisher:(.+)$/);
    const s = m && g.spots[m[1]];
    if (s && !g.agents.some((a) => a.kind === 'fisher' && a.spot === s.id)) hire(g, 'fisher', s.x, s.z, { spot: s.id });
    const c = id.match(/^hire:chef:(.+)$/);
    if (c && g.stations[c[1]] && !g.chefs.has(c[1])) { const p = STATIONS[c[1]].chef; hire(g, 'chef', p.x, p.z, { station: c[1] }); g.chefs.add(c[1]); }
  }
  for (const [id, s] of Object.entries(data.stations || {})) {
    const st = g.stations[id];
    if (!st) continue;
    st.inQ = items(s.inQ).filter((it) => accepts(st, it)).slice(0, bufMax(g, st));
    st.outQ = items(s.outQ).slice(0, bufMax(g, st));
    // The dish that was mid-cook goes back to the front of the line (even if the line is already full)
    if (s.busy && accepts(st, s.busy)) st.inQ.unshift(s.busy);
  }
  for (const [id, t] of Object.entries(data.tables || {})) {
    if (g.tables[id] && t.state === 'dirty') { g.tables[id].state = 'dirty'; g.tables[id].plates = num(t.plates, 1); }
  }
  g.counter = items(data.counter).filter(sellable).slice(0, counterMax(g));
  // Match saved staff to the rebuilt crew by job (and fishing spot), in order
  const pool = [...g.agents];
  (data.agents || []).forEach((s) => {
    const i = pool.findIndex((a) => a.kind === s.kind && (s.spot === undefined || a.spot === s.spot) && (s.station === undefined || a.station === s.station));
    if (i < 0) return;
    const [a] = pool.splice(i, 1);
    a.x = num(s.x, a.x); a.z = num(s.z, a.z);
    a.stack = items(s.stack).slice(0, a.cap);
  });
  for (const a of g.agents) if (a.kind !== 'player') applyStaff(g, a);
  g.squidCaught = !!data.squidCaught;
  g.boosts = { cash: num(data.boosts?.cash), rush: num(data.boosts?.rush) };
  g.boat.t = num(data.boatT, 60);
  return g;
}
