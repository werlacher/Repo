import { describe, expect, it, beforeEach } from 'vitest';
import { anchorPoint, boundaryToward, rayPolygon, rotatePoint, shapeBounds } from '../src/model/geometry';
import { computeRoute, manualOrthogonal, orthogonalRoute, simplify } from '../src/model/connectors';
import { SHAPES } from '../src/model/shapes';
import { resizeShape } from '../src/components/Canvas';
import { wrapText } from '../src/lib/textLayout';
import { parseDoc, serialize } from '../src/lib/io';
import * as store from '../src/store';
import type { Shape, ShapeType } from '../src/model/types';

const shape = (over: Partial<Shape> = {}): Shape => ({ ...store.makeShape('rectangle', { x: 50, y: 25 }, { w: 100, h: 50 }), ...over });

describe('geometry', () => {
  it('rotates points around a center', () => {
    const p = rotatePoint({ x: 1, y: 0 }, { x: 0, y: 0 }, 90);
    expect(p.x).toBeCloseTo(0);
    expect(p.y).toBeCloseTo(1);
  });

  it('computes bounds of a rotated shape', () => {
    const b = shapeBounds(shape({ rotation: 90 }));
    expect(b.w).toBeCloseTo(50);
    expect(b.h).toBeCloseTo(100);
  });

  it('places side anchors on the outline of every shape type', () => {
    for (const type of Object.keys(SHAPES) as ShapeType[]) {
      const s = { ...store.makeShape(type, { x: 0, y: 0 }, { w: 100, h: 80 }) };
      const top = anchorPoint(s, 'top');
      const right = anchorPoint(s, 'right');
      expect(Number.isFinite(top.y), type).toBe(true);
      expect(right.x).toBeGreaterThan(0);
      expect(right.x).toBeLessThanOrEqual(50.01);
    }
  });

  it('finds the ray exit point of a polygon', () => {
    const sq = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(rayPolygon({ x: 5, y: 5 }, { x: 1, y: 0 }, sq)).toEqual({ x: 10, y: 5 });
  });

  it('floats a glued end to the boundary toward a target', () => {
    const p = boundaryToward(shape(), { x: 500, y: 25 });
    expect(p.x).toBeCloseTo(100);
    expect(p.y).toBeCloseTo(25);
  });
});

describe('connector routing', () => {
  it('routes an elbow between facing sides', () => {
    const pts = orthogonalRoute({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 100, y: 50 }, { x: -1, y: 0 });
    expect(pts).toEqual([{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 50, y: 50 }, { x: 100, y: 50 }]);
  });

  it('routes an L between a horizontal and a vertical side', () => {
    const pts = orthogonalRoute({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 100, y: 100 }, { x: 0, y: -1 });
    expect(pts).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]);
  });

  it('keeps every elbow segment axis-aligned', () => {
    const dirs = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    for (const d1 of dirs) for (const d2 of dirs) for (const e of [{ x: 120, y: 60 }, { x: -80, y: 30 }, { x: 10, y: -90 }]) {
      const pts = orthogonalRoute({ x: 0, y: 0 }, d1, e, d2);
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        expect(Math.abs(a.x - b.x) < 1e-9 || Math.abs(a.y - b.y) < 1e-9).toBe(true);
      }
    }
  });

  it('removes duplicate and collinear points', () => {
    expect(simplify([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 0 }, { x: 10, y: 0 }])).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
  });

  it('follows glued shapes', () => {
    const a = shape({ id: 'a', x: 0, y: 0 });
    const b = shape({ id: 'b', x: 300, y: 0 });
    const c = store.makeConnector({ shapeId: 'a', anchor: 'auto', x: 0, y: 0 }, { shapeId: 'b', anchor: 'auto', x: 0, y: 0 });
    const r = computeRoute(c, new Map([['a', a], ['b', b]]));
    expect(r.start).toEqual({ x: 100, y: 25 });
    expect(r.end).toEqual({ x: 300, y: 25 });
  });
});

