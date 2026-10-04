// Checks the map: no two interactive zones overlap, everything is walkable, and fishing lines land in water.
// Run with: node scripts/layout-check.mjs
import { STATIONS, SPOTS, PADS, LEVELS, BOAT, PLACES, SELL_PAD, AREAS, TABLES, HIRES } from '../src/config.js';
import { fisherPadPos } from '../src/logic.js';

const pts = [];
const add = (n, p, r) => p && pts.push({ n, x: p.x, z: p.z, r });
for (const [k, s] of Object.entries(STATIONS)) {
  add(`${k} in`, s.in, 1.7); add(`${k} out`, s.out, 1.7);
  add(`${k} up`, s.up || { x: s.x, z: s.z + 2.7 }, 1.3);
}
for (const [k, s] of Object.entries(SPOTS)) { add(k, s, 1.7); add(`${k} up`, s.up, 1.3); if (s.up) add(`${k} hire fisher`, fisherPadPos(s), 1.3); }
for (const [k, h] of Object.entries(HIRES)) if (h.x !== undefined) add(`hire ${k}`, h, 1.3);
for (const [k, c] of Object.entries(HIRES.chef)) add(`hire chef ${k}`, c, 1.3);
for (const [k, t] of Object.entries(TABLES)) add(`table ${k}`, t, 2.6);
for (const p of PADS) if (p.x !== undefined && !['station', 'spot', 'table'].includes(p.kind)) add(`pad ${p.id}`, p, 1.7);
add('counter up', LEVELS.counter, 1.3); add('staff up', LEVELS.staff, 1.3); add('boat pad', BOAT.pad, 1.7);
add('counter drop', PLACES.counter.drop, 1.7); add('cash', PLACES.counter.cash, 2.1); add('bin', PLACES.bin, 2.2); add('sell', SELL_PAD, 1.7);

let bad = 0;
for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
  const d = Math.hypot(pts[i].x - pts[j].x, pts[i].z - pts[j].z);
  // An extra-hire pad takes over the spot of the first hire's pad, which is gone by then
  if ([pts[i].n, pts[j].n].sort().join() === `hire ${pts[i].n.split(' ')[1]},pad ${pts[i].n.split(' ')[1]}`) continue;
  if (d < pts[i].r + pts[j].r) { bad++; console.log('overlap', pts[i].n, '<->', pts[j].n, d.toFixed(2)); }
}
const inside = (p, a) => { const r = AREAS[a]; return p.x >= r.x0 && p.x <= r.x1 && p.z >= r.z0 && p.z <= r.z1; };
const onLand = (p) => Object.keys(AREAS).some((a) => inside(p, a));
for (const q of pts) if (!onLand(q)) { bad++; console.log('not walkable:', q.n, q.x, q.z); }
for (const [k, s] of Object.entries(SPOTS)) if (onLand(s.water)) { bad++; console.log('line lands on deck:', k); }
console.log(bad ? `${bad} problems` : 'layout OK');
process.exit(bad ? 1 : 0);
