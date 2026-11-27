export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type ShapeType =
  | 'rectangle'
  | 'rounded'
  | 'ellipse'
  | 'diamond'
  | 'triangle'
  | 'parallelogram'
  | 'trapezoid'
  | 'hexagon'
  | 'terminator'
  | 'cylinder'
  | 'document'
  | 'predefined'
  | 'manualInput'
  | 'delay'
  | 'note'
  | 'star'
  | 'text'
  | 'icon'
  | 'image';

export type TextAlign = 'left' | 'center' | 'right';
export type VAlign = 'top' | 'middle' | 'bottom';
export type Dash = 'solid' | 'dashed' | 'dotted';

export interface ShapeStyle {
  /** CSS color or 'none' */
  fill: string;
  /** CSS color or 'none' */
  stroke: string;
  strokeWidth: number;
  dash: Dash;
  opacity: number;
  fontFamily: string;
  fontSize: number;
  textColor: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: TextAlign;
  vAlign: VAlign;
}

export interface Shape {
  kind: 'shape';
  id: string;
  type: ShapeType;
  x: number;
  y: number;
  w: number;
  h: number;
  /** degrees, clockwise, around the shape center */
  rotation: number;
  text: string;
  style: ShapeStyle;
  /** For type 'icon': an inline SVG icon (from a bundled icon set). */
  icon?: IconData;
  /** For type 'image': an imported picture or SVG, stored as a data URL. */
  image?: ImageData;
}

export interface IconData {
  /** Iconify-style id, e.g. "lucide:house" */
  id: string;
  /** Inner SVG markup */
  body: string;
  vbX: number;
  vbY: number;
  vbW: number;
  vbH: number;
  /** true when the icon uses currentColor and can be recolored */
  mono: boolean;
}

export interface ImageData {
  href: string;
  name: string;
}

export type Side = 'top' | 'right' | 'bottom' | 'left';

/**
 * A connector end. When `shapeId` points at an existing shape the end is
 * glued to it (at a fixed side, or 'auto' = whichever side faces the other
 * end). Otherwise the end is a free point at (x, y).
 */
export interface Endpoint {
  shapeId?: string;
  anchor?: Side | 'auto';
  x: number;
  y: number;
}

export type ArrowHead = 'none' | 'arrow' | 'open' | 'diamond' | 'circle';
export type Routing = 'straight' | 'orthogonal' | 'curved';

export interface ConnectorStyle {
  stroke: string;
  strokeWidth: number;
  dash: Dash;
  startArrow: ArrowHead;
  endArrow: ArrowHead;
  routing: Routing;
  fontFamily: string;
  fontSize: number;
  textColor: string;
}

export interface Connector {
  kind: 'connector';
  id: string;
  from: Endpoint;
  to: Endpoint;
  label: string;
  style: ConnectorStyle;
}

export type DiagramElement = Shape | Connector;

export interface Page {
  id: string;
  name: string;
  /** Paint order: later elements are drawn on top. */
  elements: DiagramElement[];
}

export interface DiagramDoc {
  app: 'flowboard';
  version: 1;
  title: string;
  background: string;
  pages: Page[];
}

export type Tool = 'select' | 'hand' | 'connector' | 'text' | ShapeType;
