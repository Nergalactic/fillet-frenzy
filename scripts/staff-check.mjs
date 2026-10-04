// Staff-only check: build everything, park the player, and count what each station receives.
// Every station with a supply should get used without the player's help.
import { createGame, step, visiblePads, padPos, hirePads } from '../src/logic.js';
const g = createGame(0);
const p = g.player;
for (let i = 0; i < 200; i++) {
  const pad = visiblePads(g)[0]; if (!pad) break;
  const pos = padPos(pad); p.x = pos.x; p.z = pos.z; g.cash = 1e7;
  for (let k = 0; k < 90; k++) step(g, 1 / 30);
  g.events.length = 0;
  p.x = -3; p.z = 25; step(g, 1 / 30);  // step off so the next pad can take money
}
// Then hire a fisher for every spot and EXTRA more runners and bussers (default 2 each)
const extra = Number(process.env.EXTRA ?? 2), want = { runner: extra, busser: extra, server: extra };
for (let i = 0; i < 60; i++) {
  const h = hirePads(g).find((u) => (u.hire === 'fisher' && !process.env.NOHIRE) || (u.hire === 'chef' && !process.env.NOHIRE) || want[u.hire] > 0);
  if (!h) break;
  if (want[h.hire] !== undefined) want[h.hire]--;
  p.x = h.x; p.z = h.z; g.cash = 1e7;
  for (let k = 0; k < 90; k++) step(g, 1 / 30);
  g.events.length = 0;
  p.x = -3; p.z = 25; step(g, 1 / 30);
}
p.x = -3; p.z = 25; g.cash = 0;
const got = {}, made = {}, fisherTo = {};
let binned = 0;
const kindOf = (id) => g.agents.find((a) => a.id === id)?.kind;
const MIN = Number(process.env.MIN || 10);
for (let k = 0; k < 30 * 60 * MIN; k++) {
  step(g, 1 / 30);
  for (const e of g.events) {
    if (e.type === 'move' && e.to.startsWith('in:')) {
      got[e.to.slice(3)] = (got[e.to.slice(3)] || 0) + 1;
      if (e.from.startsWith('agent:') && kindOf(e.from.slice(6)) === 'fisher') { const k = `${e.item} -> ${e.to.slice(3)}`; fisherTo[k] = (fisherTo[k] || 0) + 1; }
    }
    if (e.type === 'move' && e.to === 'bin') binned++;
    if (e.type === 'move' && e.from.startsWith('out:')) made[e.from.slice(4)] = (made[e.from.slice(4)] || 0) + 1;
  }
  g.events.length = 0;
}
console.log('staff:', g.agents.map((a) => a.kind + (a.spot ? '@' + a.spot : '')).join(' '));
console.log('station   fed  picked-up  in/out now');
for (const s of Object.values(g.stations)) console.log(s.id.padEnd(9), String(got[s.id] || 0).padStart(4), String(made[s.id] || 0).padStart(9), `  ${s.inQ.length}/${s.outQ.length}`);
console.log('fishers delivered:', Object.entries(fisherTo).map(([k, v]) => `${k} x${v}`).join(', '));
console.log(`plates thrown in the trash by staff: ${binned}`);
console.log(`counter ${g.counter.length} items, ${g.customers?.length ?? '?'} customers`);
console.log(`earned in ${MIN} min, staff only: $${Math.round(g.earned)}`);
if (process.env.DEBUG) {
  const { collectTarget, deliverTarget } = await import('../src/logic.js');
  for (const a of g.agents) if (['runner','server'].includes(a.kind)) console.log(a.kind, a.mode, a.stack.join(','), 'at', a.x.toFixed(1), a.z.toFixed(1), 'collect->', JSON.stringify(collectTarget(g, a)), 'deliver->', JSON.stringify(deliverTarget(g, a)));
  console.log('dock out', g.stations.dock.outQ.join(','), '| bakery out', g.stations.bakery.outQ.length, '| cut2 in', g.stations.cut2.inQ.join(','));
}
