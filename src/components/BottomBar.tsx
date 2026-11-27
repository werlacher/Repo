import { useState } from 'react';
import { addPage, deletePage, duplicatePage, fitToContent, renamePage, switchPage, useApp, zoomBy, zoomTo } from '../store';
import { IconButton } from './ui';

function PageTab({ id, name, active, canDelete }: { id: string; name: string; active: boolean; canDelete: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  if (editing) {
    return (
      <input
        className="page-tab editing"
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => { setEditing(false); if (value.trim() && value !== name) renamePage(id, value.trim()); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') { setValue(name); setEditing(false); }
        }}
      />
    );
  }
  return (
    <div className={`page-tab${active ? ' active' : ''}`} onClick={() => switchPage(id)} onDoubleClick={() => { setValue(name); setEditing(true); }} title="Double-click to rename">
      <span>{name}</span>
      {active && (
        <span className="page-actions">
          <button type="button" title="Duplicate page" onClick={(e) => { e.stopPropagation(); duplicatePage(id); }}>⧉</button>
          {canDelete && (
            <button type="button" title="Delete page" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete “${name}”? You can undo this.`)) deletePage(id); }}>×</button>
          )}
        </span>
      )}
    </div>
  );
}

export function BottomBar() {
  const pages = useApp((s) => s.doc.pages);
  const pageId = useApp((s) => s.pageId);
  const zoom = useApp((s) => s.view.zoom);
  return (
    <footer className="bottombar">
      <div className="pages">
        {pages.map((p) => (
          <PageTab key={p.id} id={p.id} name={p.name} active={p.id === pageId} canDelete={pages.length > 1} />
        ))}
        <IconButton icon="plus" title="Add page" onClick={addPage} />
      </div>
      <div className="zoom">
        <IconButton icon="minus" title="Zoom out (Ctrl+-)" onClick={() => zoomBy(1 / 1.2)} />
        <button type="button" className="zoom-label" title="Reset to 100% (Ctrl+0)" onClick={() => zoomTo(1)}>{Math.round(zoom * 100)}%</button>
        <IconButton icon="plus" title="Zoom in (Ctrl+=)" onClick={() => zoomBy(1.2)} />
        <IconButton icon="fit" title="Fit to content (Shift+1)" onClick={() => fitToContent()} />
      </div>
    </footer>
  );
}
