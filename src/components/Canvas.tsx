import { useEffect, useLayoutEffect, useRef, useState, type DragEvent, type PointerEvent as RPointerEvent } from 'react';
import {
  addElements, addShapeAt, currentPage, expandToGroups, isWholeGroup, shiftPoints, editElements, getState, makeConnector, makeShape, pushHistory, setDocTransient,
  setState, shapeLookup, useApp, withElements, zoomAt, type View,
} from '../store';
import {
  anchorPoint, dist, localToWorld, normRect, rectContains, rotateVec, shapeBounds, shapeCenter, SIDE_VEC, SIDES,
  snapTo, sub, unionRects,
} from '../model/geometry';
import { computeRoute, routePath } from '../model/connectors';
import { SHAPES, isFrameShape } from '../model/shapes';
import type { Connector, DiagramDoc, DiagramElement, Endpoint, Point, Rect, Shape, ShapeType, Side } from '../model/types';
import { ShapeView } from './ShapeView';
import { ConnectorView } from './ConnectorView';
import { TextEditor } from './TextEditor';
import { importImageFiles, LIBRARY_MIME, type LibraryDragPayload } from '../lib/io';
import { elementBounds } from '../store';
import type React from 'react';

type Drag =
  | { kind: 'pan'; sx: number; sy: number; view: View }
  | {
      kind: 'move'; start: Point; snapshot: DiagramDoc; ids: Set<string>;
      orig: Map<string, Point>; origConn: Map<string, { from: Endpoint; to: Endpoint; waypoints?: Point[] }>;
      bbox: Rect | null; moved: boolean; clickedId: string; collapseTo: string[] | null;
    }
  | { kind: 'resize'; id: string; hx: number; hy: number; orig: Shape; snapshot: DiagramDoc }
  | { kind: 'scale'; hx: number; hy: number; bbox: Rect; ids: Set<string>; snapshot: DiagramDoc }
  | { kind: 'bend'; id: string; index: number; insert: boolean; snapshot: DiagramDoc; moved: boolean }
  | { kind: 'segment'; id: string; index: number; base: Point[]; horizontal: boolean; snapshot: DiagramDoc; moved: boolean }
  | { kind: 'rotate'; id: string; orig: Shape; snapshot: DiagramDoc }
  | { kind: 'endpoint'; id: string; end: 'from' | 'to'; snapshot: DiagramDoc }
  | { kind: 'connect'; from: Endpoint; start: Point; current: Point }
  | { kind: 'marquee'; start: Point; current: Point; additive: boolean; base: string[] }
  | { kind: 'create'; type: ShapeType; start: Point; current: Point };

interface Guide { x1: number; y1: number; x2: number; y2: number }

interface DropTarget { shapeId: string; side: Side | 'auto' }

const ACCENT = '#0d9488';

const isShapeTool = (t: string): t is ShapeType => t in SHAPES;