describe('bend points and obstacle avoidance', () => {
  const axisAligned = (pts: { x: number; y: number }[]) =>
    pts.every((p, i) => i === 0 || Math.abs(p.x - pts[i - 1].x) < 1e-6 || Math.abs(p.y - pts[i - 1].y) < 1e-6);

  it('routes an elbow line around a shape in the way', () => {
    const a = shape({ id: 'a', x: 0, y: 0 });
    const b = shape({ id: 'b', x: 400, y: 0 });
    const block = shape({ id: 'x', x: 200, y: -40, w: 80, h: 130 });
    const shapes = new Map([['a', a], ['b', b], ['x', block]]);
    const c = store.makeConnector({ shapeId: 'a', anchor: 'right', x: 0, y: 0 }, { shapeId: 'b', anchor: 'left', x: 0, y: 0 });
    const r = computeRoute(c, shapes);
    expect(axisAligned(r.points)).toBe(true);
    // no segment may cross the blocking shape's box
    for (let i = 1; i < r.points.length; i++) {
      const p = r.points[i - 1], q = r.points[i];
      const crosses = Math.max(p.x, q.x) > 200 && Math.min(p.x, q.x) < 280 && Math.max(p.y, q.y) > -40 && Math.min(p.y, q.y) < 90;
      expect(crosses).toBe(false);
    }
    // without the obstacle it is a straight line
    const r2 = computeRoute(c, new Map([['a', a], ['b', b]]));
    expect(r2.points).toHaveLength(2);
  });

  it('keeps a manual elbow route axis-aligned when the ends move', () => {
    const wps = [{ x: 150, y: 25 }, { x: 150, y: 200 }, { x: 300, y: 200 }];
    const pts = manualOrthogonal({ x: 100, y: 60 }, { x: 320, y: 260 }, wps);
    expect(axisAligned(pts)).toBe(true);
    expect(pts[0]).toEqual({ x: 100, y: 60 });
    expect(pts[pts.length - 1]).toEqual({ x: 320, y: 260 });
  });

  it('passes straight lines through their bend points', () => {
    const c = { ...store.makeConnector({ x: 0, y: 0 }, { x: 100, y: 0 }, { routing: 'straight' }), waypoints: [{ x: 50, y: 80 }] };
    expect(computeRoute(c, new Map()).points).toEqual([{ x: 0, y: 0 }, { x: 50, y: 80 }, { x: 100, y: 0 }]);
  });

  it('drops bend points when the routing style changes, and on reset', () => {
    store.resetStore();
    const c = { ...store.makeConnector({ x: 0, y: 0 }, { x: 100, y: 0 }, { routing: 'straight' }), waypoints: [{ x: 50, y: 80 }] };
    store.addElements([c]);
    store.resetRoute([c.id]);
    expect((store.currentPage().elements[0] as typeof c).waypoints).toBeUndefined();
    store.undo();
    store.updateConnectorStyle([c.id], { routing: 'curved' });
    expect((store.currentPage().elements[0] as typeof c).waypoints).toBeUndefined();
  });
});

describe('resize', () => {
  it('keeps the opposite corner fixed', () => {
    const s = shape({ x: 0, y: 0 });
    const next = resizeShape(s, 1, 1, { x: 200, y: 120 }, false, 0);
    expect(next).toMatchObject({ x: 0, y: 0, w: 200, h: 120 });
    const left = resizeShape(s, 0, 0.5, { x: -50, y: 999 }, false, 0);
    expect(left).toMatchObject({ x: -50, y: 0, w: 150, h: 50 });
  });
});

describe('text wrapping', () => {
  it('wraps long text and keeps explicit newlines', () => {
    const lines = wrapText('one two three four five\nsix', 60, '14px Arial');
    expect(lines.length).toBeGreaterThan(2);
    expect(lines[lines.length - 1]).toBe('six');
  });
});

