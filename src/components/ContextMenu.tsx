import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  addElements, copySelection, copyStyle, currentPage, cutSelection, deleteSelection, duplicateSelection, fitToContent,
  getState, groupSelection, hasClipboard, hasStyleClipboard, makeShape, paste, pasteStyle, reorder, resetRoute,
  selectAll, setState, toggleLockSelection, ungroupSelection, useApp,
} from '../store';

const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl+';
const alt = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌥' : 'Alt+';

type Item = { label: string; hint?: string; run: () => void; disabled?: boolean } | 'sep';

/** Right-click menu for the canvas. */
export function ContextMenu() {
  const menu = useApp((s) => s.contextMenu);
  const selection = useApp((s) => s.selection);
  const page = useApp((s) => currentPage(s));
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  const close = () => setState({ contextMenu: null });

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && close();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('wheel', close, { passive: true });
    window.addEventListener('blur', close);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('wheel', close);
      window.removeEventListener('blur', close);
    };
  }, [menu]);

  // keep the menu on screen
  useLayoutEffect(() => {
    if (!menu || !ref.current) return setPos(null);
    const r = ref.current.getBoundingClientRect();
    setPos({
      left: Math.min(menu.x, window.innerWidth - r.width - 8),
      top: Math.min(menu.y, window.innerHeight - r.height - 8),
    });
  }, [menu]);

  if (!menu) return null;

  const set = new Set(selection);
  const sel = page.elements.filter((e) => set.has(e.id));
  const one = sel.length === 1 ? sel[0] : null;
  const allLocked = sel.length > 0 && sel.every((e) => e.locked);
  const anyGrouped = sel.some((e) => e.groupId);
  const hasBends = sel.some((e) => e.kind === 'connector' && e.waypoints?.length);

  let items: Item[];
  if (menu.onElement && sel.length) {
    items = [
      ...(one && !one.locked ? [{ label: one.kind === 'shape' ? 'Edit text' : 'Edit label', hint: 'Enter', run: () => setState({ editingId: one.id }) } as Item] : []),
      { label: 'Cut', hint: `${mod}X`, run: cutSelection, disabled: allLocked },
      { label: 'Copy', hint: `${mod}C`, run: () => { copySelection(); } },
      { label: 'Paste', hint: `${mod}V`, run: paste, disabled: !hasClipboard() },
      { label: 'Duplicate', hint: `${mod}D`, run: duplicateSelection },
      { label: 'Delete', hint: 'Del', run: deleteSelection, disabled: allLocked },
      'sep',
      { label: 'Copy style', hint: `${mod}${alt}C`, run: () => { copyStyle(); } },
      { label: 'Paste style', hint: `${mod}${alt}V`, run: pasteStyle, disabled: !hasStyleClipboard() },
      'sep',
      { label: 'Bring to front', hint: `${mod}⇧]`, run: () => reorder('front') },
      { label: 'Bring forward', hint: `${mod}]`, run: () => reorder('forward') },
      { label: 'Send backward', hint: `${mod}[`, run: () => reorder('backward') },
      { label: 'Send to back', hint: `${mod}⇧[`, run: () => reorder('back') },
      'sep',
      ...(sel.length > 1 ? [{ label: 'Group', hint: `${mod}G`, run: groupSelection } as Item] : []),
      ...(anyGrouped ? [{ label: 'Ungroup', hint: `${mod}⇧G`, run: ungroupSelection } as Item] : []),
      { label: allLocked ? 'Unlock' : 'Lock', hint: `${mod}⇧L`, run: toggleLockSelection },
      ...(hasBends ? [{ label: 'Reset line route', run: () => resetRoute(selection) } as Item] : []),
    ];
  } else {
    items = [
      { label: 'Paste', hint: `${mod}V`, run: paste, disabled: !hasClipboard() },
      { label: 'Select all', hint: `${mod}A`, run: selectAll, disabled: !page.elements.length },
      'sep',
      {
        label: 'Add text here',
        run: () => {
          const s = makeShape('text', menu.world);
          addElements([s]);
          setState({ editingId: s.id });
        },
      },
      { label: 'Add rectangle here', run: () => addElements([makeShape('rectangle', menu.world)]) },
      'sep',
      { label: 'Fit diagram to screen', hint: '⇧1', run: () => fitToContent() },
      {
        label: getState().settings.showGrid ? 'Hide grid' : 'Show grid',
        run: () => setState((s) => ({ settings: { ...s.settings, showGrid: !s.settings.showGrid } })),
      },
    ];
  }

  return (
    <div
      ref={ref}
      className="popover menu-list context-menu"
      style={{ left: pos?.left ?? menu.x, top: pos?.top ?? menu.y, visibility: pos ? 'visible' : 'hidden' }}
      role="menu"
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((it, i) =>
        it === 'sep' ? (
          i > 0 && items[i - 1] !== 'sep' ? <div key={i} className="menu-sep" /> : null
        ) : (
          <button
            type="button"
            role="menuitem"
            key={i}
            disabled={it.disabled}
            onClick={() => {
              close();
              it.run();
            }}
          >
            <span>{it.label}</span>
            {it.hint && <kbd>{it.hint}</kbd>}
          </button>
        ),
      )}
    </div>
  );
}