export function Canvas() {
  const page = useApp((s) => currentPage(s));
  const view = useApp((s) => s.view);
  const selection = useApp((s) => s.selection);
  const tool = useApp((s) => s.tool);
  const settings = useApp((s) => s.settings);
  const editingId = useApp((s) => s.editingId);
  const editingLane = useApp((s) => s.editingLane);
  const spaceHeld = useApp((s) => s.spaceHeld);
  const background = useApp((s) => s.doc.background);

  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<Drag | null>(null);
  const [dragKind, setDragKind] = useState<Drag['kind'] | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [marquee, setMarquee] = useState<Rect | null>(null);
  const [preview, setPreview] = useState<{ from: Point; to: Point; type?: ShapeType } | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);

  const shapes = shapeLookup(page.elements);
  const selSet = new Set(selection);

  // Track the viewport size for fit/zoom math.
  useLayoutEffect(() => {
    const el = wrapRef.current!;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      const first = getState().viewport.w === 800 && getState().view.x === 0;
      setState({ viewport: { w: r.width, h: r.height } });
      if (first) setState({ view: { x: r.width / 2 - 300, y: r.height / 2 - 200, zoom: 1 } });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Wheel: scroll pans, ctrl/cmd (and trackpad pinch) zooms.
  useEffect(() => {
    const el = svgRef.current!;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const v = getState().view;
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025));
        zoomAt({ x: e.clientX - r.left, y: e.clientY - r.top }, v.zoom * factor);
      } else {
        const k = e.deltaMode === 1 ? 20 : 1;
        const dx = e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
        const dy = e.shiftKey && !e.deltaX ? 0 : e.deltaY;
        setState({ view: { ...v, x: v.x - dx * k, y: v.y - dy * k } });
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  function toWorld(clientX: number, clientY: number): Point {
    const r = svgRef.current!.getBoundingClientRect();
    const v = getState().view;
    return { x: (clientX - r.left - v.x) / v.zoom, y: (clientY - r.top - v.y) / v.zoom };
  }

  function snapPoint(p: Point): Point {
    const st = getState().settings;
    if (!st.snapToGrid) return p;
    return { x: snapTo(p.x, st.gridSize), y: snapTo(p.y, st.gridSize) };
  }

  function shapeAtClient(x: number, y: number, exclude?: string): Shape | null {
    const pageNow = currentPage();
    const lookup = shapeLookup(pageNow.elements);
    for (const el of document.elementsFromPoint(x, y)) {
      const g = el.closest('[data-role="shape"]') as SVGElement | null;
      const id = g?.dataset.id;
      if (id && id !== exclude && lookup.has(id)) return lookup.get(id)!;
    }
    return null;
  }

  /** Glue target for a dragged connector end: snap to a side if close, else 'auto'. */
  function glueAt(clientX: number, clientY: number, p: Point): DropTarget | null {
    const s = shapeAtClient(clientX, clientY);
    const zoom = getState().view.zoom;
    const candidates = s ? [s] : [];
    // Also allow snapping to an anchor dot just outside a shape.
    if (!s) {
      for (const sh of shapeLookup(currentPage().elements).values()) {
        for (const side of SIDES) if (dist(anchorPoint(sh, side), p) < 14 / zoom) candidates.push(sh);
      }
    }
    for (const sh of candidates) {
      let best: Side | null = null;
      let bd = 14 / zoom;
      for (const side of SIDES) {
        const d = dist(anchorPoint(sh, side), p);
        if (d < bd) { bd = d; best = side; }
      }
      if (best) return { shapeId: sh.id, side: best };
    }
    return s ? { shapeId: s.id, side: 'auto' } : null;
  }

  function endpointFrom(target: DropTarget | null, p: Point): Endpoint {
    if (target) return { shapeId: target.shapeId, anchor: target.side, x: p.x, y: p.y };
    const q = snapPoint(p);
    return { x: q.x, y: q.y };
  }

  function beginDrag(d: Drag, e: RPointerEvent) {
    drag.current = d;
    setDragKind(d.kind);
    svgRef.current!.setPointerCapture(e.pointerId);
  }

  function onPointerDown(e: RPointerEvent<SVGSVGElement>) {
    const st = getState();
    // Finish any text edit / input focus, and stop the browser from moving focus itself.
    (document.activeElement as HTMLElement | null)?.blur?.();
    e.preventDefault();
    const p = toWorld(e.clientX, e.clientY);
    if (e.button === 1 || (e.button === 0 && (st.spaceHeld || st.tool === 'hand'))) {
      e.preventDefault();
      beginDrag({ kind: 'pan', sx: e.clientX, sy: e.clientY, view: st.view }, e);
      return;
    }
    if (e.button !== 0) return;
    const target = (e.target as Element).closest('[data-role]') as SVGElement | null;
    const role = target?.dataset.role;
    const id = target?.dataset.id ?? '';
    const pageNow = currentPage(st);
    const lookup = shapeLookup(pageNow.elements);

    if (role === 'handle') {
      const orig = lookup.get(id)!;
      beginDrag({ kind: 'resize', id, hx: Number(target!.dataset.hx), hy: Number(target!.dataset.hy), orig, snapshot: st.doc }, e);
      return;
    }
    if (role === 'bend' || role === 'bend-new') {
      beginDrag({ kind: 'bend', id, index: Number(target!.dataset.index), insert: role === 'bend-new', snapshot: st.doc, moved: false }, e);
      return;
    }
    if (role === 'segment') {
      const conn = pageNow.elements.find((x) => x.id === id) as Connector;
      const r = computeRoute(conn, lookup);
      const index = Number(target!.dataset.index);
      const a = r.points[index], b = r.points[index + 1];
      beginDrag({
        kind: 'segment', id, index, base: r.points.slice(1, -1), horizontal: Math.abs(a.y - b.y) < 0.01,
        snapshot: st.doc, moved: false,
      }, e);
      return;
    }
    if (role === 'ghandle') {
      const sel = new Set(st.selection);
      const rects = pageNow.elements.filter((el) => sel.has(el.id)).map((el) => elementBounds(el, lookup));
      beginDrag({
        kind: 'scale', hx: Number(target!.dataset.hx), hy: Number(target!.dataset.hy), bbox: unionRects(rects)!,
        ids: sel, snapshot: st.doc,
      }, e);
      return;
    }
    if (role === 'rotate') {
      beginDrag({ kind: 'rotate', id, orig: lookup.get(id)!, snapshot: st.doc }, e);
      return;
    }
    if (role === 'endpoint') {
      beginDrag({ kind: 'endpoint', id, end: target!.dataset.end as 'from' | 'to', snapshot: st.doc }, e);
      return;
    }
    if (role === 'anchor') {
      const side = target!.dataset.side as Side;
      const sh = lookup.get(id)!;
      const start = anchorPoint(sh, side);
      beginDrag({ kind: 'connect', from: { shapeId: id, anchor: side, x: start.x, y: start.y }, start, current: p }, e);
      return;
    }

    if (st.tool === 'text') {
      const s = makeShape('text', snapPoint(p));
      addElements([s]);
      setState({ tool: 'select', editingId: s.id });
      return;
    }
    if (isShapeTool(st.tool)) {
      const sp = snapPoint(p);
      beginDrag({ kind: 'create', type: st.tool, start: sp, current: sp }, e);
      return;
    }
    if (st.tool === 'connector') {
      const sh = role === 'shape' ? lookup.get(id) : undefined;
      const from: Endpoint = sh ? { shapeId: sh.id, anchor: 'auto', x: p.x, y: p.y } : { ...snapPoint(p) };
      beginDrag({ kind: 'connect', from, start: sh ? shapeCenter(sh) : snapPoint(p), current: p }, e);
      return;
    }

    // select tool
    if (role === 'shape' || role === 'connector') {
      let sel = st.selection;
      let collapseTo: string[] | null = null;
      const members = expandToGroups([id], pageNow.elements);
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        sel = members.every((m) => sel.includes(m)) ? sel.filter((x) => !members.includes(x)) : [...new Set([...sel, ...members])];
      } else if (!sel.includes(id)) {
        sel = members;
      } else if (members.length > 1 && isWholeGroup(sel, pageNow.elements) && sel.length === members.length) {
        collapseTo = [id]; // second click on a selected group picks the single item
      } else if (sel.length > members.length) {
        collapseTo = members; // a plain click (no drag) on a selected item selects only it (or its group)
      }
      setState({ selection: sel });
      const ids = new Set(sel);
      const orig = new Map<string, Point>();
      const origConn = new Map<string, { from: Endpoint; to: Endpoint; waypoints?: Point[] }>();
      const rects: Rect[] = [];
      // containers and swimlanes carry the shapes that sit entirely inside them
      const frames = pageNow.elements.filter((el): el is Shape => el.kind === 'shape' && ids.has(el.id) && !el.locked && isFrameShape(el.type));
      const carried = new Set<string>();
      for (const f of frames) {
        const fb = shapeBounds(f);
        for (const el of pageNow.elements) {
          if (el.kind !== 'shape' || el.id === f.id || el.locked || ids.has(el.id)) continue;
          const b = shapeBounds(el);
          if (b.x >= fb.x && b.y >= fb.y && b.x + b.w <= fb.x + fb.w && b.y + b.h <= fb.y + fb.h) carried.add(el.id);
        }
      }
      for (const el of pageNow.elements) {
        if (carried.has(el.id) && el.kind === 'shape') {
          orig.set(el.id, { x: el.x, y: el.y });
          continue;
        }
        if (!ids.has(el.id) || el.locked) continue;
        if (el.kind === 'shape') {
          orig.set(el.id, { x: el.x, y: el.y });
          rects.push(shapeBounds(el));
        } else {
          origConn.set(el.id, { from: el.from, to: el.to, waypoints: el.waypoints });
        }
      }
      beginDrag({
        kind: 'move', start: p, snapshot: st.doc, ids, orig, origConn, bbox: unionRects(rects), moved: false,
        clickedId: id, collapseTo,
      }, e);
      return;
    }
    const additive = e.shiftKey || e.metaKey || e.ctrlKey;
    if (!additive) setState({ selection: [] });
    beginDrag({ kind: 'marquee', start: p, current: p, additive, base: additive ? st.selection : [] }, e);
  }

  function onPointerMove(e: RPointerEvent<SVGSVGElement>) {
    const d = drag.current;
    if (!d) {
      const st = getState();
      if (st.tool !== 'select' && st.tool !== 'connector') {
        if (hoverId) setHoverId(null);
        return;
      }
      const t = (e.target as Element).closest('[data-role]') as SVGElement | null;
      const role = t?.dataset.role;
      const id = role === 'shape' || role === 'anchor' || role === 'handle' ? t!.dataset.id! : null;
      if (id !== hoverId) setHoverId(id);
      return;
    }
    const st = getState();
    const p = toWorld(e.clientX, e.clientY);
    switch (d.kind) {
      case 'pan':
        setState({ view: { ...d.view, x: d.view.x + e.clientX - d.sx, y: d.view.y + e.clientY - d.sy } });
        break;
      case 'move': {
        let dx = p.x - d.start.x;
        let dy = p.y - d.start.y;
        if (!d.moved && Math.hypot(dx, dy) * st.view.zoom < 3) return;
        d.moved = true;
        const newGuides: Guide[] = [];
        if (d.bbox && !e.altKey) {
          const snapped = snapMove(d.bbox, dx, dy, new Set([...d.ids, ...d.orig.keys()]), st, newGuides);
          dx = snapped.dx;
          dy = snapped.dy;
        }
        setGuides(newGuides);
        const doc = withElements(d.snapshot, st.pageId, (els) =>
          els.map((el) => {
            if (el.kind === 'shape') {
              const o = d.orig.get(el.id);
              return o ? { ...el, x: o.x + dx, y: o.y + dy } : el;
            }
            const oc = d.origConn.get(el.id);
            if (!oc) return el;
            const mv = (ep: Endpoint): Endpoint => (ep.shapeId ? ep : { ...ep, x: ep.x + dx, y: ep.y + dy });
            return { ...el, from: mv(oc.from), to: mv(oc.to), waypoints: shiftPoints(oc.waypoints, dx, dy) };
          }),
        );
        setDocTransient(doc);
        break;
      }
      case 'resize': {
        const next = resizeShape(d.orig, d.hx, d.hy, p, e.shiftKey, st.settings.snapToGrid && !d.orig.rotation ? st.settings.gridSize : 0);
        setDocTransient(withElements(d.snapshot, st.pageId, (els) => els.map((el) => (el.id === d.id ? next : el))));
        break;
      }
      case 'bend': {
        const q = e.altKey ? p : snapPoint(p);
        d.moved = true;
        setDocTransient(withElements(d.snapshot, st.pageId, (els) => els.map((el) => {
          if (el.id !== d.id || el.kind !== 'connector') return el;
          const wps = [...(el.waypoints ?? [])];
          if (d.insert) wps.splice(d.index, 0, q);
          else wps[d.index] = q;
          return { ...el, waypoints: wps };
        })));
        break;
      }
      case 'segment': {
        const q = e.altKey ? p : snapPoint(p);
        d.moved = true;
        // route points [s, ...base, e]: segment i joins base[i-1] and base[i]
        const wps = d.base.map((b) => ({ ...b }));
        const i0 = d.index - 1, i1 = d.index;
        for (const k of [i0, i1]) {
          if (k < 0 || k >= wps.length) continue;
          if (d.horizontal) wps[k].y = q.y;
          else wps[k].x = q.x;
        }
        setDocTransient(withElements(d.snapshot, st.pageId, (els) => els.map((el) => (el.id === d.id && el.kind === 'connector' ? { ...el, waypoints: wps } : el))));
        break;
      }
      case 'scale': {
        const next = scaleSelection(d, p, e.shiftKey, st.settings.snapToGrid ? st.settings.gridSize : 0);
        setDocTransient(withElements(d.snapshot, st.pageId, next));
        break;
      }
      case 'rotate': {
        const c = shapeCenter(d.orig);
        let a = (Math.atan2(p.y - c.y, p.x - c.x) * 180) / Math.PI + 90;
        if (e.shiftKey) a = Math.round(a / 15) * 15;
        else {
          const r90 = Math.round(a / 90) * 90;
          if (Math.abs(a - r90) < 4) a = r90;
        }
        a = ((Math.round(a) % 360) + 360) % 360;
        setDocTransient(withElements(d.snapshot, st.pageId, (els) => els.map((el) => (el.id === d.id ? { ...d.orig, rotation: a } : el))));
        break;
      }
      case 'endpoint': {
        const conn = currentPage(st).elements.find((el) => el.id === d.id) as Connector | undefined;
        if (!conn) return;
        const other = d.end === 'from' ? conn.to : conn.from;
        let tgt = glueAt(e.clientX, e.clientY, p);
        if (tgt && tgt.shapeId === other.shapeId && tgt.side === 'auto' && other.anchor === 'auto') tgt = null;
        setDropTarget(tgt);
        const ep = endpointFrom(tgt, p);
        setDocTransient(withElements(d.snapshot, st.pageId, (els) => els.map((el) => (el.id === d.id ? { ...conn, [d.end]: ep } : el))));
        break;
      }
      case 'connect': {
        d.current = p;
        let tgt = glueAt(e.clientX, e.clientY, p);
        if (tgt && tgt.shapeId === d.from.shapeId && tgt.side === 'auto') tgt = null;
        setDropTarget(tgt);
        setPreview({ from: d.start, to: p });
        break;
      }
      case 'marquee': {
        d.current = p;
        const r = normRect(d.start, p);
        setMarquee(r);
        const pageNow = currentPage(st);
        const lookup = shapeLookup(pageNow.elements);
        const hitSet = new Set(pageNow.elements.filter((el) => !el.locked && rectContains(r, elementBounds(el, lookup))).map((el) => el.id));
        // a group is only picked up when all of it is inside the box
        const hits = [...hitSet].filter((id) => expandToGroups([id], pageNow.elements).every((m) => hitSet.has(m)));
        const sel = d.additive ? Array.from(new Set([...d.base, ...hits])) : hits;
        if (sel.join() !== st.selection.join()) setState({ selection: sel });
        break;
      }
      case 'create':
        d.current = snapPoint(p);
        setPreview({ from: d.start, to: d.current, type: d.type });
        break;
    }
  }

  function onPointerUp(e: RPointerEvent<SVGSVGElement>) {
    const d = drag.current;
    drag.current = null;
    setDragKind(null);
    setGuides([]);
    setMarquee(null);
    setPreview(null);
    setDropTarget(null);
    if (!d) return;
    try { svgRef.current!.releasePointerCapture(e.pointerId); } catch { /* not captured */ }
    const st = getState();
    switch (d.kind) {
      case 'move':
        if (d.moved) pushHistory(d.snapshot);
        else if (d.collapseTo) setState({ selection: d.collapseTo });
        break;
      case 'bend':
      case 'segment':
        if (d.moved) pushHistory(d.snapshot);
        break;
      case 'resize':
      case 'scale':
      case 'rotate':
      case 'endpoint':
        pushHistory(d.snapshot);
        break;
      case 'connect': {
        const p = toWorld(e.clientX, e.clientY);
        if (dist(d.start, p) * st.view.zoom < 8 && !d.from.shapeId) return;
        let tgt = glueAt(e.clientX, e.clientY, p);
        if (tgt && tgt.shapeId === d.from.shapeId && tgt.side === 'auto') tgt = null;
        if (!tgt && dist(d.start, p) * st.view.zoom < 8) return;
        const c = makeConnector(d.from, endpointFrom(tgt, p), { routing: lastRouting() });
        addElements([c]);
        break;
      }
      case 'create': {
        const r = normRect(d.start, d.current);
        if (r.w < 8 || r.h < 8) addShapeAt(d.type, d.start);
        else {
          const s = makeShape(d.type, { x: r.x + r.w / 2, y: r.y + r.h / 2 }, { w: r.w, h: r.h });
          addElements([s]);
          setState({ tool: 'select' });
        }
        break;
      }
      default:
        break;
    }
  }

  function onDoubleClick(e: React.MouseEvent) {
    const st = getState();
    const bend = (e.target as Element).closest('[data-role="bend"]') as SVGElement | null;
    if (bend?.dataset.id) {
      const id = bend.dataset.id, index = Number(bend.dataset.index);
      editElements((els) => els.map((x) => {
        if (x.id !== id || x.kind !== 'connector' || !x.waypoints) return x;
        const wps = x.waypoints.filter((_, i) => i !== index);
        const next: Connector = { ...x, waypoints: wps };
        if (!wps.length) delete next.waypoints;
        return next;
      }));
      return;
    }
    for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
      const g = el.closest('[data-role="shape"],[data-role="connector"]') as SVGElement | null;
      if (g?.dataset.id) {
        const el = currentPage(st).elements.find((x) => x.id === g.dataset.id);
        if (el?.locked) {
          setState({ selection: expandToGroups([el.id]) });
          return;
        }
        const lane = (document.elementsFromPoint(e.clientX, e.clientY).find((x) => x instanceof SVGElement && x.dataset.lane && x.closest('[data-role="shape"]') === g) as SVGElement | undefined)?.dataset.lane;
        setState({ selection: [g.dataset.id], editingId: g.dataset.id, editingLane: lane != null ? Number(lane) : null });
        return;
      }
      if (el === svgRef.current) break;
    }
    if (st.tool !== 'select') return;
    const s = makeShape('text', snapPoint(toWorld(e.clientX, e.clientY)));
    addElements([s]);
    setState({ editingId: s.id });
  }

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if (drag.current) return;
    const st = getState();
    const world = toWorld(e.clientX, e.clientY);
    let id: string | null = null;
    for (const el of document.elementsFromPoint(e.clientX, e.clientY)) {
      const g = el.closest('[data-role="shape"],[data-role="connector"]') as SVGElement | null;
      if (g?.dataset.id) { id = g.dataset.id; break; }
      if (el === svgRef.current) break;
    }
    if (id && !st.selection.includes(id)) setState({ selection: expandToGroups([id]) });
    if (!id) setState({ selection: [] });
    setState({ contextMenu: { x: e.clientX, y: e.clientY, world: snapPoint(world), onElement: !!id } });
  }

  function onDragOver(e: DragEvent) {
    if (e.dataTransfer.types.includes(LIBRARY_MIME) || e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }

  async function onDrop(e: DragEvent) {
    e.preventDefault();
    const p = toWorld(e.clientX, e.clientY);
    const raw = e.dataTransfer.getData(LIBRARY_MIME);
    if (raw) {
      const item = JSON.parse(raw) as LibraryDragPayload;
      addShapeAt(item.type, snapPoint(p), { icon: item.icon });
      return;
    }
    if (e.dataTransfer.files.length) await importImageFiles(Array.from(e.dataTransfer.files), p);
  }

  // ---------------------------------------------------------------------------
  // Render

  const z = view.zoom;
  const selectedShapes = page.elements.filter((el): el is Shape => el.kind === 'shape' && selSet.has(el.id));
  const selectedConns = page.elements.filter((el): el is Connector => el.kind === 'connector' && selSet.has(el.id));
  const single = selection.length === 1 && selectedShapes.length === 1 ? selectedShapes[0] : null;
  const anchorShapeId = dropTarget?.shapeId ?? (dragKind ? null : hoverId);
  const anchorShape = anchorShapeId ? shapes.get(anchorShapeId) : undefined;
  const showAnchors = anchorShape && (tool === 'select' || tool === 'connector' || dragKind === 'connect' || dragKind === 'endpoint');

  const cursor =
    dragKind === 'pan' ? 'grabbing'
      : spaceHeld || tool === 'hand' ? 'grab'
        : tool !== 'select' ? 'crosshair'
          : undefined;

  const grid = settings.gridSize * z;
  const showMinor = settings.showGrid && grid >= 8;
  const major = grid * 5;

  return (
    <div ref={wrapRef} className="canvas-wrap" style={{ background: background === 'transparent' ? '#ffffff' : background }}>
      <svg
        ref={svgRef}
        className={`canvas${dragKind ? ' dragging' : ''}`}
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => !drag.current && setHoverId(null)}
        onDoubleClick={onDoubleClick}
        onContextMenu={onContextMenu}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        {settings.showGrid && (
          <>
            <defs>
              <pattern id="grid-minor" width={grid} height={grid} patternUnits="userSpaceOnUse" x={view.x % grid} y={view.y % grid}>
                <path d={`M${grid} 0 H0 V${grid}`} fill="none" stroke="#e8edf3" strokeWidth={1} />
              </pattern>
              <pattern id="grid-major" width={major} height={major} patternUnits="userSpaceOnUse" x={view.x % major} y={view.y % major}>
                <path d={`M${major} 0 H0 V${major}`} fill="none" stroke="#d5dde7" strokeWidth={1} />
              </pattern>
            </defs>
            {showMinor && <rect width="100%" height="100%" fill="url(#grid-minor)" pointerEvents="none" />}
            <rect width="100%" height="100%" fill="url(#grid-major)" pointerEvents="none" />
          </>
        )}
        <g transform={`translate(${view.x} ${view.y}) scale(${z})`}>
          {page.elements.map((el) =>
            el.kind === 'shape' ? (
              <ShapeView key={el.id} shape={el} interactive hideText={editingId === el.id} hideLane={editingLane} />
            ) : (
              <ConnectorView key={el.id} conn={el} shapes={shapes} interactive hideLabel={editingId === el.id} labelBackground={background} zoom={z} />
            ),
          )}

          {/* selection chrome */}
          <g className="overlay">
            {selectedShapes.map((s) => (
              <g key={s.id} transform={`translate(${s.x} ${s.y}) rotate(${s.rotation} ${s.w / 2} ${s.h / 2})`} pointerEvents="none">
                <rect width={s.w} height={s.h} fill="none" stroke={ACCENT} strokeWidth={1.5 / z} />
              </g>
            ))}
            {selectedConns.map((c) => {
              const r = computeRoute(c, shapes);
              return (
                <g key={c.id}>
                  <path d={routePath(r)} fill="none" stroke={ACCENT} strokeWidth={1 / z} strokeDasharray={`${4 / z} ${3 / z}`} pointerEvents="none" />
                  {!c.locked && selectedConns.length === 1 && selection.length === 1 && dragKind !== 'move' && <BendHandles conn={c} route={r} zoom={z} />}
                  {!c.locked && (['from', 'to'] as const).map((end) => {
                    const q = end === 'from' ? r.start : r.end;
                    const glued = !!c[end].shapeId;
                    return (
                      <circle key={end} data-role="endpoint" data-id={c.id} data-end={end} cx={q.x} cy={q.y} r={5 / z}
                        fill={glued ? ACCENT : '#ffffff'} stroke={ACCENT} strokeWidth={1.5 / z} className="handle-endpoint" />
                    );
                  })}
                </g>
              );
            })}
            {selection.length > 1 && (() => {
              const bb = unionRects(page.elements.filter((el) => selSet.has(el.id)).map((el) => elementBounds(el, shapes)));
              return bb ? <rect x={bb.x - 4 / z} y={bb.y - 4 / z} width={bb.w + 8 / z} height={bb.h + 8 / z} fill="none" stroke={ACCENT} strokeWidth={1 / z} strokeDasharray={`${4 / z} ${3 / z}`} pointerEvents="none" /> : null;
            })()}
            {single && !single.locked && !editingId && dragKind !== 'move' && <ResizeHandles shape={single} zoom={z} />}
            {selection.length > 1 && dragKind !== 'move' && !editingId && (() => {
              const movable = page.elements.some((el) => selSet.has(el.id) && !el.locked);
              const bb = unionRects(page.elements.filter((el) => selSet.has(el.id)).map((el) => elementBounds(el, shapes)));
              return movable && bb ? <GroupHandles bbox={bb} zoom={z} /> : null;
            })()}
            {page.elements.map((el) => (el.locked && selSet.has(el.id) ? <LockBadge key={`lock-${el.id}`} bounds={elementBounds(el, shapes)} zoom={z} /> : null))}
            {showAnchors && anchorShape && (
              <AnchorDots
                shape={anchorShape}
                zoom={z}
                offset={!dragKind && single?.id === anchorShape.id ? 22 / z : 0}
                active={dropTarget?.shapeId === anchorShape.id ? dropTarget.side : null}
              />
            )}
            {guides.map((g, i) => (
              <line key={i} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#ec4899" strokeWidth={1 / z} pointerEvents="none" />
            ))}
            {marquee && (
              <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h} fill="rgba(13,148,136,0.08)" stroke={ACCENT} strokeWidth={1 / z} pointerEvents="none" />
            )}
            {preview && !preview.type && (
              <line x1={preview.from.x} y1={preview.from.y} x2={preview.to.x} y2={preview.to.y} stroke={ACCENT} strokeWidth={1.5 / z} strokeDasharray={`${5 / z} ${4 / z}`} pointerEvents="none" />
            )}
            {preview?.type && (() => {
              const r = normRect(preview.from, preview.to);
              return <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="rgba(13,148,136,0.06)" stroke={ACCENT} strokeWidth={1 / z} strokeDasharray={`${4 / z} ${3 / z}`} pointerEvents="none" />;
            })()}
          </g>
        </g>
      </svg>
      {editingId && <TextEditor />}
      {page.elements.length === 0 && (
        <div className="empty-hint">
          <strong>Start drawing</strong>
          <span>Drag a shape from the left, or press R, O or D and click the canvas.</span>
          <span>Hover a shape and drag one of its dots to connect it.</span>
        </div>
      )}
    </div>
  );
}

