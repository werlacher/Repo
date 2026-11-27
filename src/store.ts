import { useSyncExternalStore } from 'react';
import { defaultConnectorStyle, defaultShapeStyle, newDoc, newId, newPage } from './model/defaults';
import { computeRoute, routeBoundsPoints, type ShapeLookup } from './model/connectors';
import { boundsOfPoints, shapeBounds, unionRects } from './model/geometry';
import { SHAPES } from './model/shapes';
import type {
  Connector, ConnectorStyle, DiagramDoc, DiagramElement, Endpoint, IconData, ImageData, Page, Point, Rect, Shape,
  ShapeStyle, ShapeType, Tool,
} from './model/types';

export interface Settings {
  showGrid: boolean;
  snapToGrid: boolean;
  snapToObjects: boolean;
  gridSize: number;
  theme: 'system' | 'light' | 'dark';
}

export interface ContextMenuState {
  /** client (screen) position */
  x: number;
  y: number;
  /** world position, for "add here" actions */
  world: Point;
  onElement: boolean;
}

export interface View {
  /** screen = world * zoom + (x, y) */
  x: number;
  y: number;
  zoom: number;
}

export interface AppState {
  doc: DiagramDoc;
  pageId: string;
  selection: string[];
  tool: Tool;
  view: View;
  viewport: { w: number; h: number };
  settings: Settings;
  editingId: string | null;
  spaceHeld: boolean;
  past: DiagramDoc[];
  future: DiagramDoc[];
  dirty: boolean;
  /** name of the file the doc was last opened from / saved to */
  fileName: string | null;
  toast: string | null;
  contextMenu: ContextMenuState | null;
}

const HISTORY_LIMIT = 200;

export const DEFAULT_SETTINGS: Settings = { showGrid: true, snapToGrid: true, snapToObjects: true, gridSize: 20, theme: 'system' };

function initialState(): AppState {
  const doc = newDoc();
  return {
    doc,
    pageId: doc.pages[0].id,
    selection: [],
    tool: 'select',
    view: { x: 0, y: 0, zoom: 1 },
    viewport: { w: 800, h: 600 },
    settings: { ...DEFAULT_SETTINGS },
    editingId: null,
    spaceHeld: false,
    past: [],
    future: [],
    dirty: false,
    fileName: null,
    toast: null,
    contextMenu: null,
  };
}

let state: AppState = initialState();
const listeners = new Set<() => void>();

export function getState(): AppState {
  return state;
}

export function setState(patch: Partial<AppState> | ((s: AppState) => Partial<AppState>)) {
  const p = typeof patch === 'function' ? patch(state) : patch;
  state = { ...state, ...p };
  listeners.forEach((l) => l());
}

export function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Selector must return a stable reference or primitive. */
export function useApp<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

export function resetStore(next?: Partial<AppState>) {
  state = { ...initialState(), ...next };
  listeners.forEach((l) => l());
}

// ---------------------------------------------------------------------------
// Selectors

export function currentPage(s: AppState = state): Page {
  return s.doc.pages.find((p) => p.id === s.pageId) ?? s.doc.pages[0];
}

const lookupCache = new WeakMap<DiagramElement[], ShapeLookup>();
export function shapeLookup(els: DiagramElement[]): ShapeLookup {
  let m = lookupCache.get(els);
  if (!m) {
    m = new Map();
    for (const e of els) if (e.kind === 'shape') m.set(e.id, e);
    lookupCache.set(els, m);
  }
  return m;
}

export function elementBounds(e: DiagramElement, shapes: ShapeLookup): Rect {
  if (e.kind === 'shape') {
    const b = shapeBounds(e);
    if (e.text && (e.type === 'icon' || e.type === 'image')) {
      return { x: b.x - 30, y: b.y, w: b.w + 60, h: b.h + e.style.fontSize * 1.6 };
    }
    return b;
  }
  return boundsOfPoints(routeBoundsPoints(computeRoute(e, shapes)));
}

export function contentBounds(els: DiagramElement[]): Rect | null {
  const shapes = shapeLookup(els);
  return unionRects(els.map((e) => elementBounds(e, shapes)));
}

export function selectedElements(s: AppState = state): DiagramElement[] {
  const set = new Set(s.selection);
  return currentPage(s).elements.filter((e) => set.has(e.id));
}

// ---------------------------------------------------------------------------
// History

let coalesce: { key: string; at: number } | null = null;

