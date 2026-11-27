import {
  alignSelection, currentPage, deleteSelection, distributeSelection, duplicateSelection, groupSelection, reorder, setState,
  toggleLockSelection, ungroupSelection,
  updateConnectorStyle, updateShapeGeometry, updateShapeStyle, useApp, commitDoc, getState, resetRoute,
} from '../store';
import { FONTS } from '../model/defaults';
import { SHAPES } from '../model/shapes';
import type { ArrowHead, Connector, Dash, Routing, Shape } from '../model/types';
import { ColorField, IconButton, NumberField, Segmented, SelectField } from './ui';

const DASHES: { value: Dash; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
];

const ARROWS: { value: ArrowHead; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'arrow', label: 'Arrow' },
  { value: 'open', label: 'Open arrow' },
  { value: 'diamond', label: 'Diamond' },
  { value: 'circle', label: 'Circle' },
];

const ROUTINGS: { value: Routing; label: string }[] = [
  { value: 'orthogonal', label: 'Elbow' },
  { value: 'straight', label: 'Straight' },
  { value: 'curved', label: 'Curved' },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="insp-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function ShapeSection({ shapes }: { shapes: Shape[] }) {
  const ids = shapes.map((s) => s.id);
  const s0 = shapes[0];
  const st = s0.style;
  const set = (patch: Partial<Shape['style']>, live?: boolean) => updateShapeStyle(ids, patch, live ? `style:${Object.keys(patch).join()}:${ids.join()}` : undefined);
  const allMedia = shapes.every((s) => s.type === 'icon' || s.type === 'image');
  const anyIcon = shapes.some((s) => s.type === 'icon');
  const single = shapes.length === 1 ? s0 : null;
  return (
    <>
      {single && (
        <Section title={SHAPES[single.type].label + (single.locked ? ' (locked)' : '')}>
          <div className={`grid-2${single.locked ? ' disabled' : ''}`}>
            <NumberField label="X" value={single.x} onCommit={(v) => updateShapeGeometry(single.id, { x: v })} />
            <NumberField label="Y" value={single.y} onCommit={(v) => updateShapeGeometry(single.id, { y: v })} />
            <NumberField label="W" value={single.w} min={10} onCommit={(v) => updateShapeGeometry(single.id, { w: v })} />
            <NumberField label="H" value={single.h} min={10} onCommit={(v) => updateShapeGeometry(single.id, { h: v })} />
            <NumberField label="Rotate" value={single.rotation} suffix="°" onCommit={(v) => updateShapeGeometry(single.id, { rotation: ((v % 360) + 360) % 360 })} />
          </div>
        </Section>
      )}
      <Section title={allMedia ? 'Appearance' : 'Fill & line'}>
        <ColorField label={allMedia ? 'Background' : 'Fill'} value={st.fill} allowNone onChange={(v, live) => set({ fill: v }, live)} />
        {anyIcon && allMedia ? (
          <ColorField label="Icon color" value={st.stroke} onChange={(v, live) => set({ stroke: v }, live)} />
        ) : (
          <>
            <ColorField label="Line" value={st.stroke} allowNone onChange={(v, live) => set({ stroke: v }, live)} />
            <div className="grid-2">
              <NumberField label="Width" value={st.strokeWidth} min={0} max={20} step={0.5} onCommit={(v) => set({ strokeWidth: v })} />
              <SelectField label="Style" value={st.dash} options={DASHES} onChange={(v) => set({ dash: v })} />
            </div>
          </>
        )}
        <label className="field">
          <span className="field-label">Opacity</span>
          <input type="range" min={0.1} max={1} step={0.05} value={st.opacity} onChange={(e) => set({ opacity: Number(e.target.value) }, true)} />
        </label>
        {anyIcon && shapes.some((s) => s.type === 'icon' && s.icon && !s.icon.mono) && (
          <p className="muted small">Multicolor logos keep their own colors.</p>
        )}
      </Section>
      <Section title="Text">
        <SelectField label="Font" value={st.fontFamily} options={FONTS.map((f) => ({ value: f.value, label: f.label }))} onChange={(v) => set({ fontFamily: v })} />
        <div className="grid-2">
          <NumberField label="Size" value={st.fontSize} min={6} max={200} onCommit={(v) => set({ fontSize: v })} />
          <ColorField label="Color" value={st.textColor} onChange={(v, live) => set({ textColor: v }, live)} />
        </div>
        <div className="row">
          <div className="segmented">
            <button type="button" className={st.bold ? 'active' : ''} title="Bold (Ctrl+B)" onClick={() => set({ bold: !st.bold })}><b>B</b></button>
            <button type="button" className={st.italic ? 'active' : ''} title="Italic (Ctrl+I)" onClick={() => set({ italic: !st.italic })}><i>I</i></button>
            <button type="button" className={st.underline ? 'active' : ''} title="Underline (Ctrl+U)" onClick={() => set({ underline: !st.underline })}><u>U</u></button>
          </div>
          <Segmented value={st.align} onChange={(v) => set({ align: v })} options={[
            { value: 'left', icon: 'tLeft', label: 'Align left' },
            { value: 'center', icon: 'tCenter', label: 'Align center' },
            { value: 'right', icon: 'tRight', label: 'Align right' },
          ]} />
        </div>
        {!allMedia && (
          <Segmented value={st.vAlign} onChange={(v) => set({ vAlign: v })} options={[
            { value: 'top', label: 'Top' },
            { value: 'middle', label: 'Middle' },
            { value: 'bottom', label: 'Bottom' },
          ]} />
        )}
      </Section>
    </>
  );
}

