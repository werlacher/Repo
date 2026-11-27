# Flowboard

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

To build a static copy you can open without the dev server:

```bash
npm run build    # writes ./dist
npm run preview  # serves ./dist at http://127.0.0.1:4173
```

Chrome, Edge and other Chromium browsers give the best experience: **Save**
writes straight back to the same file. In Firefox and Safari, Save downloads
a `.flowboard.json` file instead.

## What it can do

- **Infinite canvas** with pan (scroll, Space+drag, middle mouse, hand tool),
  zoom (Ctrl/⌘+scroll, pinch, buttons) and fit-to-content.
- **Shapes**: rectangle, rounded, ellipse, diamond, triangle, hexagon, star,
  text, sticky note and the standard flowchart set (process, decision,
  terminator, data, document, database, predefined process, manual input,
  manual operation, preparation, delay). Click a tile to add it, drag it onto
  the canvas, or pick a tool (R, O, D, N) and click or drag on the canvas.
- **Icons**: a searchable library of about 40,000 free icons (Lucide, Tabler,
  Material Symbols, Phosphor, Simple Icons brand logos, and SVG Logos with
  AWS/Azure/GCP product logos). Line icons can be recolored.
- **Your own images**: import PNG/JPG/SVG files, drop them on the canvas, or
  paste a screenshot. Good for the official cloud architecture icon packs.
- **Connectors that stick**: hover a shape and drag one of its dots to another
  shape. Lines follow shapes as they move. Choose elbow, straight or curved
  routing, arrowheads at either end (arrow, open, diamond, circle), dashes,
  and a label (double-click the line).
- **Editing**: select, multi-select (Shift+click or drag a box), move, resize
  (Shift keeps proportions), rotate (Shift snaps to 15°), nudge with arrows,
  copy/cut/paste/duplicate, z-order, align and distribute.
- **Snapping**: grid snap and smart guides that line shapes up with their
  neighbours (hold Alt to move freely).
- **Styling**: fill, line color/width/dash, opacity, font, size, color,
  bold/italic/underline, horizontal and vertical text alignment.
- **Undo/redo** for everything (Ctrl/⌘+Z, Ctrl/⌘+Shift+Z).
- **Pages**: several pages per diagram; double-click a tab to rename.
- **Save / open** `.flowboard.json` files, **autosave** in the browser, and
  **export** PNG (2x, optional transparent background), SVG, or just the
  selection.

Press **?** in the app for the full list of shortcuts.

## Files and privacy

- Diagrams are plain JSON (`.flowboard.json`), easy to back up or put in git.
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
| `src/lib/io.ts` | Save/open, autosave, PNG/SVG export, image import |
| `src/lib/icons.ts` | Bundled icon sets (loaded on demand) |

## Licenses

Bundled icon sets and their licenses are listed in
[THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).
