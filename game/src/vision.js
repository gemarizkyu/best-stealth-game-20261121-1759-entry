// Seeing: a guard's vision cone, and whether a stone wall stands between two points.
// Nothing here draws or moves; the world asks it every step, and the renderer asks it too
// when it paints a cone that a wall cuts short.
function segmentHitsRect(x1, y1, x2, y2, rect) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  let low = 0;
  let high = 1;
  for (const [origin, delta, min, max] of [
    [x1, dx, rect.x, rect.x + rect.w],
    [y1, dy, rect.y, rect.y + rect.h],
  ]) {
    if (Math.abs(delta) < 1e-9) {
      if (origin < min || origin > max) return false;
    } else {
      let t1 = (min - origin) / delta;
      let t2 = (max - origin) / delta;
      if (t1 > t2) [t1, t2] = [t2, t1];
      low = Math.max(low, t1);
      high = Math.min(high, t2);
      if (low > high) return false;
    }
  }
  return true;
}

/** True when any wall blocks the straight line from (x1, y1) to (x2, y2). */
export function lineBlocked(x1, y1, x2, y2, walls) {
  for (const wall of walls) {
    if (segmentHitsRect(x1, y1, x2, y2, wall)) return true;
  }
  return false;
}

/** True when the point sits inside any bush circle. */
export function pointInBush(x, y, bushes) {
  for (const bush of bushes) {
    const dx = x - bush.x;
    const dy = y - bush.y;
    if (dx * dx + dy * dy <= bush.r * bush.r) return true;
  }
  return false;
}

/**
 * True when a guard can see the point: inside the vision range and the cone's half-angle,
 * with no wall in between. A guard never sees through stone.
 */
export function guardSees(guard, px, py, walls, range, halfAngle) {
  const dx = px - guard.x;
  const dy = py - guard.y;
  const distance = Math.hypot(dx, dy);
  if (distance > range) return false;
  if (distance < 1e-6) return true;
  const angle = Math.atan2(dy, dx);
  let diff = angle - guard.angle;
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;
  if (Math.abs(diff) > halfAngle) return false;
  return !lineBlocked(guard.x, guard.y, px, py, walls);
}
