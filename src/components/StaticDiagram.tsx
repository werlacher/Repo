import { shapeLookup } from '../store';
import type { DiagramElement, Rect } from '../model/types';
import { ShapeView } from './ShapeView';
import { ConnectorView } from './ConnectorView';

/** Non-interactive rendering used for SVG/PNG export. */
export function StaticDiagram({ elements, allElements, rect, background }: {
  elements: DiagramElement[];
  allElements: DiagramElement[];
  rect: Rect;
  background: string;
}) {
  const shapes = shapeLookup(allElements);
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={Math.ceil(rect.w)}
      height={Math.ceil(rect.h)}
      viewBox={`${rect.x} ${rect.y} ${rect.w} ${rect.h}`}
    >
      {background !== 'transparent' && <rect x={rect.x} y={rect.y} width={rect.w} height={rect.h} fill={background} />}
      {elements.map((el) =>
        el.kind === 'shape' ? (
          <ShapeView key={el.id} shape={el} />
        ) : (
          <ConnectorView key={el.id} conn={el} shapes={shapes} labelBackground={background === 'transparent' ? '#ffffff' : background} />
        ),
      )}
    </svg>
  );
}
