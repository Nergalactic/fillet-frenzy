// Save round-trip: play a while, save, restore into a fresh game, compare. Also loads a v1-shaped save.
import { createGame, step, serialize, restore } from '../src/logic.js';
const g = createGame(0);
g.cash = 1e7;
// Let the game auto-buy by walking the player across pads is complex; instead mark lots of things built via the same path the game uses
const p = g.player;
import { visiblePads, padPos, hirePads } from '../src/logic.js';
for (let i = 0; i < 60; i++) {
  const pad = visiblePads(g)[0]; if (!pad) break;
  const pos = padPos(pad); p.x = pos.x; p.z = pos.z;
  for (let k = 0; k < 120; k++) step(g, 1 / 30);
  g.events.length = 0; g.cash = 1e7;
  p.x = -3; p.z = 25; step(g, 1 / 30);   // step off before the next pad
}
// Extra hires: a couple of fishers, two more runners, one more busser and server
const want = { fisher: 2, runner: 2, busser: 1, server: 1, chef: 2 };
for (let i = 0; i < 20; i++) {
  const h = hirePads(g).find((u) => want[u.hire] > 0); if (!h) break;
  want[h.hire]--; p.x = h.x; p.z = h.z; g.cash = 1e7;
  for (let k = 0; k < 90; k++) step(g, 1 / 30);
  g.events.length = 0; p.x = -3; p.z = 25; step(g, 1 / 30);
}
for (let k = 0; k < 30 * 60; k++) { step(g, 1 / 30); g.events.length = 0; }
// On load, a dish that was mid-cook goes back to the front of its station's queue (the bakery just starts
// a fresh loaf), so compare with that in mind
const norm = (o) => {
  const x = JSON.parse(JSON.stringify(o));
  for (const [id, st] of Object.entries(x.stations)) { if (st.busy && id !== 'bakery') st.inQ.unshift(st.busy); st.busy = null; }
  return x;
};
const s1 = JSON.stringify(norm(serialize(g)));
const g2 = restore(JSON.parse(s1), 0);
const s2 = JSON.stringify(norm(serialize(g2)));
console.log('built:', Object.keys(g.stations).length, 'stations,', g.agents.length, 'staff, areas', g.areas.join ? g.areas.join(',') : [...g.areas].join(','), 'plates', g.plates);
console.log('staff', g.agents.length, 'restored staff', g2.agents.length);
console.log('round-trip identical:', s1 === s2);
if (s1 !== s2) { const a = JSON.parse(s1), b = JSON.parse(s2); for (const k in a) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) console.log(' differs:', k); }
// v1 save: older shape, squid built, no pier3
const old = JSON.parse(s1); old.v = 1; old.built = (old.built || []).filter((x) => !['pier3', 'lb1'].includes(x));
const g3 = restore(old, 0);
console.log('v1 migrated, has pier3:', [...(g3.areas || [])].includes('pier3'));
for (let k = 0; k < 30 * 30; k++) { step(g3, 1 / 30); g3.events.length = 0; }
console.log('v1 game runs, earned', Math.round(g3.earned));
if (process.env.DEBUG) { const a = JSON.parse(s1).stations, b = JSON.parse(s2).stations; for (const k in a) if (JSON.stringify(a[k]) !== JSON.stringify(b[k])) console.log(k, JSON.stringify(a[k]), '\n ->', JSON.stringify(b[k])); }
