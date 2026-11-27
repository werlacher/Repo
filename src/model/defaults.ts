import type { ConnectorStyle, DiagramDoc, Page, ShapeStyle } from './types';

export const FONTS: { label: string; value: string }[] = [
  { label: 'Sans', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Mono', value: 'Menlo, Consolas, "Courier New", monospace' },
  { label: 'Rounded', value: '"Trebuchet MS", Verdana, sans-serif' },
  { label: 'Hand', value: '"Comic Sans MS", "Comic Neue", cursive' },
];

export const DEFAULT_FONT = FONTS[0].value;

export const PALETTE = [
  '#ffffff', '#f1f5f9', '#cbd5e1', '#64748b', '#334155', '#0f172a',
  '#fee2e2', '#fecaca', '#ef4444', '#b91c1c',
  '#ffedd5', '#fdba74', '#f97316', '#c2410c',
  '#fef9c3', '#fde047', '#eab308', '#a16207',
  '#dcfce7', '#86efac', '#22c55e', '#15803d',
  '#ccfbf1', '#5eead4', '#14b8a6', '#0f766e',
  '#dbeafe', '#93c5fd', '#3b82f6', '#1d4ed8',
  '#ede9fe', '#c4b5fd', '#8b5cf6', '#6d28d9',
  '#fce7f3', '#f9a8d4', '#ec4899', '#be185d',
];

export function defaultShapeStyle(): ShapeStyle {
  return {
    fill: '#ffffff',
    stroke: '#334155',
    strokeWidth: 1.5,
    dash: 'solid',
    opacity: 1,
    fontFamily: DEFAULT_FONT,
    fontSize: 14,
    textColor: '#1e293b',
    bold: false,
    italic: false,
    underline: false,
    align: 'center',
    vAlign: 'middle',
  };
}

export function defaultConnectorStyle(): ConnectorStyle {
  return {
    stroke: '#334155',
    strokeWidth: 1.5,
    dash: 'solid',
    startArrow: 'none',
    endArrow: 'arrow',
    routing: 'orthogonal',
    fontFamily: DEFAULT_FONT,
    fontSize: 12,
    textColor: '#1e293b',
  };
}

let counter = 0;
export function newId(prefix = 'e'): string {
  counter = (counter + 1) % 1e6;
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}${counter.toString(36)}`;
}

export function newPage(name = 'Page 1'): Page {
  return { id: newId('p'), name, elements: [] };
}

export function newDoc(title = 'Untitled diagram'): DiagramDoc {
  return { app: 'flowboard', version: 1, title, background: '#ffffff', pages: [newPage()] };
}
