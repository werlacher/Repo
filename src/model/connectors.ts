import {
  add, anchorPoint, boundaryToward, dist, len, mul, norm, shapeCenter, sideDirection, sideFacing, sub,
} from './geometry';
import type { Connector, Endpoint, Point, Shape } from './types';

export type ShapeLookup = Map<string, Shape>;

export interface Route {
  /** Polyline points (for straight/orthogonal) or [start, c1, c2, end] for curved. */
  points: Point[];
  curved: boolean;
  start: Point;
  end: Point;
  /** Unit vector pointing out of the line at its start (for arrowheads). */
  startDir: Point;
  /** Unit vector pointing out of the line at its end. */
  endDir: Point;
  mid: Point;
}

interface Resolved {
  p: Point;
  /** outward normal of the glued side, null for free ends / floating glue */
  dir: Point | null;
}

const GAP = 20;

function glued(ep: Endpoint, shapes: ShapeLookup): Shape | undefined {
  return ep.shapeId ? shapes.get(ep.shapeId) : undefined;
}

/** A point that represents where an end "is", used to aim the opposite end. */
export function referencePoint(ep: Endpoint, shapes: ShapeLookup): Point {
  const s = glued(ep, shapes);
  if (!s) return { x: ep.x, y: ep.y };
  if (ep.anchor && ep.anchor !== 'auto') return anchorPoint(s, ep.anchor);
  return shapeCenter(s);
}

function resolve(ep: Endpoint, toward: Point, shapes: ShapeLookup, straight: boolean): Resolved {
  const s = glued(ep, shapes);
  if (!s) return { p: { x: ep.x, y: ep.y }, dir: null };
  let side = ep.anchor;
  if (!side || side === 'auto') {
    if (straight) return { p: boundaryToward(s, toward), dir: null };
    side = sideFacing(s, toward);
  }
  return { p: anchorPoint(s, side), dir: sideDirection(s, side) };
}

/** Resolved world position of an endpoint (what the user sees). */
export function endpointPosition(c: Connector, end: 'from' | 'to', shapes: ShapeLookup): Point {
  const r = computeRoute(c, shapes);
  return end === 'from' ? r.start : r.end;
}

function axisDir(v: Point): Point {
  if (Math.abs(v.x) >= Math.abs(v.y)) return { x: v.x >= 0 ? 1 : -1, y: 0 };
  return { x: 0, y: v.y >= 0 ? 1 : -1 };
}

const T = (p: Point): Point => ({ x: p.y, y: p.x });

/** Elbow route between two points leaving/entering along axis-aligned directions. */
export function orthogonalRoute(s: Point, d1: Point, e: Point, d2: Point): Point[] {
  const h1 = d1.x !== 0;
  const h2 = d2.x !== 0;
  if (!h1) return orthogonalRoute(T(s), T(d1), T(e), T(d2)).map(T);
  const p1 = add(s, mul(d1, GAP));
  const p2 = add(e, mul(d2, GAP));
  let pts: Point[];
  if (h2) {
    if (d1.x === -d2.x) {
      if ((p2.x - p1.x) * d1.x >= 0) {
        const mx = (s.x + e.x) / 2;
        pts = [s, { x: mx, y: s.y }, { x: mx, y: e.y }, e];
      } else {
        const my = (s.y + e.y) / 2;
        pts = [s, p1, { x: p1.x, y: my }, { x: p2.x, y: my }, p2, e];
      }
    } else {
      const x = d1.x > 0 ? Math.max(p1.x, p2.x) : Math.min(p1.x, p2.x);
      pts = [s, { x, y: s.y }, { x, y: e.y }, e];
    }
  } else {
    const c = { x: e.x, y: s.y };
    const ok1 = (c.x - s.x) * d1.x > 0;
    const ok2 = (c.y - e.y) * d2.y > 0;
    if (ok1 && ok2) pts = [s, c, e];
    else pts = [s, p1, { x: p1.x, y: p2.y }, p2, e];
  }
  return simplify(pts);
}

