import * as THREE from 'three';
import { createGame, step, visiblePads, padPos } from './logic.js';
import { STARS } from './config.js';
import { createRenderer } from './render.js';
import { createInput } from './input.js';
import { unlock, sfx, toggleMute, isMuted } from './sound.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);

// Stars persist between runs in this browser
let stars = 0;
try { stars = Number(localStorage.getItem('ff-stars')) || 0; } catch { /* storage blocked */ }
const g = createGame(stars, (Date.now() % 100000) | 0);

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
scene.add(new THREE.HemisphereLight(0xe6f6ff, 0xd9b77a, 1.3));
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

const view = createRenderer(g, scene, { popup });
const readInput = createInput($('stick'), $('knob'));

// ---------- events that touch the HUD ----------
function onEvent(e) {
  view.handleEvent(e);
  if (e.type === 'built') {
    const verb = e.pad.kind === 'helper' ? 'HIRED!' : e.pad.kind === 'upgrade' ? 'UPGRADED!' : e.pad.kind === 'area' ? 'OPEN!' : 'BUILT!';
    banner(`${e.pad.label.replace(/^Hire an? /, '').toUpperCase()} ${verb}`);
  }
  if (e.type === 'legend') {
    sfx.legend();
    banner('LEGENDARY CATCH!', 'Giant squid! A Sell the Shack pad just appeared by the tables.', 4.5);
  }
  if (e.type === 'sell') {
    sfx.sold();
    const total = stars + e.stars;
    try { localStorage.setItem('ff-stars', String(total)); } catch { /* storage blocked */ }
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
  $('basket').textContent = `BASKET ${g.player.stack.length}/${g.player.cap}`;
  $('basket').classList.toggle('full', g.player.stack.length >= g.player.cap);
  const next = visiblePads(g).reduce((m, p) => (!m || p.price < m.price ? p : m), null);
  $('next').textContent = g.squidCaught ? 'Sell the Shack when you are ready'
    : next ? `Next: ${next.label} · ${money(next.price)}` : 'Catch the giant squid at the end of the pier';
  if (bannerT > 0 && (bannerT -= dt) <= 0) $('banner').classList.remove('show');

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
function start() {
  unlock();
  $('start').classList.add('gone');
  $('hud').hidden = false;
  $('hint').hidden = false;
  running = true;
  clock.getDelta();
}
$('startBtn').addEventListener('click', start);
$('again').addEventListener('click', () => location.reload());
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
  window.game = { g, give(n) { g.cash += n; }, goto(x, z) { g.player.x = x; g.player.z = z; }, pads: () => visiblePads(g).map(padPos) };
}