function ConnectorSection({ conns }: { conns: Connector[] }) {
  const ids = conns.map((c) => c.id);
  const st = conns[0].style;
  const set = (patch: Partial<Connector['style']>, live?: boolean) => updateConnectorStyle(ids, patch, live ? `cstyle:${Object.keys(patch).join()}:${ids.join()}` : undefined);
  return (
    <Section title={conns.length > 1 ? `${conns.length} lines` : 'Line'}>
      <Segmented value={st.routing} onChange={(v) => set({ routing: v })} options={ROUTINGS} />
      <ColorField label="Color" value={st.stroke} onChange={(v, live) => set({ stroke: v }, live)} />
      <div className="grid-2">
        <NumberField label="Width" value={st.strokeWidth} min={0.5} max={20} step={0.5} onCommit={(v) => set({ strokeWidth: v })} />
        <SelectField label="Style" value={st.dash} options={DASHES} onChange={(v) => set({ dash: v })} />
        <SelectField label="Start" value={st.startArrow} options={ARROWS} onChange={(v) => set({ startArrow: v })} />
        <SelectField label="End" value={st.endArrow} options={ARROWS} onChange={(v) => set({ endArrow: v })} />
      </div>
      <div className="grid-2">
        <NumberField label="Label size" value={st.fontSize} min={6} max={120} onCommit={(v) => set({ fontSize: v })} />
        <ColorField label="Label color" value={st.textColor} onChange={(v, live) => set({ textColor: v }, live)} />
      </div>
      {conns.some((c) => c.waypoints?.length) && (
        <button type="button" className="wide-btn" onClick={() => resetRoute(ids)}>Reset to automatic route</button>
      )}
      <p className="muted small">
        Double-click a line to add a label. Drag its end dots to reconnect.
        {st.routing === 'orthogonal' ? ' Drag a middle segment grip to reroute it.' : ' Drag the small circles to add bend points; double-click a bend point to remove it.'}
      </p>
    </Section>
  );
}

