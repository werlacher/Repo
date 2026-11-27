import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { defaultConnectorStyle, defaultShapeStyle, newId } from '../model/defaults';
import { SHAPES } from '../model/shapes';
import type { DiagramDoc, DiagramElement, IconData, Page, Point, ShapeType } from '../model/types';
import {
  addElements, contentBounds, currentPage, getState, loadDocument, makeShape, setState, toast, type Settings,
} from '../store';
import { StaticDiagram } from '../components/StaticDiagram';

export const LIBRARY_MIME = 'application/x-flowboard-shape';

export interface LibraryDragPayload {
  type: ShapeType;
  icon?: IconData;
}

const AUTOSAVE_KEY = 'flowboard.autosave.v1';
const SETTINGS_KEY = 'flowboard.settings.v1';
const FILE_EXT = '.flowboard.json';

// ---------------------------------------------------------------------------
// (De)serialization

export function serialize(doc: DiagramDoc): string {
  return JSON.stringify(doc, null, 2);
}

/** Parse and normalise a saved diagram. Throws on files that aren't diagrams. */
export function parseDoc(text: string): DiagramDoc {
  const raw = JSON.parse(text);
  if (!raw || typeof raw !== 'object' || raw.app !== 'flowboard' || !Array.isArray(raw.pages)) {
    throw new Error('This file is not a Flowboard diagram.');
  }
  const pages: Page[] = raw.pages.map((p: Partial<Page>, i: number) => ({
    id: typeof p.id === 'string' ? p.id : newId('p'),
    name: typeof p.name === 'string' ? p.name : `Page ${i + 1}`,
    elements: (Array.isArray(p.elements) ? p.elements : []).map(normaliseElement).filter(Boolean) as DiagramElement[],
  }));
  if (!pages.length) throw new Error('The diagram has no pages.');
  return {
    app: 'flowboard',
    version: 1,
    title: typeof raw.title === 'string' ? raw.title : 'Untitled diagram',
    background: typeof raw.background === 'string' ? raw.background : '#ffffff',
    pages,
  };
}

function normaliseElement(e: any): DiagramElement | null {
  if (!e || typeof e !== 'object' || typeof e.id !== 'string') return null;
  if (e.kind === 'shape') {
    if (!(e.type in SHAPES)) return null;
    const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
    return {
      ...e,
      x: num(e.x, 0), y: num(e.y, 0), w: num(e.w, 100), h: num(e.h, 60), rotation: num(e.rotation, 0),
      text: typeof e.text === 'string' ? e.text : '',
      style: { ...defaultShapeStyle(), ...SHAPES[e.type as ShapeType].style, ...e.style },
    };
  }
  if (e.kind === 'connector') {
    const ep = (p: any) => ({ x: 0, y: 0, ...p });
    return { ...e, from: ep(e.from), to: ep(e.to), label: typeof e.label === 'string' ? e.label : '', style: { ...defaultConnectorStyle(), ...e.style } };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Autosave / settings (browser storage on this machine only)

export function loadAutosave(): DiagramDoc | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    const { doc } = JSON.parse(raw);
    return parseDoc(JSON.stringify(doc));
  } catch {
    return null;
  }
}

export function loadAutosaveMeta(): { fileName: string | null } {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    return raw ? { fileName: JSON.parse(raw).fileName ?? null } : { fileName: null };
  } catch {
    return { fileName: null };
  }
}

export function writeAutosave() {
  const s = getState();
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ doc: s.doc, fileName: s.fileName, savedAt: Date.now() }));
  } catch {
    // storage full or blocked; files still work
  }
}

export function loadSettings(): Partial<Settings> {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
  } catch {
    return {};
  }
}

export function writeSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Files

// File System Access API handle (Chromium browsers): lets Save write back to the same file.
let fileHandle: any = null;

const pickerTypes = [{ description: 'Flowboard diagram', accept: { 'application/json': ['.json'] } }];

function fileBaseName(title: string) {
  return (title.trim() || 'diagram').replace(/[\\/:*?"<>|]+/g, '-');
}

export async function openFile() {
  try {
    let text: string;
    let name: string;
    const w = window as any;
    if (w.showOpenFilePicker) {
      const [h] = await w.showOpenFilePicker({ types: pickerTypes, multiple: false });
      const f = await h.getFile();
      text = await f.text();
      name = f.name;
      fileHandle = h;
    } else {
      const f = await pickFile('.json,application/json');
      if (!f) return;
      text = await f.text();
      name = f.name;
      fileHandle = null;
    }
    const doc = parseDoc(text);
    loadDocument(doc, name);
    writeAutosave();
    toast(`Opened ${name}`);
  } catch (err: any) {
    if (err?.name === 'AbortError') return;
    toast(err?.message ?? 'Could not open the file.');
  }
}

export async function saveFile(saveAs = false) {
  const s = getState();
  const text = serialize(s.doc);
  const w = window as any;
  try {
    if (w.showSaveFilePicker) {
      if (!fileHandle || saveAs) {
        fileHandle = await w.showSaveFilePicker({ suggestedName: fileBaseName(s.doc.title) + FILE_EXT, types: pickerTypes });
      }
      const writable = await fileHandle.createWritable();
      await writable.write(text);
      await writable.close();
      setState({ dirty: false, fileName: fileHandle.name });
      toast(`Saved ${fileHandle.name}`);
    } else {
      const name = fileBaseName(s.doc.title) + FILE_EXT;
      downloadBlob(new Blob([text], { type: 'application/json' }), name);
      setState({ dirty: false, fileName: name });
      toast(`Downloaded ${name}`);
    }
    writeAutosave();
  } catch (err: any) {
    if (err?.name === 'AbortError') return;
    toast(err?.message ?? 'Could not save the file.');
  }
}

export function forgetFileHandle() {
  fileHandle = null;
}

function pickFile(accept: string, multiple = false): Promise<File | null> {
  return pickFiles(accept, multiple).then((f) => f[0] ?? null);
}

export function pickFiles(accept: string, multiple = true): Promise<File[]> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    input.onchange = () => resolve(Array.from(input.files ?? []));
    input.click();
  });
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// Export

