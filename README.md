# reDesign

A browser-based design editor targeting Figma Design functionality and editable native `.fig` interchange. This is an early editor, not a complete Figma replacement.

## Local development

Requires Node.js 22.18 or newer and npm. Application code and tests use strict TypeScript; Vite serves and bundles the browser app.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. On Windows PowerShell, use `npm.cmd` instead of `npm` if execution policy blocks `npm.ps1`.

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the Vite development server with hot updates |
| `npm run check` | Check application, configuration and test types without emitting files |
| `npm test` | Compile TypeScript tests and run Node's built-in test runner |
| `npm run build` | Type-check, then produce the production app in `dist/` |
| `npm run preview` | Serve an existing production build at http://127.0.0.1:4173 |
| `npm run lint` | Run ESLint with TypeScript rules |
| `npm run format` | Format source, tests and configuration with Prettier |
| `npm run format:check` | Verify formatting without changing files |

## Code organization

- `src/main.ts`: application composition and subscription wiring.
- `src/model/`: document types, runtime validation, selection and geometry.
- `src/commands/`: editing operations, transforms, alignment and undo/redo history.
- `src/editor/`: editor state, gesture transactions, pointer input, shortcuts and viewport.
- `src/render/`: SVG construction, shapes, scene and selection overlays.
- `src/ui/`: typed DOM access, panels, toolbar, icons and notifications.
- `src/interop/`: clipboard codec/controller, local file actions, downloads and SVG export.
- `src/storage/`: local document persistence.
- `tests/`: TypeScript `*.test.ts` model and controller regressions.

See [architecture](docs/ARCHITECTURE.md), [functionality inventory](docs/FUNCTIONALITY.md), [compatibility status](docs/compatibility.md), [completed work](donefun.md), and [reverse-engineering rules](REVERSE_ENGINEERING.md).

## Current capabilities and limits

Right-click the canvas or a layer for editing, clipboard, selection, grouping, frame selection, ordering, lock/hide, zoom and SVG export actions. Ctrl/Cmd+G groups; Ctrl/Cmd+Shift+G ungroups; Ctrl/Cmd+Alt+G frames the selection. Layer rows include lock/visibility toggles. These states persist and affect descendants.

Draw shapes, frames and text; select single/multiple layers; move, nudge, resize, duplicate, delete, align and distribute. Pan, zoom, fit selection, edit appearance, and undo/redo. Shift-click or drag a marquee to multiselect. Ctrl+drag draws a perfect square/circle. Shift/Alt modify resizing; Escape cancels gestures. Clipboard shortcuts transfer reDesign layers; browser-level verification remains pending.

Documents autosave under the existing `redesign.document` browser-storage key. Download/reopen version 1 `.redesign` files and export SVG. Existing local file format is unchanged by the TypeScript migration. Browser storage can be cleared, so download important documents.

Frames contain child layers and nested frames. Moving, nudging, duplicating or deleting a frame includes its descendants. Draw or drop layers into frames, or use the Parent control; the Layers panel shows nesting. Legacy flat files infer fully enclosed children on load. Frames support Clip content and per-child horizontal/vertical constraints. Drag snapping aligns edges/centers and equal gaps; magenta guides show spacing. Use the Snap toggle or hold Ctrl during a move/resize to bypass snapping. Rotate using the top circular handle or the Angle field; hold Shift during rotation for 15-degree increments. Double-click text to edit inline; Escape cancels, Ctrl/Cmd+Enter or blur commits. Typography controls include installed font family, weight/style, line height, letter spacing, alignment and word wrap. Advanced typography, auto text sizing, components, auto layout, collaboration, and native `.fig` import/export remain pending. SVG is not a native Figma document.
