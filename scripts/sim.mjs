// Headless balance check: a bot plays the shack until it catches the giant squid and sells.
// Run with: npm run sim
import { createGame, step, visiblePads, padPos, menu, sellable, ZONE, BUFFER_MAX, COUNTER_MAX } from '../src/logic.js';
import { PLACES, RECIPES, SPOTS, SELL_PAD, ITEMS } from '../src/config.js';

const stars = Number(process.argv[2] || 0);
const g = createGame(stars);
const dt = 1 / 30, LIMIT = 90 * 60;
const p = g.player;
const log = [];
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const d = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const cookers = ['grill', 'fryer', 'sushi'];
let fishingAt = null, sold = false;

function target() {
  const pads = visiblePads(g);
  const cheapest = pads.reduce((m, x) => (!m || x.price - (g.padPaid[x.id] || 0) < m.price - (g.padPaid[m.id] || 0) ? x : m), null);
  const need = cheapest ? cheapest.price - (g.padPaid[cheapest.id] || 0) : Infinity;
  if (g.squidCaught) return SELL_PAD;
  if (cheapest && g.cash >= need) return padPos(cheapest);
  if (cheapest && g.cash + g.cashPile >= need) return PLACES.counter.cash;

  const st = Object.values(g.stations);
  const helpers = new Set(g.agents.map((a) => a.kind));
  // Keep grabbing while standing at a pile with room left, like a person would
  const here = st.find((s) => s.outQ.length && d(p, s.out) < ZONE && !(helpers.has('runner') && s.type === 'cut'));
  if (here && p.stack.length < p.cap && !fishingAt) return here.out;
  // Deliver what we're carrying
  if (p.stack.length && !(fishingAt && p.stack.length < p.cap)) {
    fishingAt = null;
    const top = p.stack;
    if (top.includes('plate')) return PLACES.bin;
    const raw = top.find((it) => !sellable(it) && it !== 'plate');
    if (raw) {
      const cut = st.filter((s) => s.type === 'cut' && s.inQ.length < BUFFER_MAX).sort((a, b) => d(p, a.in) - d(p, b.in))[0];
      if (cut) return cut.in;
    }
    for (const it of top) {
      const cook = st.filter((s) => cookers.includes(s.type) && RECIPES[s.type].makes[it] && s.inQ.length < BUFFER_MAX)
        .sort((a, b) => ITEMS[RECIPES[b.type].makes[it]].price - ITEMS[RECIPES[a.type].makes[it]].price)[0];
      if (cook) return cook.in;
    }
    if (g.counter.length < COUNTER_MAX) return PLACES.counter.drop;
  }
  // Pick up finished food, best first
  const outs = st.filter((s) => s.outQ.length && !(helpers.has('runner') && s.type === 'cut'))
    .sort((a, b) => (cookers.includes(b.type) ? 1 : 0) - (cookers.includes(a.type) ? 1 : 0));
  if (outs.length && !fishingAt && (!helpers.has('server') || outs[0].type === 'cut')) return outs[0].out;
  if (!helpers.has('busser')) {
    const dirty = Object.values(g.tables).find((t) => t.state === 'dirty');
    if (dirty && !fishingAt) return dirty;
  }
  if (g.cashPile > 40 && !fishingAt) return PLACES.counter.cash;
  // Fish at the best spot no helper is working
  const taken = new Set(g.agents.filter((a) => a.kind === 'fisher').map((a) => a.spot));
  const order = ['sq', 't1', 't2', 's1', 's2'];
  const spot = order.map((id) => g.spots[id]).find((s) => s && !taken.has(s.id)) || g.spots.s1;
  fishingAt = spot.id;
  return spot;
}

while (g.t < LIMIT && !sold) {
  const t = target();
  const dx = t.x - p.x, dz = t.z - p.z, dd = Math.hypot(dx, dz);
  const sp = p.speed * p.speedMult;
  if (dd > 0.4) { const s = Math.min(dd - 0.3, sp * dt); p.x += (dx / dd) * s; p.z += (dz / dd) * s; }
  if (fishingAt && p.stack.length >= p.cap) fishingAt = null;
  step(g, dt);
  for (const e of g.events) {
    if (e.type === 'built') log.push(`${mmss(g.t).padStart(6)}  ${e.pad.label} ($${e.pad.price})`);
    if (e.type === 'legend') log.push(`${mmss(g.t).padStart(6)}  ** GIANT SQUID CAUGHT **`);
    if (e.type === 'sell') { log.push(`${mmss(g.t).padStart(6)}  SOLD for ${e.stars} star(s), earned $${Math.round(g.earned)}`); sold = true; }
  }
  g.events.length = 0;
}
console.log(`stars at start: ${stars}`);
console.log(log.join('\n'));
if (!sold) console.log(`\nnot finished after ${mmss(g.t)}: cash $${Math.round(g.cash)}, pile $${Math.round(g.cashPile)}, earned $${Math.round(g.earned)}, next pads: ${visiblePads(g).map((x) => x.label).join(', ')}`);
