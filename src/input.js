// Keyboard (WASD / arrows) and a floating touch/mouse joystick.
export function createInput(stickEl, knobEl) {
  const keys = new Set();
  const stick = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
  const R = 60;

  addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  addEventListener('blur', () => keys.clear());

  const canvasArea = document.body;
  // Double-tap: two presses close together in time and space. Anyone can subscribe via read.onDoubleTap.
  let lastTap = { t: -1e9, x: 0, y: 0 };
  canvasArea.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    const now = performance.now();
    if (now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 60) {
      lastTap.t = -1e9;
      read.onDoubleTap?.();
    } else {
      lastTap = { t: now, x: e.clientX, y: e.clientY };
    }
    stick.active = true; stick.id = e.pointerId;
    stick.ox = e.clientX; stick.oy = e.clientY; stick.x = 0; stick.y = 0;
    stickEl.style.left = e.clientX + 'px';
    stickEl.style.top = e.clientY + 'px';
    stickEl.classList.add('on');
    knobEl.style.transform = 'translate(-50%, -50%)';
  });
  canvasArea.addEventListener('pointermove', (e) => {
    if (!stick.active || e.pointerId !== stick.id) return;
    let dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    stick.x = dx / R; stick.y = dy / R;
    knobEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
  });
  const end = (e) => {
    if (e.pointerId !== stick.id) return;
    stick.active = false; stick.x = stick.y = 0;
    stickEl.classList.remove('on');
  };
  canvasArea.addEventListener('pointerup', end);
  canvasArea.addEventListener('pointercancel', end);

  // Returns screen-space direction: x right, y down. Magnitude 0..1.
  function read() {
    let x = 0, y = 0;
    if (keys.has('a') || keys.has('arrowleft')) x -= 1;
    if (keys.has('d') || keys.has('arrowright')) x += 1;
    if (keys.has('w') || keys.has('arrowup')) y -= 1;
    if (keys.has('s') || keys.has('arrowdown')) y += 1;
    const k = Math.hypot(x, y);
    if (k > 0) return { x: x / k, y: y / k };
    return { x: stick.x, y: stick.y };
  };
  return read;
}
