<img src="public/logo.svg" width="64" alt="Esquisso logo">

# Esquisso

> Guia de instalação em português: [COMO-INSTALAR.md](COMO-INSTALAR.md)

A personal diagramming app that runs entirely on your own computer: flowcharts,
process maps, architecture sketches and wireframes. No account, no cloud, no
tracking. Diagrams live in files you save, plus an automatic backup in your
browser.

## Run it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install      # once
npm start        # opens http://127.0.0.1:5173 in your browser
```

The server only listens on `127.0.0.1`, so nothing is reachable from other
machines. Stop it with `Ctrl+C`.

**No terminal?** Double-click `start-windows.bat` (Windows) or
`start-mac.command` (macOS; the first time, right-click › Open). It installs
what's needed on first run, starts the app and opens your browser. Keep that
window open while you work.

**Desktop shortcut with the app icon (Windows):** double-click
`create-shortcut.bat` once. It puts an "Esquisso" shortcut on your Desktop that
starts the app, using `esquisso.ico`.

### If the page doesn't open or stays blank

- Use the address the terminal prints, `http://127.0.0.1:5173`. Opening
  `index.html` by double-clicking it (a `file://` address) does not work:
  browsers block the app that way. The page tells you when this happens.
- Keep the terminal window running; closing it stops the app.
- **Windows PowerShell says "running scripts is disabled on this system"**:
  type `npm.cmd install` and `npm.cmd start` instead of `npm …`, or use
  `start-windows.bat`. (Alternatively allow local scripts once with
  `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.)
- Run the commands inside the project folder (`cd` into it first), not in
  your home folder.
- Check the terminal for errors. `node -v` must print v18 or newer.
- Still blank? Press F12, open **Console**, and look for red errors.

To build a static copy you can open without the dev server:

```bash
npm run build    # writes ./dist
npm run preview  # serves ./dist at http://127.0.0.1:4173
```

Chrome, Edge and other Chromium browsers give the best experience: **Save**
writes straight back to the same file. In Firefox and Safari, Save downloads
a `.esquisso.json` file instead.

## What it can do

- **Infinite canvas** with pan (scroll, Space+drag, middle mouse, hand tool),
  zoom (Ctrl/⌘+scroll, pinch, buttons) and fit-to-content.
- **Shapes**: rectangle, rounded, ellipse, diamond, triangle, hexagon, star,
  text, sticky note and the standard flowchart set (process, decision,
  terminator, data, document, database, predefined process, manual input,
  manual operation, preparation, delay), callouts (rectangular, rounded,
  oval, thought bubble), cloud, swimlanes (title band plus named columns or rows; set the lane
  count in the right panel), a titled container (added behind other
  shapes), block arrows, chevron, pentagon, octagon and cross. Click a tile to add it, drag it onto
  the canvas, or pick a tool (R, O, D, N) and click or drag on the canvas.
- **Icons**: a searchable library of about 40,000 free icons, including
  country flags (search a country in English or Portuguese), gears, clouds
  and flags (Lucide, Tabler,
  Material Symbols, Phosphor, Simple Icons brand logos, and SVG Logos with
  AWS/Azure/GCP product logos). Line icons can be recolored.
- **Your own images**: import PNG/JPG/SVG files, drop them on the canvas, or
  paste a screenshot. Good for the official cloud architecture icon packs.
- **Connectors that stick**: hover a shape and drag one of its dots to another
  shape. Lines follow shapes as they move. Choose elbow, straight or curved
  routing, arrowheads at either end (arrow, open, diamond, circle), dashes,
  and a label (double-click the line). Elbow lines automatically route
  around shapes in their way.
- **Bend points**: select an elbow line and drag a middle segment grip to
  reroute it; on straight and curved lines drag the small circles to add bend
  points (double-click one to remove it). "Reset to automatic route" in the
  right panel undoes manual routing.
- **Editing**: select, multi-select (Shift+click or drag a box), move, resize
  (Shift keeps proportions), rotate (Shift snaps to 15°), nudge with arrows,
  copy/cut/paste/duplicate, z-order, align and distribute.
- **Groups**: Ctrl/⌘+G groups the selection so it selects, moves and aligns
  as one; click a selected group again to pick a single item inside it;
  Ctrl/⌘+Shift+G ungroups. Drag the corner handles of any multi-selection to
  resize it all together (Shift keeps proportions).
- **Locking**: Ctrl/⌘+Shift+L locks items so they can't be moved, resized,
  rotated, edited or deleted, and box selection skips them (handy for
  backgrounds and frames). A lock badge shows on selected locked items.
- **Snapping**: grid snap and smart guides that line shapes up with their
  neighbours (hold Alt to move freely).
- **Styling**: fill, line color/width/dash, opacity, font, size, color,
  bold/italic/underline, horizontal and vertical text alignment.
- **Right-click menu** on shapes, lines and empty canvas with the common
  actions (cut/copy/paste, order, group, lock, add text here…).
- **Copy and paste style** (Ctrl/⌘+Alt+C, Ctrl/⌘+Alt+V): apply one shape's or
  line's look to other items, like a format painter.
- **Dark theme**: the sun/moon button in the top bar switches between light,
  dark and following your system setting. Diagrams keep their own background.
- **Undo/redo** for everything (Ctrl/⌘+Z, Ctrl/⌘+Shift+Z).
- **Pages**: several pages per diagram; double-click a tab to rename.
- **Save / open** `.esquisso.json` files (older `.flowboard.json` files from before the rename open too), **autosave** in the browser, and
  **export** PNG (2x, optional transparent background), SVG, vector PDF, or
  just the selection.

Press **?** in the app for the full list of shortcuts.

## Files and privacy

- Diagrams are plain JSON (`.esquisso.json`), easy to back up or put in git.
  Imported images are embedded in the file, so it stays self-contained.
- The autosave copy is kept in your browser's local storage on this machine.
  It is a safety net, not a replacement for saving files.
- The app makes no network requests at runtime. Icons are bundled and loaded
  from the local server.

## Development

```bash
npm test          # unit tests (geometry, routing, store, file format)
npm run typecheck
```

Code map:

| Path | What |
| --- | --- |
| `src/model/` | Types, shape definitions, geometry, connector routing |
| `src/store.ts` | App state, undo/redo history and all editing actions |
| `src/components/Canvas.tsx` | Canvas rendering and mouse interaction |
| `src/components/` | Toolbar, shape/icon library, inspector, pages bar |
| `src/lib/io.ts` | Save/open, autosave, PNG/SVG/PDF export, image import |
| `src/lib/icons.ts` | Bundled icon sets (loaded on demand) |

## Licenses

Bundled icon sets and their licenses are listed in
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
