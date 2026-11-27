import {
  add, anchorPoint, boundaryToward, dist, len, mul, norm, shapeCenter, sideDirection, sideFacing, sub,
} from './geometry';
import type { Connector, Endpoint, Point, Shape } from './types';
import { shapeBounds } from './geometry';

export type ShapeLookup = Map<string, Shape>;

export interface Route {
  /** Polyline points (for straight/orthogonal) or [start, c1, c2, end] for curved. */
  points: Point[];
  curved: boolean;
  /** Draw a smooth curve through `points` (curved lines with bend points). */
  smooth?: boolean;
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

const routeCache = new WeakMap<Connector, { shapes: ShapeLookup; route: Route }>();

/** Route of a connector. Cached per (connector, shape lookup) pair. */
export function computeRoute(c: Connector, shapes: ShapeLookup): Route {
  const hit = routeCache.get(c);
  if (hit && hit.shapes === shapes) return hit.route;
  const route = computeRouteUncached(c, shapes);
  routeCache.set(c, { shapes, route });
  return route;
}

function computeRouteUncached(c: Connector, shapes: ShapeLookup): Route {
  const routing = c.style.routing;
  const wps = c.waypoints?.length ? c.waypoints : null;
  // With bend points on straight/curved lines, glued ends aim at the nearest bend point.
  const aimAtWaypoints = !!wps && routing !== 'orthogonal';
  const straight = routing === 'straight' || aimAtWaypoints;
  const refTo = aimAtWaypoints ? wps![0] : referencePoint(c.to, shapes);
  const refFrom = aimAtWaypoints ? wps![wps!.length - 1] : referencePoint(c.from, shapes);
  const a = resolve(c.from, refTo, shapes, straight);
  const b = resolve(c.to, refFrom, shapes, straight);
  const s = a.p;
  const e = b.p;

  if (routing === 'orthogonal') {
    const d1 = a.dir ? axisDir(a.dir) : axisDir(sub(wps ? wps[0] : e, s));
    const d2 = b.dir ? axisDir(b.dir) : axisDir(sub(wps ? wps[wps.length - 1] : s, e));
    if (wps) return polyRoute(manualOrthogonal(s, e, wps));
    const avoid = obstacleRoute(s, d1, e, d2, [...shapes.values()]);
    const pts = avoid ?? orthogonalRoute(s, d1, e, d2);
    return polyRoute(pts.length >= 2 ? pts : [s, e]);
  }
  if (wps) {
    const r = polyRoute([s, ...wps, e]);
    return routing === 'curved' ? { ...r, smooth: true } : r;
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

/**
 * Elbow route through frozen corner points. The first and last corners slide
 * so the line stays axis-aligned when the glued shapes move.
 */
export function manualOrthogonal(s: Point, e: Point, wps: Point[]): Point[] {
  const pts = wps.map((p) => ({ ...p }));
  if (pts.length === 1) {
    const w = pts[0];
    return simplify([s, { x: w.x, y: s.y }, { x: w.x, y: e.y }, e]);
  }
  const n = pts.length;
  if (Math.abs(pts[0].x - pts[1].x) < 0.01) pts[0].y = s.y;
  else pts[0].x = s.x;
  if (Math.abs(pts[n - 1].x - pts[n - 2].x) < 0.01) pts[n - 1].y = e.y;
  else pts[n - 1].x = e.x;
  // keep the frozen chain itself orthogonal when the ends slid
  if (n === 2 && Math.abs(pts[0].x - pts[1].x) > 0.01 && Math.abs(pts[0].y - pts[1].y) > 0.01) {
    pts.splice(1, 0, { x: pts[1].x, y: pts[0].y });
  }
  return simplify([s, ...pts, e]);
}

// ---------------------------------------------------------------------------
// Obstacle-avoiding elbow routing (shortest path with few bends on a sparse grid)

const PAD = 12;
const BEND_COST = 40;

interface Box { x0: number; y0: number; x1: number; y1: number }

const inside = (b: Box, x: number, y: number) => x > b.x0 + 0.01 && x < b.x1 - 0.01 && y > b.y0 + 0.01 && y < b.y1 - 0.01;

/** Returns null when no clean route exists (caller falls back to the simple elbow). */
export function obstacleRoute(s: Point, d1: Point, e: Point, d2: Point, shapes: Shape[]): Point[] | null {
  const p1 = add(s, mul(d1, GAP));
  const p2 = add(e, mul(d2, GAP));
  const margin = 80;
  const rx0 = Math.min(p1.x, p2.x) - margin, rx1 = Math.max(p1.x, p2.x) + margin;
  const ry0 = Math.min(p1.y, p2.y) - margin, ry1 = Math.max(p1.y, p2.y) + margin;
  const boxes: Box[] = [];
  for (const sh of shapes) {
    if (sh.type === 'text') continue;
    const b = shapeBounds(sh);
    const box = { x0: b.x - PAD, y0: b.y - PAD, x1: b.x + b.w + PAD, y1: b.y + b.h + PAD };
    if (box.x1 < rx0 || box.x0 > rx1 || box.y1 < ry0 || box.y0 > ry1) continue;
    // a stub point buried in an obstacle (shapes touching) means no clean route
    if (inside(box, p1.x, p1.y) || inside(box, p2.x, p2.y)) return null;
    boxes.push(box);
  }
  if (boxes.length > 60) return null; // keep it fast on huge diagrams
  // Fast path: the simple elbow already avoids everything.
  const simple = orthogonalRoute(s, d1, e, d2);
  if (!routeHits(simple, boxes, s, e)) return simple;
  const xsSet = new Set<number>([p1.x, p2.x]);
  const ysSet = new Set<number>([p1.y, p2.y]);
  for (const b of boxes) {
    xsSet.add(b.x0); xsSet.add(b.x1);
    ysSet.add(b.y0); ysSet.add(b.y1);
  }
  const xs0 = [...xsSet].sort((a, b) => a - b);
  const ys0 = [...ysSet].sort((a, b) => a - b);
  // add channel midlines so routes run centred between shapes
  const withMids = (arr: number[]) => {
    const out: number[] = [];
    for (let i = 0; i < arr.length; i++) {
      out.push(arr[i]);
      if (i < arr.length - 1 && arr[i + 1] - arr[i] > 2) out.push((arr[i] + arr[i + 1]) / 2);
    }
    return out;
  };
  const xs = withMids(xs0);
  const ys = withMids(ys0);
  const W = xs.length, H = ys.length;
  const blocked = (x: number, y: number) => boxes.some((b) => inside(b, x, y));
  const ix1 = xs.indexOf(p1.x), iy1 = ys.indexOf(p1.y);
  const ix2 = xs.indexOf(p2.x), iy2 = ys.indexOf(p2.y);
  const DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  const dirIndex = (d: Point) => DIRS.findIndex((q) => q.x === d.x && q.y === d.y);
  const N = W * H * 4;
  const cost = new Float64Array(N).fill(Infinity);
  const prev = new Int32Array(N).fill(-1);
  const key = (i: number, j: number, d: number) => (j * W + i) * 4 + d;
  const heap: [number, number][] = [];
  const push = (c: number, k: number) => {
    heap.push([c, k]);
    let i = heap.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heap[p][0] <= heap[i][0]) break;
      [heap[p], heap[i]] = [heap[i], heap[p]];
      i = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  const startD = dirIndex(d1);
  const endD = dirIndex(mul(d2, -1));
  const k0 = key(ix1, iy1, startD);
  cost[k0] = 0;
  push(0, k0);
  let goal = -1;
  while (heap.length) {
    const [c, k] = pop();
    if (c > cost[k]) continue;
    const d = k % 4;
    const cell = (k - d) / 4;
    const i = cell % W, j = (cell - i) / W;
    if (i === ix2 && j === iy2) {
      const extra = d === endD ? 0 : BEND_COST;
      const total = c + extra;
      if (goal < 0 || total < cost[goal] + (goal % 4 === endD ? 0 : BEND_COST)) goal = k;
      continue;
    }
    for (let nd = 0; nd < 4; nd++) {
      const dir = DIRS[nd];
      if (dir.x === -DIRS[d].x && dir.y === -DIRS[d].y) continue; // no U-turns
      const ni = i + dir.x, nj = j + dir.y;
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue;
      const mx = (xs[i] + xs[ni]) / 2, my = (ys[j] + ys[nj]) / 2;
      if (blocked(mx, my) || blocked(xs[ni], ys[nj])) continue;
      const step = Math.abs(xs[ni] - xs[i]) + Math.abs(ys[nj] - ys[j]);
      const nc = c + step + (nd === d ? 0 : BEND_COST);
      const nk = key(ni, nj, nd);
      if (nc < cost[nk]) {
        cost[nk] = nc;
        prev[nk] = k;
        push(nc, nk);
      }
    }
  }
  if (goal < 0) return null;
  const path: Point[] = [];
  for (let k = goal; k >= 0; k = prev[k]) {
    const cell = (k - (k % 4)) / 4;
    const i = cell % W, j = (cell - i) / W;
    path.push({ x: xs[i], y: ys[j] });
  }
  path.reverse();
  return simplify([s, ...path, e]);
}

function touches(b: Box, p: Point) {
  return p.x >= b.x0 - 0.01 && p.x <= b.x1 + 0.01 && p.y >= b.y0 - 0.01 && p.y <= b.y1 + 0.01;
}

/** Does the route cut through a shape? The end segments may touch their own shapes. */
function routeHits(pts: Point[], boxes: Box[], s: Point, e: Point): boolean {
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    const x0 = Math.min(a.x, b.x), x1 = Math.max(a.x, b.x), y0 = Math.min(a.y, b.y), y1 = Math.max(a.y, b.y);
    for (const box of boxes) {
      if (i === 1 && touches(box, s)) continue;
      if (i === pts.length - 1 && touches(box, e)) continue;
      if (x1 <= box.x0 || x0 >= box.x1 || y1 <= box.y0 || y0 >= box.y1) continue;
      return true;
    }
  }
  return false;
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
  if (r.smooth && pts.length > 2) {
    // Catmull-Rom spline through the points, as cubic Béziers
    let d = `M${f(pts[0])}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
      const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
      const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
      d += ` C${f(c1)} ${f(c2)} ${f(p2)}`;
    }
    return d;
  }
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
