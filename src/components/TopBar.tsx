import { useEffect, useRef, useState } from 'react';
import { getState, redo, setState, undo, useApp, loadDocument } from '../store';
import { newDoc } from '../model/defaults';
import { exportPng, exportSvg, forgetFileHandle, importImageFiles, openFile, pickFiles, saveFile, writeAutosave } from '../lib/io';
import { Icon, IconButton } from './ui';
import type { Tool } from '../model/types';

function Menu({ label, icon, items }: { label: string; icon?: string; items: ({ label: string; hint?: string; onClick: () => void } | 'sep')[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    window.addEventListener('pointerdown', close);
    return () => window.removeEventListener('pointerdown', close);
  }, [open]);
  return (
    <div className="menu" ref={ref}>
      <button type="button" className={`menu-btn${open ? ' open' : ''}`} onClick={() => setOpen((o) => !o)}>
        {icon && <Icon name={icon} size={16} />}
        {label}
      </button>
      {open && (
        <div className="popover menu-list">
          {items.map((it, i) =>
            it === 'sep' ? (
              <div key={i} className="menu-sep" />
            ) : (
              <button type="button" key={i} onClick={() => { setOpen(false); it.onClick(); }}>
                <span>{it.label}</span>
                {it.hint && <kbd>{it.hint}</kbd>}
              </button>
            ),
          )}
        </div>
      )}
    </div>
  );
}

export function newDiagram() {
  const s = getState();
  if (s.dirty && !confirm('Start a new diagram? Unsaved changes to the current one will be lost (export or save first if you need them).')) return;
  forgetFileHandle();
  loadDocument(newDoc(), null);
  writeAutosave();
}

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';

const TOOLS: { tool: Tool; icon: string; title: string }[] = [
  { tool: 'select', icon: 'select', title: 'Select (V)' },
  { tool: 'hand', icon: 'hand', title: 'Pan (H, or hold Space)' },
  { tool: 'text', icon: 'text', title: 'Text (T)' },
  { tool: 'connector', icon: 'connector', title: 'Line / connector (L)' },
];

export function TopBar({ onHelp }: { onHelp: () => void }) {
  const title = useApp((s) => s.doc.title);
  const dirty = useApp((s) => s.dirty);
  const fileName = useApp((s) => s.fileName);
  const canUndo = useApp((s) => s.past.length > 0);
  const canRedo = useApp((s) => s.future.length > 0);
  const tool = useApp((s) => s.tool);
  const settings = useApp((s) => s.settings);
  const hasSelection = useApp((s) => s.selection.length > 0);

  return (
    <header className="topbar">
      <div className="brand" title="Flowboard">
        <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden>
          <rect x="2" y="4" width="12" height="10" rx="2" fill="#0d9488" />
          <rect x="18" y="18" width="12" height="10" rx="2" fill="#f59e0b" />
          <path d="M8 14v9h10" stroke="#334155" strokeWidth="2" fill="none" />
        </svg>
      </div>
      <div className="title-block">
        <input
          className="doc-title"
          value={title}
          onChange={(e) => setState((s) => ({ doc: { ...s.doc, title: e.target.value }, dirty: true }))}
          spellCheck={false}
          aria-label="Diagram title"
        />
        <span className="file-status">{fileName ?? 'Not saved to a file yet'}{dirty ? ' · edited' : ''}</span>
      </div>
      <nav className="menus">
        <Menu
          label="File"
          items={[
            { label: 'New diagram', onClick: newDiagram },
            { label: 'Open…', hint: `${mod}O`, onClick: openFile },
            'sep',
            { label: 'Save', hint: `${mod}S`, onClick: () => saveFile(false) },
            { label: 'Save as…', hint: `${mod}⇧S`, onClick: () => saveFile(true) },
            'sep',
            { label: 'Import image or SVG…', onClick: async () => importImageFiles(await pickFiles('image/*,.svg')) },
          ]}
        />
        <Menu
          label="Export"
          items={[
            { label: 'PNG image', onClick: () => exportPng(false) },
            { label: 'PNG, transparent background', onClick: () => exportPng(true) },
            { label: 'SVG vector', onClick: () => exportSvg() },
            ...(hasSelection ? (['sep', { label: 'Selection as PNG', onClick: () => exportPng(false, 2, true) }, { label: 'Selection as SVG', onClick: () => exportSvg(true) }] as const) : []),
          ]}
        />
      </nav>
      <div className="toolbar-group">
        <IconButton icon="undo" title={`Undo (${mod}Z)`} onClick={undo} disabled={!canUndo} />
        <IconButton icon="redo" title={`Redo (${mod}⇧Z)`} onClick={redo} disabled={!canRedo} />
      </div>
      <div className="toolbar-group">
        {TOOLS.map((t) => (
          <IconButton key={t.tool} icon={t.icon} title={t.title} active={tool === t.tool} onClick={() => setState({ tool: t.tool })} />
        ))}
      </div>
      <div className="toolbar-group">
        <IconButton icon="grid" title="Show grid" active={settings.showGrid} onClick={() => setState((s) => ({ settings: { ...s.settings, showGrid: !s.settings.showGrid } }))} />
        <IconButton icon="magnet" title="Snap to grid" active={settings.snapToGrid} onClick={() => setState((s) => ({ settings: { ...s.settings, snapToGrid: !s.settings.snapToGrid } }))} />
      </div>
      <div className="spacer" />
      <IconButton
        icon={settings.theme === 'dark' ? 'moon' : settings.theme === 'light' ? 'sun' : 'monitor'}
        title={`Theme: ${settings.theme === 'system' ? 'follow system' : settings.theme} (click to change)`}
        onClick={() => setState((s) => ({
          settings: { ...s.settings, theme: s.settings.theme === 'system' ? 'light' : s.settings.theme === 'light' ? 'dark' : 'system' },
        }))}
      />
      <IconButton icon="help" title="Keyboard shortcuts (?)" onClick={onHelp} />
      <button type="button" className="primary-btn" onClick={() => saveFile(false)} title={`Save (${mod}S)`}>
        <Icon name="save" size={16} /> Save
      </button>
    </header>
  );
}
