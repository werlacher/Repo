import { useEffect, useState } from 'react';
import {
  copySelection, currentPage, cutSelection, deleteSelection, duplicateSelection, fitToContent, getState, groupSelection, hasClipboard,
  toggleLockSelection, ungroupSelection,
  nudgeSelection, paste, redo, reorder, selectAll, setState, subscribe, undo, updateShapeStyle, useApp, zoomBy, zoomTo,
} from './store';
import { importImageFiles, openFile, saveFile, writeAutosave, writeSettings } from './lib/io';
import { TopBar } from './components/TopBar';
import { Sidebar } from './components/Sidebar';
import { Canvas } from './components/Canvas';
import { Inspector } from './components/Inspector';
import { BottomBar } from './components/BottomBar';
import { HelpDialog } from './components/HelpDialog';
import type { Shape, Tool } from './model/types';

const TOOL_KEYS: Record<string, Tool> = {
  v: 'select', h: 'hand', t: 'text', l: 'connector', c: 'connector', r: 'rectangle', o: 'ellipse', d: 'diamond', n: 'note',
};

function isTyping(t: EventTarget | null) {
  const el = t as HTMLElement | null;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
}

function toggleStyle(key: 'bold' | 'italic' | 'underline') {
  const s = getState();
  const set = new Set(s.selection);
  const shapes = currentPage(s).elements.filter((e): e is Shape => e.kind === 'shape' && set.has(e.id));
  if (!shapes.length) return;
  updateShapeStyle(shapes.map((x) => x.id), { [key]: !shapes[0].style[key] });
}

export function App() {
  const [help, setHelp] = useState(false);
  const toast = useApp((s) => s.toast);

  // Keyboard shortcuts
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();
      const s = getState();
      if (e.key === ' ') {
        if (!s.spaceHeld) setState({ spaceHeld: true });
        e.preventDefault();
        return;
      }
      if (mod) {
        const handled = (() => {
          if (k === 'z' && !e.shiftKey) return undo(), true;
          if ((k === 'z' && e.shiftKey) || k === 'y') return redo(), true;
          if (k === 'c') return copySelection(), true;
          if (k === 'x') return cutSelection(), true;
          if (k === 'v') return hasClipboard() ? (paste(), true) : false; // fall through to system paste (images)
          if (k === 'd') return duplicateSelection(), true;
          if (k === 'g') return (e.shiftKey ? ungroupSelection() : groupSelection()), true;
          if (k === 'l' && e.shiftKey) return toggleLockSelection(), true;
          if (k === 'a') return selectAll(), true;
          if (k === 's') return saveFile(e.shiftKey), true;
          if (k === 'o') return openFile(), true;
          if (k === '0') return zoomTo(1), true;
          if (k === '=' || k === '+') return zoomBy(1.2), true;
          if (k === '-') return zoomBy(1 / 1.2), true;
          if (k === 'b') return toggleStyle('bold'), true;
          if (k === 'i') return toggleStyle('italic'), true;
          if (k === 'u') return toggleStyle('underline'), true;
          if (e.code === 'BracketRight') return reorder(e.shiftKey ? 'front' : 'forward'), true;
          if (e.code === 'BracketLeft') return reorder(e.shiftKey ? 'back' : 'backward'), true;
          return false;
        })();
        if (handled) e.preventDefault();
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelection();
        e.preventDefault();
        return;
      }
      if (e.key === 'Escape') {
        setState({ selection: [], tool: 'select' });
        setHelp(false);
        return;
      }
      if ((e.key === 'Enter' || e.key === 'F2') && s.selection.length === 1 && !currentPage(s).elements.find((x) => x.id === s.selection[0])?.locked) {
        setState({ editingId: s.selection[0] });
        e.preventDefault();
        return;
      }
      if (e.key.startsWith('Arrow') && s.selection.length) {
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        nudgeSelection(dx, dy);
        e.preventDefault();
        return;
      }
      if (e.key === '!' || (e.shiftKey && e.code === 'Digit1')) {
        fitToContent();
        return;
      }
      if (e.key === '?') {
        setHelp((h) => !h);
        return;
      }
      if (!e.altKey && !e.shiftKey && TOOL_KEYS[k]) setState({ tool: TOOL_KEYS[k] });
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === ' ') setState({ spaceHeld: false });
    };
    const blur = () => setState({ spaceHeld: false });
    // Paste images from the system clipboard (e.g. a screenshot)
    const onPaste = (e: ClipboardEvent) => {
      if (isTyping(e.target)) return;
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        importImageFiles(files);
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('paste', onPaste);
    };
  }, []);

  // Autosave the document and settings to this browser (debounced).
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastDoc = getState().doc;
    let lastSettings = getState().settings;
    const unsub = subscribe(() => {
      const s = getState();
      if (s.settings !== lastSettings) {
        lastSettings = s.settings;
        writeSettings(s.settings);
      }
      if (s.doc === lastDoc) return;
      lastDoc = s.doc;
      clearTimeout(timer);
      timer = setTimeout(writeAutosave, 400);
    });
    const beforeUnload = (e: BeforeUnloadEvent) => {
      writeAutosave();
      if (getState().dirty && !getState().fileName) {
        // Work is autosaved in the browser, so this is only a gentle reminder.
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      unsub();
      clearTimeout(timer);
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, []);

  return (
    <div className="app">
      <TopBar onHelp={() => setHelp(true)} />
      <div className="main">
        <Sidebar />
        <div className="center">
          <Canvas />
          <BottomBar />
        </div>
        <Inspector />
      </div>
      {help && <HelpDialog onClose={() => setHelp(false)} />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