function lastRouting() {
  const els = currentPage().elements;
  for (let i = els.length - 1; i >= 0; i--) {
    const e = els[i];
    if (e.kind === 'connector') return e.style.routing;
  }
  return 'orthogonal' as const;
}

/** Snap a moving group's bbox to other shapes' edges/centers, falling back to the grid. */
function snapMove(bbox: Rect, dx: number, dy: number, moving: Set<string>, st: ReturnType<typeof getState>, guides: Guide[]) {
  const z = st.view.zoom;
  const thr = 6 / z;
  const b = { x: bbox.x + dx, y: bbox.y + dy, w: bbox.w, h: bbox.h };
  let sx: number | null = null;
  let sy: number | null = null;
  if (st.settings.snapToObjects) {
    let bestX = thr, bestY = thr;
    let gx: { at: number; r: Rect } | null = null;
    let gy: { at: number; r: Rect } | null = null;
    const mine = [b.x, b.x + b.w / 2, b.x + b.w];
    const mineY = [b.y, b.y + b.h / 2, b.y + b.h];
    for (const el of currentPage(st).elements) {
      if (el.kind !== 'shape' || moving.has(el.id)) continue;
      const r = shapeBounds(el);
      for (const cx of [r.x, r.x + r.w / 2, r.x + r.w]) {
        for (const m of mine) {
          const dd = cx - m;
          if (Math.abs(dd) < bestX) { bestX = Math.abs(dd); sx = dd; gx = { at: cx, r }; }
        }
      }
      for (const cy of [r.y, r.y + r.h / 2, r.y + r.h]) {
        for (const m of mineY) {
          const dd = cy - m;
          if (Math.abs(dd) < bestY) { bestY = Math.abs(dd); sy = dd; gy = { at: cy, r }; }
        }
      }
    }
    if (gx && sx !== null) {
      const y1 = Math.min(gx.r.y, b.y + (sy ?? 0)) - 10;
      const y2 = Math.max(gx.r.y + gx.r.h, b.y + b.h + (sy ?? 0)) + 10;
      guides.push({ x1: gx.at, y1, x2: gx.at, y2 });
    }
    if (gy && sy !== null) {
      const x1 = Math.min(gy.r.x, b.x + (sx ?? 0)) - 10;
      const x2 = Math.max(gy.r.x + gy.r.w, b.x + b.w + (sx ?? 0)) + 10;
      guides.push({ x1, y1: gy.at, x2, y2: gy.at });
    }
  }
  const g = st.settings.gridSize;
  if (sx !== null) dx += sx;
  else if (st.settings.snapToGrid) dx = snapTo(bbox.x + dx, g) - bbox.x;
  if (sy !== null) dy += sy;
  else if (st.settings.snapToGrid) dy = snapTo(bbox.y + dy, g) - bbox.y;
  return { dx, dy };
}

