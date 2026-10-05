// Headless balance check: a bot plays the shack until it catches the giant squid and sells.
// Run with: npm run sim            (add a star count: npm run sim -- 2)
//           NO_UPGRADES=1 npm run sim
import { createGame, step, visiblePads, padPos, sellable, ZONE, counterMax, upgradePads, canTake, accepts } from '../src/logic.js';
import { PLACES, RECIPES, SELL_PAD, ITEMS, PLATES } from '../src/config.js';

const stars = Number(process.argv[2] || 0);
const g = createGame(stars);
const dt = 1 / 30, LIMIT = (process.env.SIMPLE ? 40 : 120) * 60;
const p = g.player;
const log = [], ups = [];
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const FISH_ORDER = ['squid', 'octopus', 'lobster', 'tuna', 'crab', 'salmon', 'sardine'];
let fishingAt = null, sold = false;
const SIMPLE_BUILD = new Set(['grill', 'cut2', 'fryer', 's2', 'fisher1', 'runner', 'server', 'busser', 'tb1', 'tb2', 'tb3', 'tb4', 'basket1']);
const SIMPLE_MAX = { counter: 9, 'hire:runner': 5, 'hire:server': 3, 'hire:busser': 3, 'hire:fisher:s2': 2 };
function SIMPLE_OK(key) {
  if (!key.includes('#')) return SIMPLE_BUILD.has(key);
  const [id, lv] = key.split('#');
  return SIMPLE_MAX[id] !== undefined && Number(lv) < SIMPLE_MAX[id];
}

// What a station would turn this item into (for picking the most valuable destination)
function outputOf(st, it) {
  const r = RECIPES[st.type];
  if (r.makes) return r.makes[it];
  if (r.combo) return it === r.combo.with ? Object.values(r.combo.makes)[0] : r.combo.makes[it];
  return null;
}
const value = (it) => (it && ITEMS[it]?.price) || 0;

function target() {
  // Everything buyable: build pads plus (unless NO_UPGRADES) upgrade pads
  let pads = visiblePads(g).map((x) => ({ key: x.id, price: x.price, pos: padPos(x) }))
    .concat(process.env.NO_UPGRADES ? [] : upgradePads(g).map((u) => ({ key: u.key, price: u.price, pos: u })));
  // SIMPLE=1: just a small shack (two cutting boards, grill, fryer, Lv 9 counter, five runners, two fishers,
  // a few bussers, servers, and tables). It can't reach the squid that way, so it runs 40 minutes and reports income.
  if (process.env.SIMPLE) pads = pads.filter((x) => SIMPLE_OK(x.key));
  const left = (x) => x.price - (g.padPaid[x.key] || 0);
  // Like a sensible player: build things first, and take an upgrade when it's cheap next to the next build
  const builds = pads.filter((x) => !x.key.includes('#'));
  const nextBuild = builds.reduce((m, x) => (!m || left(x) < left(m) ? x : m), null);
  const upgradesOk = pads.filter((x) => x.key.includes('#') && (!nextBuild || left(x) <= left(nextBuild) * Number(process.env.UPRATIO || 0.3)));
  const cheapest = [nextBuild, ...upgradesOk].filter(Boolean).reduce((m, x) => (!m || left(x) < left(m) ? x : m), null);
  const need = cheapest ? left(cheapest) : Infinity;
  if (g.squidCaught) return SELL_PAD;
  // Once the squid hole is open, go get it
  if (g.spots.sq && (p.stack.length < p.cap || fishingAt === 'sq')) { fishingAt = 'sq'; return g.spots.sq; }
  if (cheapest && g.cash >= need) return cheapest.pos;
  if (cheapest && g.cash + g.cashPile >= need) return PLACES.counter.cash;

  const st = Object.values(g.stations);
  // Keep grabbing while standing at a pile with room left, like a person would
  const here = st.find((s) => s.outQ.length && d(p, s.out) < ZONE);
  if (here && p.stack.length < p.cap && !fishingAt) return here.out;
  // Deliver what we're carrying, to wherever makes it most valuable
  if (p.stack.length && !(fishingAt && p.stack.length < p.cap)) {
    fishingAt = null;
    if (p.stack.includes('plate')) return g.stations.sink && canTake(g, g.stations.sink, 'plate') ? g.stations.sink.in : PLACES.bin;
    if (p.stack.includes('cleanPlate') && g.plates < PLATES.rackMax) return PLACES.counter.drop;
    let bestDest = null, bestVal = -1;
    for (const it of p.stack) {
      for (const s of st) {
        if (s.type === 'sink' || !canTake(g, s, it)) continue;
        const v = value(outputOf(s, it)) + 0.01;
        if (v > bestVal) { bestVal = v; bestDest = s.in; }
      }
      if (sellable(it) && g.counter.length < counterMax(g) && value(it) > bestVal) { bestVal = value(it); bestDest = PLACES.counter.drop; }
    }
    if (bestDest) return bestDest;
    return PLACES.bin;
  }
  // Pick up from the biggest finished pile
  const outs = st.filter((s) => s.outQ.length).sort((a, b) => b.outQ.length - a.outQ.length);
  if (outs.length && !fishingAt && outs[0].outQ.length >= 3) return outs[0].out;
  if (!g.agents.some((a) => a.kind === 'busser')) {
    const dirty = Object.values(g.tables).find((t) => t.seats.includes('dirty'));
    if (dirty && !fishingAt) return dirty;
  }
  if (g.cashPile > 40 && !fishingAt) return PLACES.counter.cash;
  if (outs.length && !fishingAt) return outs[0].out;
  // Fish at the most valuable spot no fisher is working
  const taken = new Set(g.agents.filter((a) => a.kind === 'fisher').map((a) => a.spot));
  const spots = Object.values(g.spots).filter((s) => !taken.has(s.id))
    .sort((a, b) => FISH_ORDER.indexOf(a.fish) - FISH_ORDER.indexOf(b.fish));
  const spot = spots[0] || g.spots.s1;
  fishingAt = spot.id;
  return spot;
}

