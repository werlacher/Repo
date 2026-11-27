const mod = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl';

const ROWS: [string, string][] = [
  ['V / H / T / L', 'Select, pan, text, line tools'],
  ['R / O / D / N', 'Rectangle, ellipse, diamond, sticky note (then click or drag on the canvas)'],
  ['Space + drag, middle mouse, scroll', 'Pan'],
  [`${mod} + scroll, pinch`, 'Zoom'],
  [`${mod} 0 / ${mod} = / ${mod} -`, 'Zoom 100% / in / out'],
  ['Shift 1', 'Fit diagram to screen'],
  ['Hover a shape, drag a dot', 'Draw a connected line'],
  ['Double-click', 'Edit text or line label (double-click empty space adds text)'],
  ['Enter / F2', 'Edit text of the selected shape'],
  ['Esc', 'Finish editing, clear selection'],
  ['Shift + click, drag on empty space', 'Multi-select'],
  ['Arrows (Shift = 10px)', 'Nudge'],
  ['Shift while resizing / rotating', 'Keep proportions / rotate in 15° steps'],
  ['Alt while dragging', 'Move without snapping'],
  [`${mod} Z / ${mod} Shift Z`, 'Undo / redo'],
  [`${mod} C / X / V / D`, 'Copy, cut, paste, duplicate'],
  [`${mod} A`, 'Select all'],
  [`${mod} G / ${mod} Shift G`, 'Group / ungroup (click a group again to pick one item)'],
  [`${mod} Shift L`, 'Lock / unlock position and size'],
  ['Corner handles on a multi-selection', 'Resize everything together (Shift keeps proportions)'],
  [`${mod} ] / [ (add Shift)`, 'Bring forward / send backward (to front / back)'],
  [`${mod} B / I / U`, 'Bold, italic, underline'],
  [`${mod} S / ${mod} Shift S / ${mod} O`, 'Save, save as, open'],
  ['Delete / Backspace', 'Delete selection'],
];

export function HelpDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" onPointerDown={onClose}>
      <div className="modal" onPointerDown={(e) => e.stopPropagation()} role="dialog" aria-label="Keyboard shortcuts">
        <div className="modal-head">
          <h2>Shortcuts</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <table className="shortcuts">
          <tbody>
            {ROWS.map(([k, v]) => (
              <tr key={k}><td><kbd>{k}</kbd></td><td>{v}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="muted small">Everything stays on this computer. Work is autosaved in this browser; use File › Save to keep a .json file you can back up.</p>
      </div>
    </div>
  );
}