export function exportSvgString(opts: { transparent?: boolean; selectionOnly?: boolean } = {}): { svg: string; w: number; h: number } | null {
  const s = getState();
  const page = currentPage(s);
  let els = page.elements;
  if (opts.selectionOnly && s.selection.length) {
    const ids = new Set(s.selection);
    els = els.filter((e) => ids.has(e.id));
  }
  const bb = contentBounds(els);
  if (!bb) return null;
  const pad = 24;
  const rect = { x: bb.x - pad, y: bb.y - pad, w: bb.w + pad * 2, h: bb.h + pad * 2 };
  const background = opts.transparent ? 'transparent' : s.doc.background;
  // Shapes outside a selection may still be needed to route its connectors.
  const markup = renderToStaticMarkup(createElement(StaticDiagram, { elements: els, allElements: page.elements, rect, background }));
  return { svg: '<?xml version="1.0" encoding="UTF-8"?>\n' + markup, w: rect.w, h: rect.h };
}

export function exportSvg(selectionOnly = false) {
  const out = exportSvgString({ selectionOnly });
  if (!out) return toast('Nothing to export on this page.');
  downloadBlob(new Blob([out.svg], { type: 'image/svg+xml' }), exportName('svg'));
}

export async function exportPng(transparent = false, scale = 2, selectionOnly = false) {
  const out = exportSvgString({ transparent, selectionOnly });
  if (!out) return toast('Nothing to export on this page.');
  const url = URL.createObjectURL(new Blob([out.svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    img.decoding = 'async';
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('Could not render the diagram.'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = Math.ceil(out.w * scale);
    canvas.height = Math.ceil(out.h * scale);
    const ctx = canvas.getContext('2d')!;
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, out.w, out.h);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'));
    if (!blob) throw new Error('Could not create the PNG.');
    downloadBlob(blob, exportName('png'));
  } catch (err: any) {
    toast(err?.message ?? 'Export failed.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

function exportName(ext: string) {
  const s = getState();
  const page = currentPage(s);
  const multi = s.doc.pages.length > 1 ? ` - ${page.name}` : '';
  return `${fileBaseName(s.doc.title)}${multi}.${ext}`;
}

// ---------------------------------------------------------------------------
// Images

function readAsDataUrl(f: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result));
    r.onerror = () => rej(r.error);
    r.readAsDataURL(f);
  });
}

function imageSize(href: string): Promise<{ w: number; h: number }> {
  return new Promise((res) => {
    const img = new Image();
    img.onload = () => res({ w: img.naturalWidth || 120, h: img.naturalHeight || 120 });
    img.onerror = () => res({ w: 120, h: 120 });
    img.src = href;
  });
}

/** Add image/SVG files to the canvas (e.g. icons from a downloaded cloud icon pack). */
export async function importImageFiles(files: File[], at?: Point) {
  const imgs = files.filter((f) => f.type.startsWith('image/') || /\.svg$/i.test(f.name));
  if (!imgs.length) {
    if (files.some((f) => /\.json$/i.test(f.name))) toast('Use Open to load a diagram file.');
    return;
  }
  const origin = at ?? viewCenterPoint();
  const els = [];
  let i = 0;
  for (const f of imgs) {
    const blob = f.type ? f : new Blob([await f.arrayBuffer()], { type: 'image/svg+xml' });
    const href = await readAsDataUrl(blob);
    const nat = await imageSize(href);
    const k = Math.min(1, 160 / Math.max(nat.w, nat.h));
    const size = { w: Math.max(16, Math.round(nat.w * k)), h: Math.max(16, Math.round(nat.h * k)) };
    const s = makeShape('image', { x: origin.x + i * 30, y: origin.y + i * 30 }, size);
    s.image = { href, name: f.name };
    els.push(s);
    i++;
  }
  addElements(els);
  setState({ tool: 'select' });
}

function viewCenterPoint(): Point {
  const s = getState();
  return { x: (s.viewport.w / 2 - s.view.x) / s.view.zoom, y: (s.viewport.h / 2 - s.view.y) / s.view.zoom };
}
