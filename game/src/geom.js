// Small geometry helpers shared by guards, cameras, lasers and the pilot:
// rectangles, segment tests, cones and line of sight. Nothing here draws.

// A rect is { x, y, w, h } — top-left corner plus size.
export function pointInRect(px, py, r) {
  return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h;
}

export function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function segIntersectsSeg(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (d === 0) return false;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

export function segHitsRect(x1, y1, x2, y2, r) {
  if (pointInRect(x1, y1, r) || pointInRect(x2, y2, r)) return true;
  const { x, y, w, h } = r;
  return (
    segIntersectsSeg(x1, y1, x2, y2, x, y, x + w, y) ||
    segIntersectsSeg(x1, y1, x2, y2, x + w, y, x + w, y + h) ||
    segIntersectsSeg(x1, y1, x2, y2, x + w, y + h, x, y + h) ||
    segIntersectsSeg(x1, y1, x2, y2, x, y + h, x, y)
  );
}

/** True when no wall stands between (x1,y1) and (x2,y2). */
export function losClear(x1, y1, x2, y2, walls) {
  for (let i = 0; i < walls.length; i += 1) {
    if (segHitsRect(x1, y1, x2, y2, walls[i])) return false;
  }
  return true;
}

/** Smallest absolute difference between two angles, in radians. */
export function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/**
 * Is (px,py) inside a vision cone from (sx,sy) facing `angle`, with the
 * given range and half-angle, and with a clear line of sight past walls?
 */
export function inCone(sx, sy, angle, range, halfAngle, px, py, walls) {
  const dx = px - sx;
  const dy = py - sy;
  const dist = Math.hypot(dx, dy);
  if (dist > range) return false;
  if (dist > 4 && angleDiff(Math.atan2(dy, dx), angle) > halfAngle) return false;
  return losClear(sx, sy, px, py, walls);
}

/** Distance between two points. */
export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

/** Clamp a value into [min, max]. */
export function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

/**
 * Move a circle (centre px,py, radius r) by (dx,dy) without entering any
 * wall rect or leaving the room: each axis is resolved separately so the
 * circle slides along walls instead of sticking to them.
 */
export function moveCircle(px, py, dx, dy, r, walls, room) {
  let nx = px + dx;
  let ny = py;
  const boxX = { x: nx - r, y: ny - r, w: r * 2, h: r * 2 };
  let blocked = false;
  for (let i = 0; i < walls.length; i += 1) {
    if (rectsOverlap(boxX, walls[i])) { blocked = true; break; }
  }
  if (blocked || nx - r < room.x || nx + r > room.x + room.width) nx = px;
  ny = py + dy;
  const boxY = { x: nx - r, y: ny - r, w: r * 2, h: r * 2 };
  blocked = false;
  for (let i = 0; i < walls.length; i += 1) {
    if (rectsOverlap(boxY, walls[i])) { blocked = true; break; }
  }
  if (blocked || ny - r < room.y || ny + r > room.y + room.height) ny = py;
  return { x: nx, y: ny };
}
