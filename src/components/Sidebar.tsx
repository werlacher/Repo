import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { addShapeAt, freeSpotNearCenter, useApp } from '../store';
import { LIBRARY, SHAPES, shapePath } from '../model/shapes';
import type { IconData, ShapeType } from '../model/types';
import { LIBRARY_MIME, importImageFiles, pickFiles, type LibraryDragPayload } from '../lib/io';
import { ICON_SETS, iconNames, loadSet, searchIcons, toIconData, type IconifyJSON } from '../lib/icons';
import { Icon } from './ui';

const SHORTCUT: Partial<Record<ShapeType, string>> = { rectangle: 'R', ellipse: 'O', diamond: 'D', note: 'N' };

function startDrag(e: DragEvent, payload: LibraryDragPayload) {
  e.dataTransfer.setData(LIBRARY_MIME, JSON.stringify(payload));
  e.dataTransfer.effectAllowed = 'copy';
}

function ShapePreview({ type }: { type: ShapeType }) {
  const def = SHAPES[type];
  const k = Math.min(34 / def.defaultSize.w, 26 / def.defaultSize.h);
  const w = def.defaultSize.w * k;
  const h = def.defaultSize.h * k;
  if (type === 'text') {
    return (
      <svg width="40" height="30" viewBox="0 0 40 30"><text x="20" y="20" textAnchor="middle" fontSize="15" fontFamily="Georgia, serif" fill="#334155">Aa</text></svg>
    );
  }
  const extra = def.extra?.(w, h);
  return (
    <svg width="40" height="30" viewBox={`-3 -2 40 30`}>
      <g transform={`translate(${(34 - w) / 2} ${(26 - h) / 2})`}>
        <path d={shapePath(type, w, h)} fill={def.style?.fill ?? '#ffffff'} stroke={def.style?.stroke && def.style.stroke !== 'none' ? def.style.stroke : '#475569'} strokeWidth={1.2} strokeLinejoin="round" />
        {extra && <path d={extra} fill="none" stroke={def.style?.stroke ?? '#475569'} strokeWidth={1.2} />}
      </g>
    </svg>
  );
}

function ShapesPanel() {
  const tool = useApp((s) => s.tool);
  const [filter, setFilter] = useState('');
  const q = filter.trim().toLowerCase();
  return (
    <div className="panel-scroll">
      <div className="search-box">
        <Icon name="search" size={15} />
        <input placeholder="Search shapes" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>
      {LIBRARY.map((cat) => {
        const items = cat.items.filter((i) => !q || i.label.toLowerCase().includes(q));
        if (!items.length) return null;
        return (
          <section key={cat.name} className="lib-section">
            <h3>{cat.name}</h3>
            <div className="shape-grid">
              {items.map((it) => (
                <button
                  type="button"
                  key={cat.name + it.label}
                  className={`shape-tile${tool === it.type ? ' active' : ''}`}
                  title={`${it.label}${SHORTCUT[it.type] ? ` (${SHORTCUT[it.type]})` : ''}. Click to add, or drag onto the canvas`}
                  draggable
                  onDragStart={(e) => startDrag(e, { type: it.type })}
                  onClick={() => addShapeAt(it.type, freeSpotNearCenter())}
                >
                  <ShapePreview type={it.type} />
                  <span>{it.label}</span>
                </button>
              ))}
            </div>
          </section>
        );
      })}
      <section className="lib-section">
        <h3>Your images</h3>
        <button type="button" className="wide-btn" onClick={async () => importImageFiles(await pickFiles('image/*,.svg'))}>
          <Icon name="image" size={16} /> Import image or SVG…
        </button>
        <p className="muted small">Tip: drop PNG/SVG files (for example from the official AWS, Azure or Google Cloud icon packs) straight onto the canvas.</p>
      </section>
    </div>
  );
}

function IconPreview({ icon }: { icon: IconData }) {
  return (
    <svg width="28" height="28" viewBox={`${icon.vbX} ${icon.vbY} ${icon.vbW} ${icon.vbH}`} color="#334155" dangerouslySetInnerHTML={{ __html: icon.body }} />
  );
}

function IconsPanel() {
  const [prefix, setPrefix] = useState(ICON_SETS[0].prefix);
  const [query, setQuery] = useState('');
  const [set, setSet] = useState<IconifyJSON | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setSet(null);
    setError(null);
    loadSet(prefix).then((s) => alive && setSet(s)).catch((e) => alive && setError(String(e?.message ?? e)));
    return () => { alive = false; };
  }, [prefix]);

  const names = useMemo(() => (set ? iconNames(set) : []), [set]);
  const results = useMemo(() => searchIcons(names, query), [names, query]);
  const info = ICON_SETS.find((s) => s.prefix === prefix)!;

  return (
    <div className="panel-scroll">
      <label className="field">
        <span className="field-label">Icon set</span>
        <select value={prefix} onChange={(e) => setPrefix(e.target.value)}>
          {ICON_SETS.map((s) => (
            <option key={s.prefix} value={s.prefix}>{s.name}</option>
          ))}
        </select>
      </label>
      <div className="search-box">
        <Icon name="search" size={15} />
        <input placeholder={`Search ${names.length ? names.length.toLocaleString() + ' ' : ''}icons`} value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
      </div>
      {error && <p className="muted small">Could not load this set: {error}</p>}
      {!set && !error && <p className="muted small">Loading icons…</p>}
      {set && (
        <>
          <div className="icon-grid">
            {results.map((n) => {
              const icon = toIconData(set, n);
              return (
                <button
                  type="button"
                  key={n}
                  className="icon-tile"
                  title={`${n}. Click to add, or drag onto the canvas`}
                  draggable
                  onDragStart={(e) => startDrag(e, { type: 'icon', icon })}
                  onClick={() => addShapeAt('icon', freeSpotNearCenter(), { icon })}
                >
                  <IconPreview icon={icon} />
                </button>
              );
            })}
          </div>
          {results.length === 0 && <p className="muted small">No icons match “{query}”.</p>}
          {results.length >= 240 && <p className="muted small">Showing the first 240 matches. Refine your search to see more.</p>}
        </>
      )}
      <p className="muted small license-note">
        {info.name} · {info.author} · <a href={info.licenseUrl} target="_blank" rel="noreferrer">{info.license} license</a>
      </p>
    </div>
  );
}

export function Sidebar() {
  const [tab, setTab] = useState<'shapes' | 'icons'>('shapes');
  return (
    <aside className="sidebar left">
      <div className="tabs">
        <button type="button" className={tab === 'shapes' ? 'active' : ''} onClick={() => setTab('shapes')}>Shapes</button>
        <button type="button" className={tab === 'icons' ? 'active' : ''} onClick={() => setTab('icons')}>Icons</button>
      </div>
      {tab === 'shapes' ? <ShapesPanel /> : <IconsPanel />}
    </aside>
  );
}
