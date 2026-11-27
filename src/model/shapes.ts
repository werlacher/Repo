import type { Point, Rect, ShapeStyle, ShapeType } from './types';

export interface ShapeDef {
  label: string;
  defaultSize: { w: number; h: number };
  /** Polygon (local coords, 0..w x 0..h) used for hit geometry and connector glue. */
  outline: (w: number, h: number) => Point[];
  /** SVG path of the filled body. Defaults to the outline polygon. */
  path?: (w: number, h: number) => string;
  /** Extra stroke-only decoration (e.g. the lid of a cylinder). */
  extra?: (w: number, h: number) => string;
  /** Area text is laid out in. Defaults to the full box. */
  textBox?: (w: number, h: number) => Rect;
  style?: Partial<ShapeStyle>;
}

export function polyPath(pts: Point[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${r(p.x)} ${r(p.y)}`).join(' ') + ' Z';
}

function r(n: number) {
  return Math.round(n * 100) / 100;
}

function rectPts(w: number, h: number): Point[] {
  return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }];
}

function arcPts(cx: number, cy: number, rx: number, ry: number, a0: number, a1: number, n: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    pts.push({ x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
  }
  return pts;
}

const PI = Math.PI;

export const SHAPES: Record<ShapeType, ShapeDef> = {
  rectangle: { label: 'Rectangle', defaultSize: { w: 140, h: 80 }, outline: rectPts },
  rounded: {
    label: 'Rounded rectangle',
    defaultSize: { w: 140, h: 80 },
    outline: rectPts,
    path: (w, h) => {
      const k = Math.min(12, w / 2, h / 2);
      return `M${k} 0 H${w - k} A${k} ${k} 0 0 1 ${w} ${k} V${h - k} A${k} ${k} 0 0 1 ${w - k} ${h} H${k} A${k} ${k} 0 0 1 0 ${h - k} V${k} A${k} ${k} 0 0 1 ${k} 0 Z`;
    },
  },
  ellipse: {
    label: 'Ellipse',
    defaultSize: { w: 120, h: 80 },
    outline: (w, h) => arcPts(w / 2, h / 2, w / 2, h / 2, 0, 2 * PI, 64).slice(0, -1),
    path: (w, h) => `M0 ${h / 2} A${w / 2} ${h / 2} 0 1 1 ${w} ${h / 2} A${w / 2} ${h / 2} 0 1 1 0 ${h / 2} Z`,
    textBox: (w, h) => ({ x: w * 0.15, y: h * 0.15, w: w * 0.7, h: h * 0.7 }),
  },
  diamond: {
    label: 'Diamond',
    defaultSize: { w: 120, h: 100 },
    outline: (w, h) => [{ x: w / 2, y: 0 }, { x: w, y: h / 2 }, { x: w / 2, y: h }, { x: 0, y: h / 2 }],
    textBox: (w, h) => ({ x: w * 0.12, y: h * 0.2, w: w * 0.76, h: h * 0.6 }),
  },
  triangle: {
    label: 'Triangle',
    defaultSize: { w: 110, h: 100 },
    outline: (w, h) => [{ x: w / 2, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
    textBox: (w, h) => ({ x: w * 0.2, y: h * 0.4, w: w * 0.6, h: h * 0.6 }),
  },
  parallelogram: {
    label: 'Data (I/O)',
    defaultSize: { w: 150, h: 80 },
    outline: (w, h) => {
      const o = Math.min(w * 0.2, h * 0.5);
      return [{ x: o, y: 0 }, { x: w, y: 0 }, { x: w - o, y: h }, { x: 0, y: h }];
    },
    textBox: (w, h) => {
      const o = Math.min(w * 0.2, h * 0.5);
      return { x: o, y: 0, w: w - 2 * o, h };
    },
  },
  trapezoid: {
    label: 'Manual operation',
    defaultSize: { w: 150, h: 80 },
    outline: (w, h) => {
      const o = Math.min(w * 0.18, h * 0.5);
      return [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w - o, y: h }, { x: o, y: h }];
    },
    textBox: (w, h) => {
      const o = Math.min(w * 0.18, h * 0.5);
      return { x: o, y: 0, w: w - 2 * o, h };
    },
  },
  hexagon: {
    label: 'Preparation',
    defaultSize: { w: 150, h: 80 },
    outline: (w, h) => {
      const o = Math.min(w * 0.2, h * 0.5);
      return [
        { x: o, y: 0 }, { x: w - o, y: 0 }, { x: w, y: h / 2 },
        { x: w - o, y: h }, { x: o, y: h }, { x: 0, y: h / 2 },
      ];
    },
    textBox: (w, h) => {
      const o = Math.min(w * 0.2, h * 0.5);
      return { x: o, y: 0, w: w - 2 * o, h };
    },
  },
  terminator: {
    label: 'Terminator',
    defaultSize: { w: 140, h: 60 },
    outline: (w, h) => {
      const k = Math.min(w / 2, h / 2);
      return [
        ...arcPts(w - k, h / 2, k, h / 2, -PI / 2, PI / 2, 16),
        ...arcPts(k, h / 2, k, h / 2, PI / 2, (3 * PI) / 2, 16),
      ];
    },
    path: (w, h) => {
      const k = Math.min(w / 2, h / 2);
      return `M${k} 0 H${w - k} A${k} ${h / 2} 0 0 1 ${w - k} ${h} H${k} A${k} ${h / 2} 0 0 1 ${k} 0 Z`;
    },
    textBox: (w, h) => {
      const k = Math.min(w / 2, h / 2) * 0.5;
      return { x: k, y: 0, w: w - 2 * k, h };
    },
  },
  cylinder: {
    label: 'Database',
    defaultSize: { w: 100, h: 110 },
    outline: (w, h) => {
      const ry = cylRy(w, h);
      return [
        ...arcPts(w / 2, ry, w / 2, ry, PI, 2 * PI, 16),
        ...arcPts(w / 2, h - ry, w / 2, ry, 0, PI, 16),
      ];
    },
    path: (w, h) => {
      const ry = cylRy(w, h);
      return `M0 ${ry} A${w / 2} ${ry} 0 0 1 ${w} ${ry} V${h - ry} A${w / 2} ${ry} 0 0 1 0 ${h - ry} Z`;
    },
    extra: (w, h) => {
      const ry = cylRy(w, h);
      return `M0 ${ry} A${w / 2} ${ry} 0 0 0 ${w} ${ry}`;
    },
    textBox: (w, h) => {
      const ry = cylRy(w, h);
      return { x: 0, y: ry * 2, w, h: h - ry * 3 };
    },
  },
  document: {
    label: 'Document',
    defaultSize: { w: 140, h: 90 },
    outline: (w, h) => {
      const a = h * 0.08;
      return [
        { x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h - a },
        { x: w * 0.75, y: h - 2 * a }, { x: w * 0.5, y: h - a },
        { x: w * 0.25, y: h }, { x: 0, y: h - a },
      ];
    },
    path: (w, h) => {
      const a = h * 0.08;
      return `M0 0 H${w} V${h - a} Q${w * 0.75} ${h - 3 * a} ${w * 0.5} ${h - a} T0 ${h - a} Z`;
    },
    textBox: (w, h) => ({ x: 0, y: 0, w, h: h * 0.88 }),
  },
  predefined: {
    label: 'Predefined process',
    defaultSize: { w: 150, h: 80 },
    outline: rectPts,
    extra: (w, h) => {
      const i = Math.min(w * 0.1, 14);
      return `M${i} 0 V${h} M${w - i} 0 V${h}`;
    },
    textBox: (w, h) => {
      const i = Math.min(w * 0.1, 14);
      return { x: i, y: 0, w: w - 2 * i, h };
    },
  },
  manualInput: {
    label: 'Manual input',
    defaultSize: { w: 140, h: 80 },
    outline: (w, h) => [{ x: 0, y: h * 0.3 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
    textBox: (w, h) => ({ x: 0, y: h * 0.25, w, h: h * 0.75 }),
  },
  delay: {
    label: 'Delay',
    defaultSize: { w: 130, h: 80 },
    outline: (w, h) => {
      const k = Math.min(w / 2, h / 2);
      return [{ x: 0, y: 0 }, ...arcPts(w - k, h / 2, k, h / 2, -PI / 2, PI / 2, 16), { x: 0, y: h }];
    },
    path: (w, h) => {
      const k = Math.min(w / 2, h / 2);
      return `M0 0 H${w - k} A${k} ${h / 2} 0 0 1 ${w - k} ${h} H0 Z`;
    },
  },
  note: {
    label: 'Sticky note',
    defaultSize: { w: 150, h: 130 },
    outline: (w, h) => {
      const f = noteFold(w, h);
      return [{ x: 0, y: 0 }, { x: w - f, y: 0 }, { x: w, y: f }, { x: w, y: h }, { x: 0, y: h }];
    },
    extra: (w, h) => {
      const f = noteFold(w, h);
      return `M${w - f} 0 V${f} H${w}`;
    },
    style: { fill: '#fef3c7', stroke: '#d97706', align: 'left', vAlign: 'top' },
  },
  star: {
    label: 'Star',
    defaultSize: { w: 110, h: 105 },
    outline: (w, h) => {
      const pts: Point[] = [];
      for (let i = 0; i < 10; i++) {
        const a = -PI / 2 + (i * PI) / 5;
        const k = i % 2 ? 0.42 : 1;
        pts.push({ x: w / 2 + (w / 2) * k * Math.cos(a), y: h * 0.53 + h * 0.53 * k * Math.sin(a) });
      }
      return pts;
    },
    textBox: (w, h) => ({ x: w * 0.25, y: h * 0.3, w: w * 0.5, h: h * 0.5 }),
  },
  text: {
    label: 'Text',
    defaultSize: { w: 160, h: 40 },
    outline: rectPts,
    style: { fill: 'none', stroke: 'none', fontSize: 16 },
  },
  icon: {
    label: 'Icon',
    defaultSize: { w: 64, h: 64 },
    outline: rectPts,
    // label sits under the icon
    textBox: (w, h) => ({ x: -40, y: h + 2, w: w + 80, h: 0 }),
    style: { fill: 'none', stroke: '#334155', strokeWidth: 1, fontSize: 12, vAlign: 'top' },
  },
  image: {
    label: 'Image',
    defaultSize: { w: 120, h: 120 },
    outline: rectPts,
    textBox: (w, h) => ({ x: -40, y: h + 2, w: w + 80, h: 0 }),
    style: { fill: 'none', stroke: 'none', strokeWidth: 1, fontSize: 12, vAlign: 'top' },
  },
};

/** Shapes whose stroke color is used as the icon color rather than an outline. */
export const isMediaShape = (t: ShapeType) => t === 'icon' || t === 'image';

function cylRy(w: number, h: number) {
  return Math.min(h * 0.15, w * 0.25, 16);
}

function noteFold(w: number, h: number) {
  return Math.min(18, w / 4, h / 4);
}

export function shapePath(type: ShapeType, w: number, h: number): string {
  const def = SHAPES[type];
  return def.path ? def.path(w, h) : polyPath(def.outline(w, h));
}

export interface LibraryItem {
  type: ShapeType;
  label: string;
}

export const LIBRARY: { name: string; items: LibraryItem[] }[] = [
  {
    name: 'Basic',
    items: [
      { type: 'rectangle', label: 'Rectangle' },
      { type: 'rounded', label: 'Rounded' },
      { type: 'ellipse', label: 'Ellipse' },
      { type: 'diamond', label: 'Diamond' },
      { type: 'triangle', label: 'Triangle' },
      { type: 'hexagon', label: 'Hexagon' },
      { type: 'star', label: 'Star' },
      { type: 'text', label: 'Text' },
      { type: 'note', label: 'Sticky note' },
    ],
  },
  {
    name: 'Flowchart',
    items: [
      { type: 'rectangle', label: 'Process' },
      { type: 'diamond', label: 'Decision' },
      { type: 'terminator', label: 'Terminator' },
      { type: 'parallelogram', label: 'Data (I/O)' },
      { type: 'document', label: 'Document' },
      { type: 'cylinder', label: 'Database' },
      { type: 'predefined', label: 'Predefined process' },
      { type: 'manualInput', label: 'Manual input' },
      { type: 'trapezoid', label: 'Manual operation' },
      { type: 'hexagon', label: 'Preparation' },
      { type: 'delay', label: 'Delay' },
    ],
  },
];
