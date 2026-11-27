import { memo } from 'react';
import { SHAPES, shapePath } from '../model/shapes';
import type { Dash, Shape } from '../model/types';
import { fontString, wrapText } from '../lib/textLayout';

export function dashArray(dash: Dash, w: number): string | undefined {
  if (dash === 'dashed') return `${w * 4} ${w * 3}`;
  if (dash === 'dotted') return `${w} ${w * 2}`;
  return undefined;
}

interface Props {
  shape: Shape;
  interactive?: boolean;
  hideText?: boolean;
}

export const ShapeView = memo(function ShapeView({ shape, interactive, hideText }: Props) {
  const { w, h, style: st } = shape;
  const transform = `translate(${shape.x} ${shape.y})${shape.rotation ? ` rotate(${shape.rotation} ${w / 2} ${h / 2})` : ''}`;
  const def = SHAPES[shape.type];
  const roleProps = interactive ? { 'data-role': 'shape', 'data-id': shape.id } : {};

  let body;
  if (shape.type === 'icon' && shape.icon) {
    const ic = shape.icon;
    const color = st.stroke === 'none' ? '#334155' : st.stroke;
    body = (
      <>
        {interactive && <rect width={w} height={h} fill="transparent" pointerEvents="all" />}
        {st.fill !== 'none' && <rect width={w} height={h} rx={6} fill={st.fill} />}
        <svg
          width={w}
          height={h}
          viewBox={`${ic.vbX} ${ic.vbY} ${ic.vbW} ${ic.vbH}`}
          color={color}
          style={{ color }}
          overflow="visible"
          pointerEvents="none"
          dangerouslySetInnerHTML={{ __html: ic.body }}
        />
      </>
    );
  } else if (shape.type === 'image' && shape.image) {
    body = (
      <>
        {st.fill !== 'none' && <rect width={w} height={h} fill={st.fill} />}
        <image href={shape.image.href} width={w} height={h} preserveAspectRatio="xMidYMid meet" pointerEvents={interactive ? 'all' : 'none'} />
        {st.stroke !== 'none' && <rect width={w} height={h} fill="none" stroke={st.stroke} strokeWidth={st.strokeWidth} />}
      </>
    );
  } else {
    const extra = def.extra?.(w, h);
    const dash = dashArray(st.dash, st.strokeWidth);
    body = (
      <>
        <path
          d={shapePath(shape.type, w, h)}
          fill={st.fill}
          stroke={st.stroke}
          strokeWidth={st.strokeWidth}
          strokeDasharray={dash}
          strokeLinejoin="round"
          pointerEvents={interactive ? 'all' : undefined}
        />
        {extra && (
          <path d={extra} fill="none" stroke={st.stroke} strokeWidth={st.strokeWidth} strokeDasharray={dash} />
        )}
      </>
    );
  }

  return (
    <g transform={transform} opacity={st.opacity < 1 ? st.opacity : undefined} {...roleProps}>
      {body}
      {!hideText && shape.text && <ShapeText shape={shape} />}
    </g>
  );
});

const PAD = 6;

function ShapeText({ shape }: { shape: Shape }) {
  const { w, h, style: st } = shape;
  const tb = SHAPES[shape.type].textBox?.(w, h) ?? { x: 0, y: 0, w, h };
  const font = fontString(st.fontSize, st.fontFamily, st.bold, st.italic);
  const lines = wrapText(shape.text, tb.w - PAD * 2, font);
  const lh = st.fontSize * 1.25;
  const total = lines.length * lh;
  let top: number;
  if (st.vAlign === 'top') top = tb.y + PAD;
  else if (st.vAlign === 'bottom') top = tb.y + tb.h - PAD - total;
  else top = tb.y + (tb.h - total) / 2;
  const x = st.align === 'left' ? tb.x + PAD : st.align === 'right' ? tb.x + tb.w - PAD : tb.x + tb.w / 2;
  const anchor = st.align === 'left' ? 'start' : st.align === 'right' ? 'end' : 'middle';
  return (
    <text
      fill={st.textColor}
      fontFamily={st.fontFamily}
      fontSize={st.fontSize}
      fontWeight={st.bold ? 'bold' : undefined}
      fontStyle={st.italic ? 'italic' : undefined}
      textDecoration={st.underline ? 'underline' : undefined}
      textAnchor={anchor}
      pointerEvents="none"
      style={{ userSelect: 'none', whiteSpace: 'pre' }}
    >
      {lines.map((ln, i) => (
        <tspan key={i} x={x} y={top + i * lh + lh / 2} dominantBaseline="central">
          {ln || ' '}
        </tspan>
      ))}
    </text>
  );
}