describe('store', () => {
  beforeEach(() => store.resetStore());

  it('adds, undoes and redoes', () => {
    store.addShapeAt('rectangle', { x: 0, y: 0 });
    expect(store.currentPage().elements).toHaveLength(1);
    store.undo();
    expect(store.currentPage().elements).toHaveLength(0);
    store.redo();
    expect(store.currentPage().elements).toHaveLength(1);
  });

  it('copies and pastes connectors re-glued to the pasted shapes', () => {
    const a = store.makeShape('rectangle', { x: 0, y: 0 });
    const b = store.makeShape('rectangle', { x: 300, y: 0 });
    const c = store.makeConnector({ shapeId: a.id, anchor: 'auto', x: 0, y: 0 }, { shapeId: b.id, anchor: 'auto', x: 0, y: 0 });
    store.addElements([a, b, c]);
    store.selectAll();
    store.copySelection();
    store.paste();
    const els = store.currentPage().elements;
    expect(els).toHaveLength(6);
    const pasted = els[5];
    expect(pasted.kind).toBe('connector');
    if (pasted.kind === 'connector') {
      expect(pasted.from.shapeId).toBe(els[3].id);
      expect(pasted.to.shapeId).toBe(els[4].id);
    }
  });

  it('keeps lines as free lines when their shape is deleted', () => {
    const a = store.makeShape('rectangle', { x: 0, y: 0 });
    const b = store.makeShape('rectangle', { x: 300, y: 0 });
    const c = store.makeConnector({ shapeId: a.id, anchor: 'right', x: 0, y: 0 }, { shapeId: b.id, anchor: 'left', x: 0, y: 0 });
    store.addElements([a, b, c]);
    store.setState({ selection: [b.id] });
    store.deleteSelection();
    const line = store.currentPage().elements.find((e) => e.kind === 'connector');
    expect(line && line.kind === 'connector' && line.to.shapeId).toBeFalsy();
  });

  it('aligns and distributes', () => {
    const s1 = store.makeShape('rectangle', { x: 0, y: 0 }, { w: 20, h: 20 });
    const s2 = store.makeShape('rectangle', { x: 100, y: 37 }, { w: 20, h: 20 });
    const s3 = store.makeShape('rectangle', { x: 500, y: 10 }, { w: 20, h: 20 });
    store.addElements([s1, s2, s3]);
    store.alignSelection('top');
    const ys = store.currentPage().elements.map((e) => (e.kind === 'shape' ? e.y : 0));
    expect(new Set(ys).size).toBe(1);
    store.distributeSelection('h');
    const xs = store.currentPage().elements.map((e) => (e.kind === 'shape' ? e.x : 0));
    expect(xs[1] - xs[0]).toBe(xs[2] - xs[1]);
  });

  it('merges rapid style changes into one undo step', () => {
    const s = store.addShapeAt('rectangle', { x: 0, y: 0 });
    const before = store.getState().past.length;
    store.updateShapeStyle([s.id], { fill: '#111111' }, 'fill');
    store.updateShapeStyle([s.id], { fill: '#222222' }, 'fill');
    expect(store.getState().past.length).toBe(before + 1);
  });
});

