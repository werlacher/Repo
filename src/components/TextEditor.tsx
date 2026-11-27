import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { currentPage, getState, setLaneTitle, setState, setText, shapeLookup, useApp } from '../store';
import { computeRoute } from '../model/connectors';
import { SHAPES, laneGeom } from '../model/shapes';
import { localToWorld } from '../model/geometry';

/** In-place text editing overlay for a shape or connector label. */
export function TextEditor() {
  const editingId = useApp((s) => s.editingId)!;
  const page = useApp((s) => currentPage(s));
  const view = useApp((s) => s.view);
  const el = page.elements.find((e) => e.id === editingId);
  const lane = useApp((s) => (el?.kind === 'shape' && el.lanes && s.editingLane != null && s.editingLane < el.lanes.titles.length ? s.editingLane : null));
  const [value, setValue] = useState(() => (el ? (el.kind === 'shape' ? (lane != null ? el.lanes!.titles[lane] : el.text) : el.label) : ''));
  const ref = useRef<HTMLTextAreaElement>(null);
  const done = useRef(false);

  useEffect(() => {
    // Focus after the click that opened the editor has fully finished.
    const id = requestAnimationFrame(() => {
      const t = ref.current;
      if (!t) return;
      t.focus();
      t.select();
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useLayoutEffect(() => {
    const t = ref.current;
    if (!t) return;
    t.style.height = '0px';
    t.style.height = `${t.scrollHeight}px`;
  }, [value, view.zoom]);

  if (!el) return null;

  const finish = (commit: boolean) => {
    if (done.current) return;
    done.current = true;
    if (commit) {
      if (lane != null) setLaneTitle(editingId, lane, value);
      else setText(editingId, value);
    }
    if (getState().editingId === editingId) setState({ editingId: null });
  };

  const z = view.zoom;
  let style: React.CSSProperties;
  if (el.kind === 'shape') {
    const tb = lane != null ? laneGeom(el).heads[lane] : SHAPES[el.type].textBox?.(el.w, el.h) ?? { x: 0, y: 0, w: el.w, h: el.h };
    const media = el.type === 'icon' || el.type === 'image';
    const center = localToWorld(el, { x: tb.x + tb.w / 2, y: media ? tb.y : tb.y + tb.h / 2 });
    const st = el.style;
    style = {
      left: center.x * z + view.x,
      top: center.y * z + view.y,
      width: Math.max(40, tb.w - 12) * z,
      transform: `translate(-50%, ${media ? '0' : '-50%'}) rotate(${el.rotation}deg)`,
      fontFamily: st.fontFamily,
      fontSize: (lane != null ? Math.max(10, st.fontSize - 2) : st.fontSize) * z,
      fontWeight: st.bold ? 'bold' : undefined,
      fontStyle: st.italic ? 'italic' : undefined,
      textAlign: lane != null ? 'center' : st.align,
      color: st.textColor,
      lineHeight: 1.25,
    };
  } else {
    const r = computeRoute(el, shapeLookup(page.elements));
    style = {
      left: r.mid.x * z + view.x,
      top: r.mid.y * z + view.y,
      width: 180 * z,
      transform: 'translate(-50%, -50%)',
      fontFamily: el.style.fontFamily,
      fontSize: el.style.fontSize * z,
      textAlign: 'center',
      color: el.style.textColor,
      lineHeight: 1.25,
      background: '#ffffff',
    };
  }

  return (
    <textarea
      ref={ref}
      className="text-editor"
      style={style}
      value={value}
      spellCheck={false}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => finish(true)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Escape' || (e.key === 'Enter' && (e.metaKey || e.ctrlKey))) {
          e.preventDefault();
          finish(true);
        }
      }}
    />
  );
}

import type React from 'react';
