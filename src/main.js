import * as THREE from 'three';
import { createGame, step, visiblePads, padPos, playerStuck, upgradePads, claimBoat, serialize, restore, padsLeft } from './logic.js';
import { STARS } from './config.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { unlock, sfx, toggleMute, isMuted } from './sound.js';
import { showRewardedAd } from './ads.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

// Stars persist between runs in this browser
let stars = 0;
try { stars = Number(localStorage.getItem('ff-stars')) || 0; } catch { /* storage blocked */ }

// Saved shack, if there is one
const SAVE_KEY = 'ff-save';
let saved = null;
try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { saved = null; }
if (saved && typeof saved !== 'object') saved = null;
if (saved) stars = Math.max(stars, Number(saved.stars) || 0);
let g = null;
try { if (saved) { g = restore({ ...saved, stars }); } } catch { g = null; saved = null; }
if (!g) g = createGame(stars, (Date.now() % 100000) | 0);

function save() {
  if (!running) return;
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(serialize(g))); } catch { /* storage blocked */ }
}
setInterval(save, 5000);
addEventListener('pagehide', save);
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });

// ---------- three ----------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fd3f0);
scene.fog = new THREE.Fog(0x8fd3f0, 70, 170);
const camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.5, 600);
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});
const hemi = new THREE.HemisphereLight(0xe6f6ff, 0xd9b77a, 1.3);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff1d6, 1.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0005;
Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
scene.add(sun, sun.target);

