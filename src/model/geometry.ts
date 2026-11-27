import { SHAPES } from './shapes';
import type { Point, Rect, Shape, Side } from './types';

export const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
export const len = (a: Point): number => Math.hypot(a.x, a.y);
export const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a: Point): Point => {
  const l = len(a);
  return l < 1e-9 ? { x: 0, y: 0 } : { x: a.x / l, y: a.y / l };
};

export function rotatePoint(p: Point, c: Point, deg: number): Point {
  if (!deg) return p;
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const dx = p.x - c.x;
  const dy = p.y - c.y;
  return { x: c.x + dx * cos - dy * sin, y: c.y + dx * sin + dy * cos };
}

export const rotateVec = (v: Point, deg: number): Point => rotatePoint(v, { x: 0, y: 0 }, deg);

export const shapeCenter = (s: Shape): Point => ({ x: s.x + s.w / 2, y: s.y + s.h / 2 });

export function localToWorld(s: Shape, p: Point): Point {
  return rotatePoint({ x: s.x + p.x, y: s.y + p.y }, shapeCenter(s), s.rotation);
}

export function worldToLocal(s: Shape, p: Point): Point {
  const q = rotatePoint(p, shapeCenter(s), -s.rotation);
  return { x: q.x - s.x, y: q.y - s.y };
}

export function boundsOfPoints(pts: Point[]): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Axis-aligned bounds of a (possibly rotated) shape. */
export function shapeBounds(s: Shape): Rect {
  if (!s.rotation) return { x: s.x, y: s.y, w: s.w, h: s.h };
  return boundsOfPoints(
    [{ x: 0, y: 0 }, { x: s.w, y: 0 }, { x: s.w, y: s.h }, { x: 0, y: s.h }].map((p) => localToWorld(s, p)),
  );
}

export function unionRects(rects: Rect[]): Rect | null {
  if (!rects.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

export function rectContains(outer: Rect, inner: Rect): boolean {
  return inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h;
}

export function normRect(a: Point, b: Point): Rect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) };
}

export const snapTo = (v: number, grid: number): number => Math.round(v / grid) * grid;

export const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

export const SIDE_VEC: Record<Side, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

/** Furthest intersection of a ray from `o` along `d` with polygon `poly`. */
export function rayPolygon(o: Point, d: Point, poly: Point[]): Point | null {
  let best = -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const e = sub(b, a);
    const den = d.x * e.y - d.y * e.x;
    if (Math.abs(den) < 1e-12) continue;
    const ao = sub(a, o);
    const t = (ao.x * e.y - ao.y * e.x) / den;
    const u = (ao.x * d.y - ao.y * d.x) / den;
    if (t >= 0 && u >= -1e-9 && u <= 1 + 1e-9 && t > best) best = t;
  }
  return best < 0 ? null : add(o, mul(d, best));
}

/** Point on the shape outline in the direction of a local-space vector from its center. */
function outlineToward(s: Shape, dirLocal: Point): Point {
  const c = { x: s.w / 2, y: s.h / 2 };
  const d = norm(dirLocal);
  if (!d.x && !d.y) return c;
  return rayPolygon(c, d, SHAPES[s.type].outline(s.w, s.h)) ?? c;
}

/** World position of a named connection point. */
export function anchorPoint(s: Shape, side: Side): Point {
  const v = SIDE_VEC[side];
  // scale by size so that the ray hits the middle of the matching bbox side
  return localToWorld(s, outlineToward(s, { x: v.x * s.w, y: v.y * s.h }));
}

export function sideDirection(s: Shape, side: Side): Point {
  return rotateVec(SIDE_VEC[side], s.rotation);
}

/** Side of the shape that best faces a world point. */
export function sideFacing(s: Shape, target: Point): Side {
  const l = worldToLocal(s, target);
  const dx = (l.x - s.w / 2) / Math.max(s.w, 1);
  const dy = (l.y - s.h / 2) / Math.max(s.h, 1);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
}

/** Where a straight line from the shape center to `target` leaves the shape. */
export function boundaryToward(s: Shape, target: Point): Point {
  const l = worldToLocal(s, target);
  return localToWorld(s, outlineToward(s, { x: l.x - s.w / 2, y: l.y - s.h / 2 }));
}

export function pointInPolygon(p: Point, poly: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