let lastEarned = 0;
while (g.t < LIMIT && !sold) {
  const t = target();
  const dx = t.x - p.x, dz = t.z - p.z, dd = Math.hypot(dx, dz);
  const sp = p.speed * p.speedMult;
  if (dd > 0.4) { const s = Math.min(dd - 0.3, sp * dt); p.x += (dx / dd) * s; p.z += (dz / dd) * s; }
  if (fishingAt && p.stack.length >= p.cap) fishingAt = null;
  step(g, dt);
  for (const e of g.events) {
    if (e.type === 'built') log.push(`${mmss(g.t).padStart(6)}  ${e.pad.label} ($${e.pad.price})`);
    if (e.type === 'upgraded') ups.push(`${e.up.name} ${e.level}`);
    if (e.type === 'hired') ups.push(e.up.label || e.up.name);
    if (e.type === 'legend') log.push(`${mmss(g.t).padStart(6)}  ** GIANT SQUID CAUGHT **`);
    if (e.type === 'sell') { log.push(`${mmss(g.t).padStart(6)}  SOLD for ${e.stars} star(s), earned $${Math.round(g.earned)}`); sold = true; }
  }
  g.events.length = 0;
  if (process.env.RATE && Math.abs(g.t % 300) < dt) { log.push(`        [${mmss(g.t)}] $/min over last 5 min: ${Math.round((g.earned - lastEarned) / 5)}`); lastEarned = g.earned; }
}
console.log(`stars at start: ${stars}`);
console.log(log.join('\n'));
console.log(`\nupgrades bought: ${ups.length}${process.env.SIMPLE ? " — " + ups.join(", ") : ""}`);
if (!sold) console.log(`\nnot finished after ${mmss(g.t)}: cash $${Math.round(g.cash)}, pile $${Math.round(g.cashPile)}, earned $${Math.round(g.earned)}, next pads: ${visiblePads(g).map((x) => x.label).join(', ')}`);