describe('groups and locks', () => {
  beforeEach(() => store.resetStore());

  const three = () => {
    const a = store.makeShape('rectangle', { x: 0, y: 0 }, { w: 20, h: 20 });
    const b = store.makeShape('rectangle', { x: 100, y: 40 }, { w: 20, h: 20 });
    const c = store.makeShape('rectangle', { x: 300, y: 90 }, { w: 20, h: 20 });
    store.addElements([a, b, c]);
    return [a, b, c];
  };

  it('groups, expands selection to the group, and ungroups', () => {
    const [a, b, c] = three();
    store.setState({ selection: [a.id, b.id] });
    store.groupSelection();
    expect(store.expandToGroups([a.id]).sort()).toEqual([a.id, b.id].sort());
    expect(store.expandToGroups([c.id])).toEqual([c.id]);
    expect(store.isWholeGroup([a.id, b.id])).toBe(true);
    store.ungroupSelection();
    expect(store.currentPage().elements.every((e) => !e.groupId)).toBe(true);
  });

  it('gives pasted groups a new group id', () => {
    const [a, b] = three();
    store.setState({ selection: [a.id, b.id] });
    store.groupSelection();
    store.copySelection();
    store.paste();
    const els = store.currentPage().elements;
    expect(els[3].groupId).toBeTruthy();
    expect(els[3].groupId).toBe(els[4].groupId);
    expect(els[3].groupId).not.toBe(els[0].groupId);
  });

  it('aligns a group as one unit', () => {
    const [a, b, c] = three();
    store.setState({ selection: [a.id, b.id] });
    store.groupSelection();
    store.setState({ selection: [a.id, b.id, c.id] });
    store.alignSelection('top');
    const [na, nb, nc] = store.currentPage().elements as Shape[];
    expect(nb.y - na.y).toBe(40); // the group keeps its internal layout
    expect(nc.y).toBe(na.y);
  });

  it('does not delete, nudge or resize locked items', () => {
    const [a, b] = three();
    store.setState({ selection: [a.id] });
    store.toggleLockSelection();
    store.nudgeSelection(10, 0);
    store.updateShapeGeometry(a.id, { w: 500 });
    store.setState({ selection: [a.id, b.id] });
    store.deleteSelection();
    const els = store.currentPage().elements as Shape[];
    expect(els.map((e) => e.id)).toContain(a.id);
    expect(els.map((e) => e.id)).not.toContain(b.id);
    const la = els.find((e) => e.id === a.id)!;
    expect(la).toMatchObject({ x: a.x, w: a.w, locked: true });
    store.setState({ selection: [a.id] });
    store.toggleLockSelection();
    expect(store.currentPage().elements[0].locked).toBeUndefined();
  });
});

describe('style clipboard', () => {
  beforeEach(() => store.resetStore());

  it('copies a shape style onto other shapes and a line style onto lines', () => {
    const a = store.makeShape('rectangle', { x: 0, y: 0 });
    const b = store.makeShape('ellipse', { x: 300, y: 0 });
    const c1 = store.makeConnector({ x: 0, y: 0 }, { x: 10, y: 0 }, { stroke: '#ff0000', routing: 'curved' });
    const c2 = store.makeConnector({ x: 0, y: 50 }, { x: 10, y: 50 });
    a.style = { ...a.style, fill: '#123456', bold: true };
    store.addElements([a, b, c1, c2]);
    store.setState({ selection: [a.id, c1.id] });
    expect(store.copyStyle()).toBe(true);
    store.setState({ selection: [b.id, c2.id] });
    store.pasteStyle();
    const [, nb, , nc2] = store.currentPage().elements as any[];
    expect(nb.style).toMatchObject({ fill: '#123456', bold: true });
    expect(nc2.style.stroke).toBe('#ff0000');
    expect(nc2.style.routing).toBe('orthogonal'); // keeps its own routing
  });
});

describe('file format', () => {
  it('round-trips a document and fills in missing style fields', () => {
    store.resetStore();
    store.addShapeAt('diamond', { x: 0, y: 0 });
    const text = serialize(store.getState().doc);
    const back = parseDoc(text);
    expect(back.pages[0].elements[0]).toMatchObject({ type: 'diamond' });
    const raw = JSON.parse(text);
    delete raw.pages[0].elements[0].style.fontSize;
    const fixed = parseDoc(JSON.stringify(raw));
    const el = fixed.pages[0].elements[0];
    expect(el.kind === 'shape' && el.style.fontSize).toBe(14);
  });

  it('rejects files that are not diagrams', () => {
    expect(() => parseDoc('{"hello": 1}')).toThrow();
  });
});