const MIN_SIZE = 10;

/** Resize keeping the opposite handle fixed in world space (works for rotated shapes). */
export function resizeShape(orig: Shape, hx: number, hy: number, pointer: Point, keepRatio: boolean, grid: number): Shape {
  const p = grid ? { x: snapTo(pointer.x, grid), y: snapTo(pointer.y, grid) } : pointer;
  const fixedLocal = { x: (1 - hx) * orig.w, y: (1 - hy) * orig.h };
  const fixedWorld = localToWorld(orig, fixedLocal);
  const rel = rotateVec(sub(p, fixedWorld), -orig.rotation);
  let w = orig.w;
  let h = orig.h;
  if (hx !== 0.5) w = Math.max(MIN_SIZE, hx === 1 ? rel.x : -rel.x);
  if (hy !== 0.5) h = Math.max(MIN_SIZE, hy === 1 ? rel.y : -rel.y);
  if (keepRatio && hx !== 0.5 && hy !== 0.5) {
    const k = Math.max(w / orig.w, h / orig.h);
    w = orig.w * k;
    h = orig.h * k;
  }
  const newFixedLocal = { x: (1 - hx) * w, y: (1 - hy) * h };
  const centerOffset = rotateVec({ x: w / 2 - newFixedLocal.x, y: h / 2 - newFixedLocal.y }, orig.rotation);
  const cx = fixedWorld.x + centerOffset.x;
  const cy = fixedWorld.y + centerOffset.y;
  return { ...orig, w: Math.round(w), h: Math.round(h), x: Math.round(cx - w / 2), y: Math.round(cy - h / 2) };
}

