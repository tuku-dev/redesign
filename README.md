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
| `npm run test:e2e` | Run Playwright browser interaction tests (starts Vite automatically) |
| `npm test` | Compile TypeScript tests and run Node's built-in test runner |
| `npm run build` | Type-check, then produce the production app in `dist/` |
| `npm run preview` | Serve an existing production build at http://127.0.0.1:4173 |
| `npm run lint` | Run ESLint with TypeScript rules |
| `npm run format` | Format source, tests and configuration with Prettier |
| `npm run format:check` | Verify formatting without changing files |

## Code organization

- `src/bootstrap.ts`: startup loading screen, asset readiness and failure recovery.
- `src/main.ts`: application composition and subscription wiring.
- `src/model/`: document types, runtime validation, selection and geometry.
- `src/commands/`: editing operations, transforms, alignment and undo/redo history.
- `src/editor/`: editor state, gesture transactions, pointer input, shortcuts and viewport.
- `src/render/`: SVG construction, shapes, scene and selection overlays.
- `src/ui/`: typed DOM access, panels, toolbar, icons and notifications.
- `src/interop/`: clipboard codec/controller, local file actions, downloads and SVG export.
- `src/storage/`: local document persistence.
- `tests/`: TypeScript `*.test.ts` model/controller regressions; `tests/e2e/*.spec.ts` Playwright browser tests.

See [architecture](docs/ARCHITECTURE.md), [functionality inventory](docs/FUNCTIONALITY.md), [compatibility status](docs/compatibility.md), [completed work](donefun.md), and [reverse-engineering rules](REVERSE_ENGINEERING.md).

## Current capabilities and limits

Right-click the canvas or a layer for editing, clipboard, selection, grouping, frame selection, ordering, lock/hide, zoom and SVG export actions. Ctrl/Cmd+G groups; Ctrl/Cmd+Shift+G ungroups; Ctrl/Cmd+Alt+G frames the selection. Layer rows include lock/visibility toggles. These states persist and affect descendants.

Draw shapes, frames and text; select single/multiple layers; move, nudge, resize, duplicate, delete, align and distribute. Pan, zoom, fit selection, edit appearance, and undo/redo. Shift-click or drag a marquee to multiselect. Ctrl+drag draws a perfect square/circle. Shift/Alt modify resizing; Escape cancels gestures. Clipboard shortcuts transfer reDesign layers; browser-level verification remains pending.

Documents autosave under the existing `redesign.document` browser-storage key. Download/reopen version 1 `.redesign` files and export SVG. Existing local file format is unchanged by the TypeScript migration. Browser storage can be cleared, so download important documents.


Frames contain child layers and nested frames. Moving, nudging, duplicating or deleting a frame includes its descendants. Draw or drop layers into frames, or use the Parent control; the Layers panel shows nesting. Legacy flat files infer fully enclosed children on load. Frames support Clip content and per-child horizontal/vertical constraints. Drag snapping aligns edges/centers and equal gaps; magenta guides show spacing. Use the Snap toggle or hold Ctrl during a move/resize to bypass snapping. Rotate using the top circular handle or the Angle field; hold Shift during rotation for 15-degree increments. Right-click a selection for 90° clockwise/counterclockwise rotation, 180° rotation, or horizontal/vertical flips. Double-click text to edit inline; Escape cancels, Ctrl/Cmd+Enter or blur commits. Typography controls include installed font family, weight/style, line height, letter spacing, alignment and word wrap. Advanced typography, auto text sizing, collaboration, and native `.fig` export remain pending. SVG is not a native Figma document.

## Layout, assets and prototypes

Use **Pages** in the left panel to organize screens. Expand **Tools & resources** for image insertion, the pen tool, component insertion, rulers/guides and prototype presentation. The right inspector exposes auto layout, sizing, component actions, ordered solid fill and stroke layers, gradients, effects, grids, vector vertices and click interactions. See [feature guide](docs/EDITOR_FEATURES.md) for instructions and remaining limits.

Run `npm run test:e2e` for real browser checks. Windows defaults to installed Google Chrome; set `PLAYWRIGHT_CHANNEL=msedge` to use Edge. Other platforms use Playwright Chromium (`npx playwright install chromium`). Tests start a loopback Vite server and use isolated browser data. Failed tests retain traces/screenshots in ignored `test-results/`.


## Saving and document names

Editable documents use `.redesign` (for example, `Dashboard.redesign`). **Save / Ctrl+S** updates the connected disk file where native file access is available. The first save chooses a destination; later saves reuse it, including after header edits. **Save as / Ctrl+Shift+S** deliberately chooses a new destination. Native Open retains the selected file handle, so subsequent saves update that same file. Handles are session-only, and browser permission prompts remain browser-controlled.

Without direct file access, **Save / Ctrl+S** stores the project in this browser without dialogs or downloads. **Download copy / Ctrl+Shift+S** opens an app dialog to name and download a disk copy. That copy does not update automatically: ordinary downloads cannot overwrite an existing disk file. The UI distinguishes browser saves from connected-file saves. Browser storage has a quota and can be cleared, so download important projects.

Ctrl+S is handled even when an input or textarea has focus; current edits are committed before saving. Cancel/failure does not rename the project. Open uses the selected filename without its extension for the header/tab title. SVG export remains `.svg`; native `.fig` export remains pending.

## Experimental Figma import

Use **Open** to select a native `.fig` file. Review the supported-layer count, skipped subtrees and conversion warnings, then choose **Import supported layers** or **Cancel**. The first subset imports pages, frames/groups, rectangles, ellipses and plain text with solid paints. Supported layers remain editable; components, instances, vectors, images and other advanced content are not preserved. The original file is never connected to the document saver.

ZIP and bare fig-kiwi readers use the file's embedded schema, bounded DEFLATE/Zstandard decoding and a worker timeout. Two public licensed fixtures and synthetic regressions are tested. Native export and editable round trips in Figma are **not implemented or verified**. See [native import research](docs/research/native-fig.md) for the acceptance matrix, source provenance and remaining work.
