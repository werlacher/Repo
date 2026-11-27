import { memo } from 'react';
import { computeRoute, routePath, type ShapeLookup } from '../model/connectors';
import type { ArrowHead, Connector, Point } from '../model/types';
import { fontString, measure, wrapText } from '../lib/textLayout';
import { dashArray } from './ShapeView';

interface Props {
  conn: Connector;
  shapes: ShapeLookup;
  interactive?: boolean;
  hideLabel?: boolean;
  labelBackground: string;
  zoom?: number;
}

function arrowSize(kind: ArrowHead, sw: number) {
  const L = 8 + sw * 2.5;
  return { L, W: kind === 'diamond' ? L * 0.8 : L * 0.75 };
}

/** How far to pull the line back so it doesn't poke through a head. */
function trimFor(kind: ArrowHead, sw: number) {
  const { L } = arrowSize(kind, sw);
  if (kind === 'arrow') return L * 0.8;
  if (kind === 'diamond') return L * 1.8;
  if (kind === 'circle') return L * 0.8;
  return 0;
}

function arrowHead(kind: ArrowHead, tip: Point, dir: Point, sw: number, color: string, key: string) {
  if (kind === 'none') return null;
  const { L, W } = arrowSize(kind, sw);
  const n = { x: -dir.y, y: dir.x };
  const at = (along: number, side: number) => ({ x: tip.x - dir.x * along + n.x * side, y: tip.y - dir.y * along + n.y * side });
  const f = (p: Point) => `${p.x} ${p.y}`;
  if (kind === 'arrow') {
    return <path key={key} d={`M${f(tip)} L${f(at(L, W / 2))} L${f(at(L, -W / 2))} Z`} fill={color} stroke={color} strokeWidth={sw} strokeLinejoin="round" />;
  }
  if (kind === 'open') {
    return <path key={key} d={`M${f(at(L, W / 2))} L${f(tip)} L${f(at(L, -W / 2))}`} fill="none" stroke={color} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />;
  }
  if (kind === 'diamond') {
    return <path key={key} d={`M${f(tip)} L${f(at(L, W / 2))} L${f(at(L * 2, 0))} L${f(at(L, -W / 2))} Z`} fill={color} stroke={color} strokeWidth={sw} strokeLinejoin="round" />;
  }
  const r = L * 0.4;
  const c = at(r, 0);
  return <circle key={key} cx={c.x} cy={c.y} r={r} fill={color} stroke={color} strokeWidth={sw} />;
}

export const ConnectorView = memo(function ConnectorView({ conn, shapes, interactive, hideLabel, labelBackground, zoom = 1 }: Props) {
  const st = conn.style;
  const r = computeRoute(conn, shapes);
  const d = routePath(r, trimFor(st.startArrow, st.strokeWidth), trimFor(st.endArrow, st.strokeWidth));
  const roleProps = interactive ? { 'data-role': 'connector', 'data-id': conn.id } : {};

  let label = null;
  if (conn.label && !hideLabel) {
    const font = fontString(st.fontSize, st.fontFamily);
    const lines = wrapText(conn.label, 180, font);
    const lh = st.fontSize * 1.25;
    const width = Math.max(...lines.map((l) => measure(l, font))) + 8;
    const height = lines.length * lh + 4;
    label = (
      <g pointerEvents="none">
        <rect x={r.mid.x - width / 2} y={r.mid.y - height / 2} width={width} height={height} rx={3} fill={labelBackground === 'transparent' ? '#ffffff' : labelBackground} />
        <text fill={st.textColor} fontFamily={st.fontFamily} fontSize={st.fontSize} textAnchor="middle" style={{ userSelect: 'none', whiteSpace: 'pre' }}>
          {lines.map((ln, i) => (
            <tspan key={i} x={r.mid.x} y={r.mid.y - height / 2 + 2 + i * lh + lh / 2} dominantBaseline="central">
              {ln || ' '}
            </tspan>
          ))}
        </text>
      </g>
    );
  }

  return (
    <g {...roleProps}>
      {interactive && <path d={routePath(r)} fill="none" stroke="transparent" strokeWidth={14 / zoom} pointerEvents="stroke" />}
      <path
        d={d}
        fill="none"
        stroke={st.stroke}
        strokeWidth={st.strokeWidth}
        strokeDasharray={dashArray(st.dash, st.strokeWidth)}
        strokeLinejoin="round"
        pointerEvents="none"
      />
      {arrowHead(st.startArrow, r.start, r.startDir, st.strokeWidth, st.stroke, 's')}
      {arrowHead(st.endArrow, r.end, r.endDir, st.strokeWidth, st.stroke, 'e')}
      {label}
    </g>
  );
});