/**
 * Replace the document, recording an undo step.
 * Calls with the same `coalesceKey` within a short window merge into one step
 * (e.g. dragging a color picker).
 */
export function commitDoc(doc: DiagramDoc, opts: { coalesceKey?: string; selection?: string[] } = {}) {
  const now = Date.now();
  const merge = opts.coalesceKey && coalesce && coalesce.key === opts.coalesceKey && now - coalesce.at < 1000;
  coalesce = opts.coalesceKey ? { key: opts.coalesceKey, at: now } : null;
  setState((s) => ({
    doc,
    past: merge ? s.past : [...s.past, s.doc].slice(-HISTORY_LIMIT),
    future: [],
    dirty: true,
    ...(opts.selection ? { selection: opts.selection } : {}),
  }));
}

/** Change the document without recording history (used during drags). */
export function setDocTransient(doc: DiagramDoc) {
  setState({ doc });
}

/** Record `snapshot` as the undo step for transient changes made since. */
export function pushHistory(snapshot: DiagramDoc) {
  if (snapshot === state.doc) return;
  coalesce = null;
  setState((s) => ({ past: [...s.past, snapshot].slice(-HISTORY_LIMIT), future: [], dirty: true }));
}

function afterDocSwap(s: AppState, doc: DiagramDoc): Partial<AppState> {
  const pageId = doc.pages.some((p) => p.id === s.pageId) ? s.pageId : doc.pages[0].id;
  const page = doc.pages.find((p) => p.id === pageId)!;
  const ids = new Set(page.elements.map((e) => e.id));
  return { doc, pageId, selection: s.selection.filter((id) => ids.has(id)), editingId: null, dirty: true };
}

export function undo() {
  const s = state;
  if (!s.past.length) return;
  coalesce = null;
  const doc = s.past[s.past.length - 1];
  setState({ ...afterDocSwap(s, doc), past: s.past.slice(0, -1), future: [s.doc, ...s.future] });
}

export function redo() {
  const s = state;
  if (!s.future.length) return;
  coalesce = null;
  const doc = s.future[0];
  setState({ ...afterDocSwap(s, doc), past: [...s.past, s.doc], future: s.future.slice(1) });
}

// ---------------------------------------------------------------------------
// Document helpers

export function withElements(doc: DiagramDoc, pageId: string, fn: (els: DiagramElement[]) => DiagramElement[]): DiagramDoc {
  return {
    ...doc,
    pages: doc.pages.map((p) => (p.id === pageId ? { ...p, elements: fn(p.elements) } : p)),
  };
}

export function editElements(fn: (els: DiagramElement[]) => DiagramElement[], opts?: Parameters<typeof commitDoc>[1]) {
  const s = state;
  const doc = withElements(s.doc, s.pageId, fn);
  commitDoc(doc, opts);
}

export function mapElements(ids: Iterable<string>, fn: (e: DiagramElement) => DiagramElement, coalesceKey?: string) {
  const set = new Set(ids);
  editElements((els) => els.map((e) => (set.has(e.id) ? fn(e) : e)), { coalesceKey });
}

export function makeShape(type: ShapeType, center: Point, size?: { w: number; h: number }): Shape {
  const def = SHAPES[type];
  const w = size?.w ?? def.defaultSize.w;
  const h = size?.h ?? def.defaultSize.h;
  return {
    kind: 'shape',
    id: newId('s'),
    type,
    x: Math.round(center.x - w / 2),
    y: Math.round(center.y - h / 2),
    w,
    h,
    rotation: 0,
    text: '',
    style: { ...defaultShapeStyle(), ...def.style },
  };
}

export function makeConnector(from: Endpoint, to: Endpoint, style?: Partial<ConnectorStyle>): Connector {
  return { kind: 'connector', id: newId('c'), from, to, label: '', style: { ...defaultConnectorStyle(), ...style } };
}

/** Containers go behind everything else so they can hold other shapes. */
const isBackdrop = (e: DiagramElement) => e.kind === 'shape' && e.type === 'container';

export function addElements(els: DiagramElement[], select = true) {
  const back = els.filter(isBackdrop);
  const front = els.filter((e) => !isBackdrop(e));
  editElements((cur) => [...back, ...cur, ...front], { selection: select ? els.map((e) => e.id) : undefined });
}