// ---------- HUD helpers ----------
const tmpV = new THREE.Vector3();
function popup(text, world, cls = '') {
  tmpV.copy(world).project(camera);
  if (tmpV.z > 1) return;
  const el = document.createElement('div');
  el.className = `pop stroke ${cls}`;
  el.textContent = text;
  el.style.left = `${(tmpV.x * 0.5 + 0.5) * innerWidth + (Math.random() - 0.5) * 30}px`;
  el.style.top = `${(-tmpV.y * 0.5 + 0.5) * innerHeight}px`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
let bannerT = 0;
function banner(big, small = '', secs = 2.6) {
  $('bannerBig').textContent = big;
  $('bannerSmall').textContent = small;
  $('banner').classList.add('show');
  bannerT = secs;
}
const money = (n) => `$${Math.floor(n).toLocaleString()}`;

let view = createRenderer(g, scene, { popup });
const readInput = createInput($('stick'), $('knob'));

// ---------- events that touch the HUD ----------
function onEvent(e) {
  view.handleEvent(e);
  if (e.type === 'built') {
    const verb = e.pad.kind === 'helper' ? 'HIRED!' : e.pad.kind === 'upgrade' ? 'UPGRADED!' : e.pad.kind === 'area' ? 'OPEN!' : 'BUILT!';
    banner(`${e.pad.label.replace(/^Hire an? /, '').toUpperCase()} ${verb}`);
  }
  if (e.type === 'upgraded') {
    const id = e.up.id;
    const what = id.startsWith('st:') ? 'Works faster and holds more'
      : id === 'counter' ? (e.level <= 3 || (e.level <= 12 && (e.level - 3) % 3 === 0) ? 'New register! More customers, more room' : 'More customers, more room')
      : id.startsWith('spot:') ? 'Fish bite faster'
      : 'Helpers carry more and move faster';
    banner(`${e.up.name.toUpperCase()} LV ${e.level}`, what);
  }
  if (e.type === 'hired') {
    const what = e.up.hire === 'chef' ? 'Works the station at double speed'
      : e.up.hire === 'fisher' ? 'Fishes this spot and hauls the catch to the kitchen'
      : e.up.hire === 'runner' ? 'Carries food between stations' : e.up.hire === 'server' ? 'Brings finished food to the counter' : e.up.hire === 'cashier' ? 'Opens another register' : 'Clears tables';
    banner(`${e.up.name.replace(/^Hire an? /, '').toUpperCase()} HIRED!`, what);
  }
  if (e.type === 'boatArrive') banner('DELIVERY BOAT!', `${e.offer.label}. It's docked by the pier for a little while.`, 3);
  if (e.type === 'boatClaim') {
    // Pause while the (optional) ad plays; reward only if it was watched to the end
    running = false;
    const shack = g;
    showRewardedAd().then((watched) => { claimBoat(shack, watched); }, () => claimBoat(shack, false))
      .finally(() => { running = true; clock.getDelta(); });
  }
  if (e.type === 'boatReward') banner('BONUS!', e.detail, 2.6);
  if (e.type === 'legend') {
    sfx.legend();
    banner('LEGENDARY CATCH!', 'Giant squid! A Sell the Shack pad just appeared by the tables.', 4.5);
  }
  if (e.type === 'sell') {
    sfx.sold();
    const total = stars + e.stars;
    stars = total;
    try { localStorage.setItem('ff-stars', String(total)); localStorage.removeItem(SAVE_KEY); } catch { /* storage blocked */ }
    $('soldStars').textContent = `+${e.stars} ★`;
    $('soldText').textContent = `You earned ${money(g.earned)} this run. Prices are now +${Math.round(STARS.priceBonus * total * 100)}% forever.`;
    $('banner').classList.remove('show');
    bannerT = 0;
    $('sold').classList.add('show');
    running = false;
  }
}

// ---------- loop ----------
const clock = new THREE.Clock();
let time = 0, running = false;

function tick() {
  const dt = Math.min(clock.getDelta(), 1 / 20);
  time += dt;
  if (running) {
    const inp = readInput();
    const sp = g.player.speed * g.player.speedMult;
    g.player.x += inp.x * sp * dt;
    g.player.z += inp.y * sp * dt;
    if (inp.x || inp.y) $('hint').style.opacity = '0';
    step(g, dt);
    for (const e of g.events) onEvent(e);
    g.events.length = 0;
  }
  view.sync(dt, time);

  // HUD
  $('cash').textContent = money(g.cash);
  $('stars').textContent = `★ ${g.stars}`;
  $('bonus').hidden = !g.stars;
  $('bonus').textContent = `+${Math.round(STARS.priceBonus * g.stars * 100)}% prices`;
  $('basket').textContent = `BASKET ${g.player.stack.length}/${g.player.cap}`;
  $('basket').classList.toggle('full', g.player.stack.length >= g.player.cap);
  const next = visiblePads(g).reduce((m, p) => (!m || p.price < m.price ? p : m), null);
  const stuck = playerStuck(g);
  $('next').classList.toggle('warn', stuck);
  $('next').textContent = stuck ? 'Basket full and nowhere to put it? Dump extras in the trash'
    : g.squidCaught ? 'Sell the Shack when you are ready'
    : g.built.has('squid') ? 'Catch the giant squid at the end of the pier'
    : next ? `Next: ${next.label} · ${money(next.price)}${padsLeft(g) ? ` · ${padsLeft(g)} left to unlock the squid` : ''}` : 'Catch the giant squid at the end of the pier';
  if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').classList.remove('show');
  const clockText = (s) => { const t = Math.ceil(s); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  const chips = [];
  if (g.boosts.cash > 0) chips.push(`2× CASH ${clockText(g.boosts.cash)}`);
  if (g.boosts.rush > 0) chips.push(`STAFF RUSH ${clockText(g.boosts.rush)}`);
  if (g.boat.state === 'docked') chips.push(`Boat at the pier · ${Math.ceil(g.boat.t)}s`);
  $('boost').hidden = !chips.length;
  $('boost').textContent = chips.join('  ·  ');

  // Camera follows the chef, pulling back a little on tall screens
  const portrait = Math.max(1, 1 / camera.aspect) ** 0.5;
  const dist = 16 * portrait;
  tmpV.set(g.player.x, dist * 0.82, g.player.z + dist * 0.72);
  camera.position.lerp(tmpV, 1 - Math.exp(-dt * 5));
  camera.lookAt(g.player.x, 0.5, g.player.z - 2);
  sun.position.set(g.player.x + 18, 40, g.player.z + 14);
  sun.target.position.set(g.player.x, 0, g.player.z - 4);

  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
camera.position.set(g.player.x, 19, g.player.z + 14);
requestAnimationFrame(tick);

// ---------- start, sound, sell ----------
$('startStars').textContent = stars ? `★ ${stars} · prices +${Math.round(STARS.priceBonus * stars * 100)}%` : 'Catch it. Cut it. Cook it. Sell it.';
if (saved) {
  $('startBtn').textContent = 'Continue your shack';
  $('savedInfo').hidden = false;
  $('savedInfo').textContent = `${g.built.size} things built · ${money(g.cash)} in your pocket`;
  $('freshBtn').hidden = false;
}
// Starting over needs a second tap, so nobody wipes a save by accident
$('freshBtn').addEventListener('click', () => {
  if ($('freshBtn').dataset.armed !== '1') {
    $('freshBtn').dataset.armed = '1';
    $('freshBtn').textContent = 'Tap again to erase your shack (stars are kept)';
    return;
  }
  try { localStorage.removeItem(SAVE_KEY); } catch { /* storage blocked */ }
  scene.clear();
  scene.add(hemi, sun, sun.target);
  g = createGame(stars, (Date.now() % 100000) | 0);
  view = createRenderer(g, scene, { popup });
  if (window.game) window.game.g = g;
  start();
});
function start() {
  unlock();
  $('start').classList.add('gone');
  $('hud').hidden = false;
  $('hint').hidden = false;
  running = true;
  clock.getDelta();
}
$('startBtn').addEventListener('click', start);
// Start the next shack in place, so stars carry over even where the browser won't save them
function newShack() {
  scene.clear();
  scene.add(hemi, sun, sun.target);
  g = createGame(stars, (Date.now() % 100000) | 0);
  view = createRenderer(g, scene, { popup });
  if (window.game) window.game.g = g;
  camera.position.set(g.player.x, 19, g.player.z + 14);
  $('sold').classList.remove('show');
  banner(`★ ${stars} · PRICES +${Math.round(STARS.priceBonus * stars * 100)}%`, 'Every customer pays more in this shack', 3.5);
  running = true;
  clock.getDelta();
}
$('again').addEventListener('click', newShack);
addEventListener('pointerdown', unlock);
addEventListener('keydown', unlock);
$('mute').textContent = isMuted() ? 'SOUND OFF' : 'SOUND ON';
$('mute').addEventListener('click', (e) => {
  e.stopPropagation();
  unlock();
  $('mute').textContent = toggleMute() ? 'SOUND OFF' : 'SOUND ON';
});
if (params.has('play')) start();
if (params.has('debug')) {
  window.game = { g, give(n) { g.cash += n; }, goto(x, z) { g.player.x = x; g.player.z = z; }, pads: () => visiblePads(g).map(padPos), ups: () => upgradePads(g) };
}
