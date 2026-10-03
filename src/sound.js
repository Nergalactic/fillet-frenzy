// Tiny synthesized sound effects with Web Audio. No files to load.
// Browsers only allow audio after a tap or key press, so unlock() is called on the first input.
let ctx = null, master = null, muted = false;
const last = {};

try { muted = localStorage.getItem('ff-muted') === '1'; } catch { /* storage blocked */ }

export function unlock() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.5;
  master.connect(ctx.destination);
}

export function isMuted() { return muted; }
export function toggleMute() {
  muted = !muted;
  try { localStorage.setItem('ff-muted', muted ? '1' : '0'); } catch { /* storage blocked */ }
  if (master) master.gain.value = muted ? 0 : 0.5;
  return muted;
}

// Skip a sound if the same one played within `gap` seconds, so busy moments don't turn into noise.
function ok(name, gap) {
  if (!ctx || muted) return false;
  const now = ctx.currentTime;
  if (last[name] && now - last[name] < gap) return false;
  last[name] = now;
  return true;
}

function tone({ freq = 440, to = null, type = 'sine', dur = 0.15, vol = 0.3, delay = 0, attack = 0.005 }) {
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(), gn = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(vol, t + attack);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

let noiseBuf = null;
function noise({ dur = 0.2, vol = 0.2, filter = 'bandpass', freq = 1200, q = 1, delay = 0, to = null }) {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), gn = ctx.createGain();
  src.buffer = noiseBuf;
  f.type = filter; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur);
  gn.gain.setValueAtTime(vol, t);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(gn).connect(master);
  src.start(t, Math.random() * 0.5);
  src.stop(t + dur + 0.02);
}

export const sfx = {
  catch() {
    if (!ok('catch', 0.08)) return;
    noise({ dur: 0.18, vol: 0.18, filter: 'lowpass', freq: 1800, to: 300 });
    tone({ freq: 500, to: 900, type: 'triangle', dur: 0.1, vol: 0.18, delay: 0.08 });
  },
  pickup() {
    if (!ok('pickup', 0.05)) return;
    tone({ freq: 620 + Math.random() * 120, to: 880, type: 'triangle', dur: 0.07, vol: 0.12 });
  },
  drop() {
    if (!ok('drop', 0.05)) return;
    tone({ freq: 520 + Math.random() * 80, to: 340, type: 'triangle', dur: 0.08, vol: 0.12 });
  },
  chop() {
    if (!ok('chop', 0.12)) return;
    noise({ dur: 0.05, vol: 0.25, filter: 'highpass', freq: 2500 });
    tone({ freq: 180, to: 90, type: 'square', dur: 0.05, vol: 0.08 });
  },
  sizzle() {
    if (!ok('sizzle', 0.6)) return;
    noise({ dur: 0.6, vol: 0.06, filter: 'highpass', freq: 5000 });
  },
  sale() {
    if (!ok('sale', 0.12)) return;
    tone({ freq: 1320, type: 'square', dur: 0.08, vol: 0.08 });
    tone({ freq: 1760, type: 'square', dur: 0.18, vol: 0.08, delay: 0.07 });
  },
  coin() {
    if (!ok('coin', 0.06)) return;
    tone({ freq: 1500 + Math.random() * 500, type: 'triangle', dur: 0.06, vol: 0.07 });
  },
  plate() {
    if (!ok('plate', 0.08)) return;
    tone({ freq: 2400, type: 'sine', dur: 0.12, vol: 0.06 });
    tone({ freq: 3100, type: 'sine', dur: 0.1, vol: 0.04, delay: 0.02 });
  },
  build() {
    if (!ok('build', 0.3)) return;
    noise({ dur: 0.35, vol: 0.2, filter: 'lowpass', freq: 900, to: 200 });
    [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.22, vol: 0.14, delay: 0.05 + i * 0.08 }));
  },
  legend() {
    if (!ok('legend', 1)) return;
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, type: 'square', dur: 0.3, vol: 0.08, delay: i * 0.1 }));
    noise({ dur: 0.8, vol: 0.15, filter: 'lowpass', freq: 2000, to: 200, delay: 0.1 });
  },
  sold() {
    if (!ok('sold', 1)) return;
    [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.25, vol: 0.14, delay: i * 0.12 }));
  },
  horn() {
    if (!ok('horn', 1)) return;
    tone({ freq: 196, type: 'sawtooth', dur: 0.5, vol: 0.09, attack: 0.04 });
    tone({ freq: 247, type: 'sawtooth', dur: 0.5, vol: 0.06, attack: 0.04 });
    tone({ freq: 196, type: 'sawtooth', dur: 0.7, vol: 0.09, attack: 0.04, delay: 0.6 });
    tone({ freq: 247, type: 'sawtooth', dur: 0.7, vol: 0.06, attack: 0.04, delay: 0.6 });
  },
  arrive() {
    if (!ok('arrive', 0.5)) return;
    tone({ freq: 880, type: 'sine', dur: 0.08, vol: 0.05 });
    tone({ freq: 660, type: 'sine', dur: 0.12, vol: 0.05, delay: 0.08 });
  },
};
