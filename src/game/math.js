export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const approach = (a, b, amount) => a < b ? Math.min(a + amount, b) : Math.max(a - amount, b);
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const random = (min, max) => min + Math.random() * (max - min);
export function seeded(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
export function xpForLevel(level) { return 50 + level * 30; }
export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  return m >= 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m} мин`;
}
export function moveAndCollide(body, platforms, dt, walls = []) {
  const previousBottom = body.y + body.h;
  body.x += body.vx * dt;
  for (const wall of walls) {
    if (!overlaps(body, wall)) continue;
    if (body.vx > 0) body.x = wall.x - body.w;
    else if (body.vx < 0) body.x = wall.x + wall.w;
    body.wallSide = body.vx > 0 ? 1 : body.vx < 0 ? -1 : body.wallSide;
    body.vx = 0;
  }
  body.y += body.vy * dt;
  body.grounded = false;
  if (body.vy >= 0) {
    let top = Infinity;
    let landedOn = null;
    for (const p of platforms) {
      if (body.x + body.w <= p.x + 2 || body.x >= p.x + p.w - 2) continue;
      if (previousBottom <= p.y + 9 && body.y + body.h >= p.y && p.y < top) {
        top = p.y; landedOn = p;
      }
    }
    if (landedOn) { body.y = top - body.h; body.vy = 0; body.grounded = true; body.platform = landedOn; }
  }
  return body.grounded;
}