export function addShapeAt(type: ShapeType, center: Point, extra?: { icon?: IconData; image?: ImageData; size?: { w: number; h: number } }) {
  const s = makeShape(type, center, extra?.size);
  if (extra?.icon) s.icon = extra.icon;
  if (extra?.image) s.image = extra.image;
  addElements([s]);
  setState({ tool: 'select' });
  return s;
}

export function viewCenter(s: AppState = state): Point {
  return { x: (s.viewport.w / 2 - s.view.x) / s.view.zoom, y: (s.viewport.h / 2 - s.view.y) / s.view.zoom };
}

/** Center for a newly added shape: view center, nudged so repeated adds don't stack exactly. */
export function freeSpotNearCenter(): Point {
  const c = viewCenter();
  const els = currentPage().elements;
  let p = { ...c };
  for (let i = 0; i < 30; i++) {
    const taken = els.some((e) => e.kind === 'shape' && Math.abs(e.x + e.w / 2 - p.x) < 4 && Math.abs(e.y + e.h / 2 - p.y) < 4);
    if (!taken) break;
    p = { x: p.x + 20, y: p.y + 20 };
  }
  return p;
}

export function deleteSelection() {
  const s = state;
  if (!s.selection.length) return;
  const page = currentPage(s);
  const del = new Set(selectedElements(s).filter((e) => !e.locked).map((e) => e.id));
  if (!del.size) {
    toast('Locked items can’t be deleted. Unlock them first.');
    return;
  }
  const shapes = shapeLookup(page.elements);
  editElements(
    (els) =>
      els
        .filter((e) => !del.has(e.id))
        .map((e) => {
          if (e.kind !== 'connector') return e;
          // keep connectors whose shapes were removed, as free lines
          const r = computeRoute(e, shapes);
          let next = e;
          if (e.from.shapeId && del.has(e.from.shapeId)) next = { ...next, from: { x: r.start.x, y: r.start.y } };
          if (e.to.shapeId && del.has(e.to.shapeId)) next = { ...next, to: { x: r.end.x, y: r.end.y } };
          return next;
        }),
    { selection: s.selection.filter((id) => !del.has(id)) },
  );
}

export function selectAll() {
  setState({ selection: currentPage().elements.map((e) => e.id), editingId: null });
}

export function updateShapeStyle(ids: string[], patch: Partial<ShapeStyle>, key?: string) {
  mapElements(ids, (e) => (e.kind === 'shape' ? { ...e, style: { ...e.style, ...patch } } : e), key);
}

export function updateConnectorStyle(ids: string[], patch: Partial<ConnectorStyle>, key?: string) {
  mapElements(
    ids,
    (e) => {
      if (e.kind !== 'connector') return e;
      const next = { ...e, style: { ...e.style, ...patch } };
      // bend points don't carry over between routing styles
      if (patch.routing && patch.routing !== e.style.routing) delete next.waypoints;
      return next;
    },
    key,
  );
}