const HANDLES: [number, number][] = [[0, 0], [0.5, 0], [1, 0], [1, 0.5], [1, 1], [0.5, 1], [0, 1], [0, 0.5]];
const CURSORS = ['nwse', 'ns', 'nesw', 'ew', 'nwse', 'ns', 'nesw', 'ew'];

function handleCursor(i: number, rotation: number) {
  const steps = Math.round(rotation / 45);
  const order = ['ns', 'nesw', 'ew', 'nwse'];
  const base = order.indexOf(CURSORS[i]);
  return `${order[(((base + steps) % 4) + 4) % 4]}-resize`;
}

function ResizeHandles({ shape, zoom }: { shape: Shape; zoom: number }) {
  const s = 8 / zoom;
  return (
    <g transform={`translate(${shape.x} ${shape.y}) rotate(${shape.rotation} ${shape.w / 2} ${shape.h / 2})`}>
      {/* rotation knob sits off the top-right corner, clear of the connection dots */}
      <line x1={shape.w} y1={0} x2={shape.w + 14 / zoom} y2={-14 / zoom} stroke={ACCENT} strokeWidth={1 / zoom} pointerEvents="none" />
      <circle data-role="rotate" data-id={shape.id} cx={shape.w + 14 / zoom} cy={-14 / zoom} r={5 / zoom} fill="#fff" stroke={ACCENT} strokeWidth={1.5 / zoom} style={{ cursor: 'grab' }}>
        <title>Rotate (Shift snaps to 15°)</title>
      </circle>
      {HANDLES.map(([hx, hy], i) => {
        // hide edge handles on tiny shapes so corners stay grabbable
        if ((hx === 0.5 && shape.w * zoom < 30) || (hy === 0.5 && shape.h * zoom < 30)) return null;
        return (
          <rect
            key={i}
            data-role="handle"
            data-id={shape.id}
            data-hx={hx}
            data-hy={hy}
            x={hx * shape.w - s / 2}
            y={hy * shape.h - s / 2}
            width={s}
            height={s}
            rx={1.5 / zoom}
            fill="#fff"
            stroke={ACCENT}
            strokeWidth={1.5 / zoom}
            style={{ cursor: handleCursor(i, shape.rotation) }}
          />
        );
      })}
    </g>
  );
}