function ArrangeSection({ count, shapeCount, grouped, locked }: { count: number; shapeCount: number; grouped: boolean; locked: boolean }) {
  return (
    <Section title="Arrange">
      <div className="row wrap">
        {count >= 2 && <IconButton icon="group" title="Group (Ctrl+G)" onClick={groupSelection} />}
        {grouped && <IconButton icon="ungroup" title="Ungroup (Ctrl+Shift+G)" onClick={ungroupSelection} />}
        <IconButton icon={locked ? 'unlock' : 'lock'} title={locked ? 'Unlock (Ctrl+Shift+L)' : 'Lock position and size (Ctrl+Shift+L)'} active={locked} onClick={toggleLockSelection} />
      </div>
      <div className="row wrap">
        <IconButton icon="front" title="Bring to front (Ctrl+Shift+])" onClick={() => reorder('front')} />
        <IconButton icon="back" title="Send to back (Ctrl+Shift+[)" onClick={() => reorder('back')} />
        <IconButton icon="copy" title="Duplicate (Ctrl+D)" onClick={duplicateSelection} />
        <IconButton icon="trash" title="Delete (Del)" onClick={deleteSelection} />
      </div>
      {shapeCount >= 2 && (
        <div className="row wrap">
          <IconButton icon="alignLeft" title="Align left" onClick={() => alignSelection('left')} />
          <IconButton icon="alignHCenter" title="Align centers horizontally" onClick={() => alignSelection('hcenter')} />
          <IconButton icon="alignRight" title="Align right" onClick={() => alignSelection('right')} />
          <IconButton icon="alignTop" title="Align top" onClick={() => alignSelection('top')} />
          <IconButton icon="alignVCenter" title="Align middles vertically" onClick={() => alignSelection('vcenter')} />
          <IconButton icon="alignBottom" title="Align bottom" onClick={() => alignSelection('bottom')} />
          {shapeCount >= 3 && (
            <>
              <IconButton icon="distH" title="Distribute horizontally" onClick={() => distributeSelection('h')} />
              <IconButton icon="distV" title="Distribute vertically" onClick={() => distributeSelection('v')} />
            </>
          )}
        </div>
      )}
      <p className="muted small">{count} selected{locked ? ' · locked' : ''}</p>
    </Section>
  );
}

function PageSection() {
  const background = useApp((s) => s.doc.background);
  const settings = useApp((s) => s.settings);
  const setSettings = (p: Partial<typeof settings>) => setState((s) => ({ settings: { ...s.settings, ...p } }));
  return (
    <>
      <Section title="Document">
        <ColorField label="Background" value={background} allowNone onChange={(v, live) => commitDoc({ ...getState().doc, background: v === 'none' ? 'transparent' : v }, { coalesceKey: live ? 'bg' : undefined })} />
      </Section>
      <Section title="Grid & snapping">
        <label className="check"><input type="checkbox" checked={settings.showGrid} onChange={(e) => setSettings({ showGrid: e.target.checked })} /> Show grid</label>
        <label className="check"><input type="checkbox" checked={settings.snapToGrid} onChange={(e) => setSettings({ snapToGrid: e.target.checked })} /> Snap to grid</label>
        <label className="check"><input type="checkbox" checked={settings.snapToObjects} onChange={(e) => setSettings({ snapToObjects: e.target.checked })} /> Smart guides (snap to shapes)</label>
        <SelectField label="Grid size" value={String(settings.gridSize)} options={['5', '10', '20', '40'].map((v) => ({ value: v, label: `${v} px` }))} onChange={(v) => setSettings({ gridSize: Number(v) })} />
        <p className="muted small">Hold Alt while dragging to move freely.</p>
      </Section>
    </>
  );
}

export function Inspector() {
  const selection = useApp((s) => s.selection);
  const page = useApp((s) => currentPage(s));
  const set = new Set(selection);
  const shapes = page.elements.filter((e): e is Shape => e.kind === 'shape' && set.has(e.id));
  const conns = page.elements.filter((e): e is Connector => e.kind === 'connector' && set.has(e.id));
  return (
    <aside className="sidebar right">
      <div className="panel-scroll">
        {!selection.length && <PageSection />}
        {shapes.length > 0 && <ShapeSection shapes={shapes} />}
        {conns.length > 0 && <ConnectorSection conns={conns} />}
        {selection.length > 0 && (
          <ArrangeSection
            count={selection.length}
            shapeCount={shapes.length}
            grouped={[...shapes, ...conns].some((e) => e.groupId)}
            locked={[...shapes, ...conns].every((e) => e.locked)}
          />
        )}
      </div>
    </aside>
  );
}

import type React from 'react';