export function simplify(pts: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of pts) {
    if (out.length && dist(out[out.length - 1], p) < 0.01) continue;
    out.push(p);
  }
  for (let i = out.length - 2; i >= 1; i--) {
    const a = out[i - 1], b = out[i], c = out[i + 1];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (Math.abs(cross) < 0.01) out.splice(i, 1);
  }
  return out;
}

export function computeRoute(c: Connector, shapes: ShapeLookup): Route {
  const routing = c.style.routing;
  const straight = routing === 'straight';
  const refTo = referencePoint(c.to, shapes);
  const refFrom = referencePoint(c.from, shapes);
  const a = resolve(c.from, refTo, shapes, straight);
  const b = resolve(c.to, refFrom, shapes, straight);
  const s = a.p;
  const e = b.p;

  if (routing === 'orthogonal') {
    const d1 = a.dir ? axisDir(a.dir) : axisDir(sub(e, s));
    const d2 = b.dir ? axisDir(b.dir) : axisDir(sub(s, e));
    const pts = orthogonalRoute(s, d1, e, d2);
    return polyRoute(pts.length >= 2 ? pts : [s, e]);
  }
  if (routing === 'curved') {
    const k = Math.max(30, dist(s, e) * 0.4);
    const d1 = a.dir ?? norm(sub(e, s));
    const d2 = b.dir ?? norm(sub(s, e));
    const c1 = add(s, mul(d1, k));
    const c2 = add(e, mul(d2, k));
    return {
      points: [s, c1, c2, e],
      curved: true,
      start: s,
      end: e,
      startDir: dirOr(sub(s, c1), sub(s, e)),
      endDir: dirOr(sub(e, c2), sub(e, s)),
      mid: bezierAt(s, c1, c2, e, 0.5),
    };
  }
  return polyRoute([s, e]);
}

function dirOr(v: Point, fallback: Point): Point {
  const n = norm(v);
  if (n.x || n.y) return n;
  const f = norm(fallback);
  return f.x || f.y ? f : { x: 1, y: 0 };
}

function polyRoute(pts: Point[]): Route {
  const n = pts.length;
  return {
    points: pts,
    curved: false,
    start: pts[0],
    end: pts[n - 1],
    startDir: dirOr(sub(pts[0], pts[1]), { x: -1, y: 0 }),
    endDir: dirOr(sub(pts[n - 1], pts[n - 2]), { x: 1, y: 0 }),
    mid: polylineMid(pts),
  };
}

export function bezierAt(p0: Point, p1: Point, p2: Point, p3: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  };
}

function polylineMid(pts: Point[]): Point {
  let total = 0;
  for (let i = 1; i < pts.length; i++) total += dist(pts[i - 1], pts[i]);
  let half = total / 2;
  for (let i = 1; i < pts.length; i++) {
    const l = dist(pts[i - 1], pts[i]);
    if (half <= l && l > 0) return add(pts[i - 1], mul(sub(pts[i], pts[i - 1]), half / l));
    half -= l;
  }
  return pts[0];
}

/** SVG path for a route, with optional trimming at either end (for arrowheads). */
export function routePath(r: Route, trimStart = 0, trimEnd = 0): string {
  const pts = r.points.slice();
  const n = pts.length;
  if (trimStart) pts[0] = add(pts[0], mul(r.startDir, -Math.min(trimStart, segLen(pts[0], pts[1]) * 0.9)));
  if (trimEnd) pts[n - 1] = add(pts[n - 1], mul(r.endDir, -Math.min(trimEnd, segLen(pts[n - 1], pts[n - 2]) * 0.9)));
  const f = (p: Point) => `${round(p.x)} ${round(p.y)}`;
  if (r.curved) return `M${f(pts[0])} C${f(pts[1])} ${f(pts[2])} ${f(pts[3])}`;
  return pts.map((p, i) => `${i ? 'L' : 'M'}${f(p)}`).join(' ');
}

function segLen(a: Point, b: Point) {
  return len(sub(a, b)) || 1e6;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** All points needed to bound a connector. */
export function routeBoundsPoints(r: Route): Point[] {
  if (!r.curved) return r.points;
  const out: Point[] = [];
  for (let i = 0; i <= 16; i++) out.push(bezierAt(r.points[0], r.points[1], r.points[2], r.points[3], i / 16));
  return out;
}