function AnchorDots({ shape, zoom, offset, active }: { shape: Shape; zoom: number; offset: number; active: Side | 'auto' | null }) {
  return (
    <g>
      {active === 'auto' && (
        <g transform={`translate(${shape.x} ${shape.y}) rotate(${shape.rotation} ${shape.w / 2} ${shape.h / 2})`} pointerEvents="none">
          <rect x={-3 / zoom} y={-3 / zoom} width={shape.w + 6 / zoom} height={shape.h + 6 / zoom} fill="none" stroke={ACCENT} strokeWidth={2 / zoom} rx={4 / zoom} />
        </g>
      )}
      {SIDES.map((side) => {
        const p = anchorPoint(shape, side);
        const v = rotateVec(SIDE_VEC[side], shape.rotation);
        const q = { x: p.x + v.x * offset, y: p.y + v.y * offset };
        const on = active === side;
        return (
          <circle
            key={side}
            data-role="anchor"
            data-id={shape.id}
            data-side={side}
            cx={q.x}
            cy={q.y}
            r={(on ? 6 : 4.5) / zoom}
            fill={on ? ACCENT : '#ffffff'}
            stroke={ACCENT}
            strokeWidth={1.5 / zoom}
            className="anchor-dot"
          />
        );
      })}
    </g>
  );
}

