export const TILE_SIZE = 32;

export const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export const rectsOverlap = (a, b) =>
  a.x < b.x + b.w &&
  a.x + a.w > b.x &&
  a.y < b.y + b.h &&
  a.y + a.h > b.y;

export const length = (x, y) => Math.hypot(x, y);

export function normalize(x, y) {
  const l = length(x, y);
  if (l === 0) return { x: 0, y: 0 };
  return { x: x / l, y: y / l };
}

export const distance = (a, b) => length(a.x - b.x, a.y - b.y);

export const angleFromVector = (x, y) => Math.atan2(y, x);

export const wrapAngle = (angle) => {
  let a = angle;
  while (a <= -Math.PI) a += Math.PI * 2;
  while (a > Math.PI) a -= Math.PI * 2;
  return a;
};

export const isInCone = (origin, target, facing, coneAngle, range) => {
  const dx = target.x - origin.x;
  const dy = target.y - origin.y;
  const d = Math.hypot(dx, dy);
  if (d > range) return false;
  const a = Math.atan2(dy, dx);
  return Math.abs(wrapAngle(a - facing)) <= coneAngle * 0.5;
};
