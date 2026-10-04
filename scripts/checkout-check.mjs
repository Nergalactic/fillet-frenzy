// Checkout throughput: everything built, counter kept fully stocked, count sales per minute.
// Shows whether the checkout itself (registers, customers walking up) is the limit.
import { createGame, step, visiblePads, padPos, registers, counterMax } from '../src/logic.js';
const LV = Number(process.env.LV || 17);
const g = createGame(0), p = g.player;
for (let i = 0; i < 200; i++) {
  const pad = visiblePads(g)[0]; if (!pad) break;
  const q = padPos(pad); p.x = q.x; p.z = q.z; g.cash = 1e7;
  for (let k = 0; k < 90; k++) step(g, 1 / 30);
  g.events.length = 0; p.x = -3; p.z = 25; step(g, 1 / 30);
}
g.levels.counter = LV;
let sales = 0;
const T = 120;
for (let k = 0; k < 30 * T; k++) {
  while (g.counter.length < counterMax(g)) g.counter.push(g.counter.length % 2 ? 'takoyaki' : 'lobsterRoll');
  step(g, 1 / 30);
  for (const e of g.events) if (e.type === 'sale') sales++;
  g.events.length = 0;
}
const waiting = g.customers.filter((c) => c.state === 'queue').length;
console.log(`counter Lv ${LV}: ${registers(g)} registers, ${Math.round(sales / (T / 60))} sales/min, ${waiting} customers in line at the end`);
if (process.env.DEBUG) {
  const q = g.customers.filter((c) => c.state === 'queue');
  console.log('arrived', q.filter((c) => c.arrived).length, 'walking', q.filter((c) => !c.arrived).length, 'lanes', JSON.stringify(Object.entries(Object.groupBy(q, (c) => c.reg)).map(([k, v]) => [k, v.length])));
  console.log('states', JSON.stringify(Object.entries(Object.groupBy(g.customers, (c) => c.state)).map(([k, v]) => [k, v.length])));
}