/** Scale every unlocked selected element relative to the corner opposite the dragged handle. */
function scaleSelection(
  d: Extract<Drag, { kind: 'scale' }>, pointer: Point, keepRatio: boolean, grid: number,
): (els: DiagramElement[]) => DiagramElement[] {
  const b = d.bbox;
  const p = grid ? { x: snapTo(pointer.x, grid), y: snapTo(pointer.y, grid) } : pointer;
  const fx = b.x + (1 - d.hx) * b.w;
  const fy = b.y + (1 - d.hy) * b.h;
  let sx = Math.max(10, d.hx === 1 ? p.x - fx : fx - p.x) / Math.max(b.w, 1);
  let sy = Math.max(10, d.hy === 1 ? p.y - fy : fy - p.y) / Math.max(b.h, 1);
  if (keepRatio) sx = sy = Math.max(sx, sy);
  const tx = (x: number) => fx + (x - fx) * sx;
  const ty = (y: number) => fy + (y - fy) * sy;
  return (els) =>
    els.map((el) => {
      if (!d.ids.has(el.id) || el.locked) return el;
      if (el.kind === 'shape') {
        const cx = tx(el.x + el.w / 2);
        const cy = ty(el.y + el.h / 2);
        const w = Math.max(4, el.w * sx);
        const h = Math.max(4, el.h * sy);
        return { ...el, x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w: Math.round(w), h: Math.round(h) };
      }
      const mv = (ep: Endpoint): Endpoint => (ep.shapeId ? ep : { ...ep, x: tx(ep.x), y: ty(ep.y) });
      return { ...el, from: mv(el.from), to: mv(el.to), waypoints: el.waypoints?.map((q) => ({ x: tx(q.x), y: ty(q.y) })) };
    });
}