export function shiftPoints(pts: Point[] | undefined, dx: number, dy: number): Point[] | undefined {
  return pts?.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

/** Drop manual bend points so the line routes itself again. */
export function resetRoute(ids: string[]) {
  mapElements(ids, (e) => {
    if (e.kind !== 'connector' || !e.waypoints || e.locked) return e;
    const { waypoints: _drop, ...rest } = e;
    return rest as Connector;
  });
}

export function updateShapeGeometry(id: string, patch: Partial<Pick<Shape, 'x' | 'y' | 'w' | 'h' | 'rotation'>>) {
  mapElements([id], (e) => (e.kind === 'shape' && !e.locked ? { ...e, ...patch } : e));
}

export function setText(id: string, text: string) {
  const page = currentPage();
  const el = page.elements.find((e) => e.id === id);
  if (!el) return;
  const old = el.kind === 'shape' ? el.text : el.label;
  if (el.kind === 'shape' && el.type === 'text' && !text.trim()) {
    // an empty text box is removed
    editElements((els) => els.filter((e) => e.id !== id), { selection: [] });
    return;
  }
  if (old === text) return;
  mapElements([id], (e) => (e.kind === 'shape' ? { ...e, text } : { ...e, label: text }));
}

export function nudgeSelection(dx: number, dy: number) {
  const ids = new Set(state.selection);
  if (!ids.size) return;
  editElements(
    (els) =>
      els.map((e) => {
        if (!ids.has(e.id) || e.locked) return e;
        if (e.kind === 'shape') return { ...e, x: e.x + dx, y: e.y + dy };
        const mv = (ep: Endpoint): Endpoint => (ep.shapeId ? ep : { ...ep, x: ep.x + dx, y: ep.y + dy });
        return { ...e, from: mv(e.from), to: mv(e.to), waypoints: shiftPoints(e.waypoints, dx, dy) };
      }),
    { coalesceKey: 'nudge' },
  );
}

// ---------------------------------------------------------------------------
// Style clipboard (format painter)

let styleClipboard: { shape?: ShapeStyle; connector?: ConnectorStyle } = {};

export function copyStyle(): boolean {
  const sel = selectedElements();
  const shape = sel.find((e): e is Shape => e.kind === 'shape');
  const conn = sel.find((e): e is Connector => e.kind === 'connector');
  if (!shape && !conn) return false;
  styleClipboard = { shape: shape ? { ...shape.style } : styleClipboard.shape, connector: conn ? { ...conn.style } : styleClipboard.connector };
  toast('Style copied. Select other items and press Ctrl+Alt+V to apply it.');
  return true;
}

export function hasStyleClipboard() {
  return !!(styleClipboard.shape || styleClipboard.connector);
}

export function pasteStyle() {
  const ids = state.selection;
  if (!ids.length || !hasStyleClipboard()) return;
  const { shape, connector } = styleClipboard;
  mapElements(ids, (e) => {
    if (e.kind === 'shape' && shape) return { ...e, style: { ...shape } };
    if (e.kind === 'connector' && connector) {
      // keep this line's routing so its bend points stay valid
      return { ...e, style: { ...connector, routing: e.style.routing } };
    }
    return e;
  });
}

// ---------------------------------------------------------------------------
// Groups and locks

/** Add every member of any group touched by `ids`. */
export function expandToGroups(ids: string[], els: DiagramElement[] = currentPage().elements): string[] {
  const set = new Set(ids);
  const groups = new Set<string>();
  for (const e of els) if (set.has(e.id) && e.groupId) groups.add(e.groupId);
  if (!groups.size) return ids;
  for (const e of els) if (e.groupId && groups.has(e.groupId)) set.add(e.id);
  return els.filter((e) => set.has(e.id)).map((e) => e.id);
}

/** True when `ids` is exactly the members of one group. */
export function isWholeGroup(ids: string[], els: DiagramElement[] = currentPage().elements): boolean {
  if (ids.length < 2) return false;
  const set = new Set(ids);
  const sel = els.filter((e) => set.has(e.id));
  const g = sel[0]?.groupId;
  return !!g && sel.every((e) => e.groupId === g) && els.filter((e) => e.groupId === g).length === ids.length;
}

export function groupSelection() {
  const sel = selectedElements();
  if (sel.length < 2) return;
  const gid = newId('g');
  mapElements(sel.map((e) => e.id), (e) => ({ ...e, groupId: gid }));
  toast(`Grouped ${sel.length} items`);
}

export function ungroupSelection() {
  const sel = selectedElements().filter((e) => e.groupId);
  if (!sel.length) return;
  mapElements(sel.map((e) => e.id), (e) => {
    const { groupId: _drop, ...rest } = e;
    return rest as DiagramElement;
  });
  toast('Ungrouped');
}

export function toggleLockSelection() {
  const sel = selectedElements();
  if (!sel.length) return;
  const lock = !sel.every((e) => e.locked);
  mapElements(sel.map((e) => e.id), (e) => {
    if (lock) return { ...e, locked: true };
    const { locked: _drop, ...rest } = e;
    return rest as DiagramElement;
  });
  toast(lock ? 'Locked. Select it and press Ctrl+Shift+L to unlock.' : 'Unlocked');
}

// ---------------------------------------------------------------------------
// Z-order, align, distribute

export function reorder(mode: 'front' | 'back' | 'forward' | 'backward') {
  const ids = new Set(state.selection);
  if (!ids.size) return;
  editElements((els) => {
    const sel = els.filter((e) => ids.has(e.id));
    const rest = els.filter((e) => !ids.has(e.id));
    if (mode === 'front') return [...rest, ...sel];
    if (mode === 'back') return [...sel, ...rest];
    const out = els.slice();
    if (mode === 'forward') {
      for (let i = out.length - 2; i >= 0; i--) {
        if (ids.has(out[i].id) && !ids.has(out[i + 1].id)) [out[i], out[i + 1]] = [out[i + 1], out[i]];
      }
    } else {
      for (let i = 1; i < out.length; i++) {
        if (ids.has(out[i].id) && !ids.has(out[i - 1].id)) [out[i], out[i - 1]] = [out[i - 1], out[i]];
      }
    }
    return out;
  });
}

export type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom';

interface Unit {
  ids: string[];
  b: Rect;
  locked: boolean;
}

/** Selected shapes, with each group treated as one unit. */
function selectionUnits(): Unit[] {
  const shapes = selectedElements().filter((e): e is Shape => e.kind === 'shape');
  const map = new Map<string, Shape[]>();
  for (const sh of shapes) {
    const key = sh.groupId ?? sh.id;
    map.set(key, [...(map.get(key) ?? []), sh]);
  }
  return [...map.values()].map((list) => ({
    ids: list.map((x) => x.id),
    b: unionRects(list.map(shapeBounds))!,
    locked: list.some((x) => x.locked),
  }));
}

export function alignSelection(mode: AlignMode) {
  const units = selectionUnits();
  if (units.length < 2) return;
  const bb = unionRects(units.map((u) => u.b))!;
  const moves = new Map<string, Point>();
  for (const u of units) {
    if (u.locked) continue;
    const b = u.b;
    let dx = 0, dy = 0;
    if (mode === 'left') dx = bb.x - b.x;
    if (mode === 'right') dx = bb.x + bb.w - (b.x + b.w);
    if (mode === 'hcenter') dx = bb.x + bb.w / 2 - (b.x + b.w / 2);
    if (mode === 'top') dy = bb.y - b.y;
    if (mode === 'bottom') dy = bb.y + bb.h - (b.y + b.h);
    if (mode === 'vcenter') dy = bb.y + bb.h / 2 - (b.y + b.h / 2);
    for (const id of u.ids) moves.set(id, { x: dx, y: dy });
  }
  applyMoves(moves);
}

export function distributeSelection(axis: 'h' | 'v') {
  const items = selectionUnits();
  if (items.length < 3) return;
  items.sort((a, b) => (axis === 'h' ? a.b.x - b.b.x : a.b.y - b.b.y));
  const first = items[0].b, last = items[items.length - 1].b;
  const span = axis === 'h' ? last.x + last.w - first.x : last.y + last.h - first.y;
  const total = items.reduce((t, i) => t + (axis === 'h' ? i.b.w : i.b.h), 0);
  const gap = (span - total) / (items.length - 1);
  let cursor = axis === 'h' ? first.x : first.y;
  const moves = new Map<string, Point>();
  for (const i of items) {
    const cur = axis === 'h' ? i.b.x : i.b.y;
    const m = axis === 'h' ? { x: cursor - cur, y: 0 } : { x: 0, y: cursor - cur };
    if (!i.locked) for (const id of i.ids) moves.set(id, m);
    cursor += (axis === 'h' ? i.b.w : i.b.h) + gap;
  }
  applyMoves(moves);
}

function applyMoves(moves: Map<string, Point>) {
  editElements((els) =>
    els.map((e) => {
      const m = moves.get(e.id);
      return m && e.kind === 'shape' ? { ...e, x: Math.round(e.x + m.x), y: Math.round(e.y + m.y) } : e;
    }),
  );
}

// ---------------------------------------------------------------------------
// Clipboard

let clipboard: DiagramElement[] = [];
let pasteCount = 0;

/** Copy selection. Connector ends glued to shapes outside the copy become free points. */
export function copySelection(): boolean {
  const page = currentPage();
  const sel = selectedElements();
  if (!sel.length) return false;
  const ids = new Set(sel.map((e) => e.id));
  const shapes = shapeLookup(page.elements);
  clipboard = sel.map((e) => {
    if (e.kind !== 'connector') return e;
    const r = computeRoute(e, shapes);
    const fix = (ep: Endpoint, p: Point): Endpoint => (ep.shapeId && !ids.has(ep.shapeId) ? { x: p.x, y: p.y } : ep);
    return { ...e, from: fix(e.from, r.start), to: fix(e.to, r.end) };
  });
  pasteCount = 0;
  return true;
}

export function cutSelection() {
  if (copySelection()) deleteSelection();
}

export function hasClipboard() {
  return clipboard.length > 0;
}

export function cloneElements(els: DiagramElement[], offset: number): DiagramElement[] {
  const map = new Map<string, string>();
  for (const e of els) map.set(e.id, newId(e.kind === 'shape' ? 's' : 'c'));
  const groups = new Map<string, string>();
  const gid = (g?: string) => {
    if (!g) return undefined;
    if (!groups.has(g)) groups.set(g, newId('g'));
    return groups.get(g);
  };
  const ep = (p: Endpoint): Endpoint =>
    p.shapeId && map.has(p.shapeId)
      ? { ...p, shapeId: map.get(p.shapeId) }
      : p.shapeId
        ? p
        : { ...p, x: p.x + offset, y: p.y + offset };
  return els.map((e) =>
    e.kind === 'shape'
      ? { ...e, id: map.get(e.id)!, groupId: gid(e.groupId), x: e.x + offset, y: e.y + offset }
      : { ...e, id: map.get(e.id)!, groupId: gid(e.groupId), from: ep(e.from), to: ep(e.to), waypoints: shiftPoints(e.waypoints, offset, offset) },
  );
}

export function paste() {
  if (!clipboard.length) return;
  pasteCount++;
  const els = cloneElements(clipboard, 20 * pasteCount);
  addElements(els);
}

export function duplicateSelection() {
  const sel = selectedElements();
  if (!sel.length) return;
  if (!copySelection()) return;
  paste();
}

// ---------------------------------------------------------------------------
// Pages

export function addPage() {
  const s = state;
  const page = newPage(`Page ${s.doc.pages.length + 1}`);
  commitDoc({ ...s.doc, pages: [...s.doc.pages, page] });
  setState({ pageId: page.id, selection: [], editingId: null });
}

export function duplicatePage(id: string) {
  const s = state;
  const src = s.doc.pages.find((p) => p.id === id);
  if (!src) return;
  const page: Page = { id: newId('p'), name: `${src.name} copy`, elements: cloneElements(src.elements, 0) };
  const idx = s.doc.pages.indexOf(src);
  const pages = [...s.doc.pages];
  pages.splice(idx + 1, 0, page);
  commitDoc({ ...s.doc, pages });
  setState({ pageId: page.id, selection: [] });
}

export function renamePage(id: string, name: string) {
  const s = state;
  commitDoc({ ...s.doc, pages: s.doc.pages.map((p) => (p.id === id ? { ...p, name } : p)) });
}

export function deletePage(id: string) {
  const s = state;
  if (s.doc.pages.length < 2) return;
  const pages = s.doc.pages.filter((p) => p.id !== id);
  commitDoc({ ...s.doc, pages });
  if (s.pageId === id) setState({ pageId: pages[0].id, selection: [] });
}

export function switchPage(id: string) {
  setState({ pageId: id, selection: [], editingId: null });
}

// ---------------------------------------------------------------------------
// View

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 4;

export function zoomAt(screen: Point, zoom: number) {
  const v = state.view;
  const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
  const wx = (screen.x - v.x) / v.zoom;
  const wy = (screen.y - v.y) / v.zoom;
  setState({ view: { zoom: z, x: screen.x - wx * z, y: screen.y - wy * z } });
}

export function zoomBy(factor: number) {
  const s = state;
  zoomAt({ x: s.viewport.w / 2, y: s.viewport.h / 2 }, s.view.zoom * factor);
}

export function zoomTo(z: number) {
  const s = state;
  zoomAt({ x: s.viewport.w / 2, y: s.viewport.h / 2 }, z);
}

export function fitToContent(maxZoom = 1) {
  const s = state;
  const bb = contentBounds(currentPage(s).elements);
  const { w, h } = s.viewport;
  if (!bb) {
    setState({ view: { x: w / 2, y: h / 2, zoom: 1 } });
    return;
  }
  const pad = 60;
  const zoom = Math.max(MIN_ZOOM, Math.min(maxZoom, (w - pad * 2) / Math.max(bb.w, 1), (h - pad * 2) / Math.max(bb.h, 1)));
  setState({ view: { zoom, x: w / 2 - (bb.x + bb.w / 2) * zoom, y: h / 2 - (bb.y + bb.h / 2) * zoom } });
}

export function loadDocument(doc: DiagramDoc, fileName: string | null) {
  setState({
    doc,
    pageId: doc.pages[0].id,
    selection: [],
    editingId: null,
    past: [],
    future: [],
    dirty: false,
    fileName,
  });
  fitToContent();
}

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  setState({ toast: msg });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => setState({ toast: null }), 2600);
}