function GroupHandles({ bbox, zoom }: { bbox: Rect; zoom: number }) {
  const s = 8 / zoom;
  const pad = 4 / zoom;
  const corners: [number, number, string][] = [[0, 0, 'nwse'], [1, 0, 'nesw'], [1, 1, 'nwse'], [0, 1, 'nesw']];
  return (
    <g>
      {corners.map(([hx, hy, cur]) => (
        <rect
          key={`${hx}${hy}`}
          data-role="ghandle"
          data-hx={hx}
          data-hy={hy}
          x={bbox.x - pad + hx * (bbox.w + 2 * pad) - s / 2}
          y={bbox.y - pad + hy * (bbox.h + 2 * pad) - s / 2}
          width={s}
          height={s}
          rx={1.5 / zoom}
          fill={ACCENT}
          stroke="#fff"
          strokeWidth={1 / zoom}
          style={{ cursor: `${cur}-resize` }}
        >
          <title>Resize selection (Shift keeps proportions)</title>
        </rect>
      ))}
    </g>
  );
}

function LockBadge({ bounds, zoom }: { bounds: Rect; zoom: number }) {
  const k = 1 / zoom;
  return (
    <g transform={`translate(${bounds.x + bounds.w + 6 * k} ${bounds.y - 18 * k}) scale(${k})`} pointerEvents="none">
      <rect width={16} height={16} rx={4} fill="#0f172a" />
      <rect x={4} y={7.5} width={8} height={6} rx={1} fill="#fff" />
      <path d="M5.5 7.5V6a2.5 2.5 0 015 0v1.5" fill="none" stroke="#fff" strokeWidth={1.4} />
    </g>
  );
}

/** Handles to reshape a selected line: bend points and segment grips. */
function BendHandles({ conn, route, zoom }: { conn: Connector; route: ReturnType<typeof computeRoute>; zoom: number }) {
  const r = 4.5 / zoom;
  if (conn.style.routing === 'orthogonal') {
    const pts = route.points;
    const grips = [];
    // only middle segments can slide; the end segments follow their shapes
    for (let i = 1; i < pts.length - 2; i++) {
      const a = pts[i], b = pts[i + 1];
      const horizontal = Math.abs(a.y - b.y) < 0.01;
      const len = Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      if (len * zoom < 18) continue;
      const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const w = (horizontal ? 18 : 6) / zoom, h = (horizontal ? 6 : 18) / zoom;
      grips.push(
        <rect key={i} data-role="segment" data-id={conn.id} data-index={i} x={m.x - w / 2} y={m.y - h / 2} width={w} height={h} rx={3 / zoom}
          fill="#fff" stroke={ACCENT} strokeWidth={1.5 / zoom} style={{ cursor: horizontal ? 'ns-resize' : 'ew-resize' }}>
          <title>Drag to move this segment</title>
        </rect>,
      );
    }
    return <g>{grips}</g>;
  }
  const wps = conn.waypoints ?? [];
  const chain = [route.start, ...wps, route.end];
  return (
    <g>
      {chain.slice(0, -1).map((a, i) => {
        const b = chain[i + 1];
        if (Math.hypot(a.x - b.x, a.y - b.y) * zoom < 24) return null;
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        return (
          <circle key={`n${i}`} data-role="bend-new" data-id={conn.id} data-index={i} cx={m.x} cy={m.y} r={r * 0.8}
            fill="#fff" stroke={ACCENT} strokeWidth={1 / zoom} strokeDasharray={`${2 / zoom} ${1.5 / zoom}`} style={{ cursor: 'copy' }}>
            <title>Drag to add a bend point</title>
          </circle>
        );
      })}
      {wps.map((q, i) => (
        <rect key={`b${i}`} data-role="bend" data-id={conn.id} data-index={i} x={q.x - r} y={q.y - r} width={2 * r} height={2 * r}
          transform={`rotate(45 ${q.x} ${q.y})`} fill={ACCENT} stroke="#fff" strokeWidth={1 / zoom} style={{ cursor: 'move' }}>
          <title>Drag to move, double-click to remove</title>
        </rect>
      ))}
    </g>
  );
}
