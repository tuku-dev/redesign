# Architecture

## Application entry point

`src/main.ts` creates the editor state, commands, controllers and UI bindings. It subscribes to editor updates and coordinates rendering and persistence. It contains no drawing algorithms, panel construction, file parsing or shortcut maps.

## Functional boundaries

| Responsibility | Modules |
| --- | --- |
| Document schema and validation | `src/model/types.ts`, `document.ts` |
| Selection and bounds | `src/model/selection.ts`, `geometry.ts` |
| Editing commands and property updates | `src/commands/editing.ts` |
| Move, resize and clone geometry | `src/commands/transforms.ts` |
| Align and distribute | `src/commands/alignment.ts` |
| Undo/redo snapshots | `src/commands/history.ts` |
| Editor state and transaction commits | `src/editor/store.ts` |
| Pointer gesture state machine | `src/editor/gestures.ts` |
| Browser pointer events | `src/editor/pointer.ts` |
| Keyboard shortcuts | `src/editor/keyboard.ts` |
| Pan/zoom coordinates and fitting | `src/editor/viewport.ts` |
| Shape rendering | `src/render/shapes.ts`, `svg.ts` |
| Scene and selection rendering | `src/render/scene.ts`, `selection-overlay.ts` |
| Layers and property panels | `src/ui/layers.ts`, `properties.ts` |
| Toolbar controls | `src/ui/toolbar.ts` |
| Icons, notifications, DOM access | `src/ui/icons.ts`, `notifications.ts`, `elements.ts`, `action-button.ts` |
| Clipboard payloads and browser integration | `src/interop/clipboard-codec.ts`, `clipboard-controller.ts` |
| Local open/save and download | `src/interop/file-actions.ts`, `download.ts` |
| SVG export | `src/interop/svg-export.ts` |
| Autosave adapter | `src/storage/local-document.ts` |

## State flow

Browser events call commands or controllers. Commands change the typed document through `EditorStore.change`. Pointer gestures preview changes and commit one history entry on completion, or restore the starting snapshot on cancellation. Store updates request either scene-only or full UI rendering. Committed document changes also request persistence.

The gesture union distinguishes pan, move, resize, marquee and drawing state. Model, command and gesture modules do not depend on the browser DOM. UI and browser adapters consume them. Dependency direction follows these boundaries; imports of types use `import type`.

## Types and trust boundaries

Strict TypeScript covers application code, tests and Vite configuration. Node types, tools, resize handles, alignment modes, document shapes and editable fields have explicit contracts. External documents and clipboard payloads enter as `unknown` and undergo runtime validation. Type assertions cannot replace file validation.

Keep future features in the module that owns their behavior, with dedicated modules for distinct responsibilities. Do not put new feature logic into `main.ts`, and avoid cross-module global state.

## Toolchain and verification

Vite transforms TypeScript and builds the browser bundle. `tsc --noEmit` checks types separately and runs before production builds, because [Vite does not perform type checking](https://vite.dev/guide/features). Prettier uses two spaces and single quotes; ESLint checks TypeScript imports and common errors. Installed versions are pinned by `package-lock.json`.

Tests are written in TypeScript, compiled into ignored `.test-build/` output, then executed by Node's test runner. Tests cover document/clipboard validation, selection geometry, transforms, alignment, history, store transactions, gesture commit/cancel, viewport math and the storage adapter. Playwright tests in `tests/e2e/` verify Chrome DOM/pointer/file workflows. Font fidelity, other engines and external clipboard interaction still need separate verification.

## Frame hierarchy

`src/model/hierarchy.ts` owns parent references, subtree traversal, root-selection normalization, containment, adoption, detached clipboard copies and graph validation. `src/ui/parent-control.ts` owns explicit parent selection. Layers and SVG paint order follow the hierarchy, with parent backgrounds painted before descendants.

Node `x`/`y` values currently remain in document coordinates. Parent relationships do not imply SVG translate transforms; commands move subtree coordinates together. A selected frame and its selected children must be normalized to root selections before structural operations to prevent double movement. Ordinary frame resize changes the container size without scaling child sizes. Frame constraints, clipping and auto layout are implemented in dedicated modules; arbitrary affine transforms remain pending.

Version-1 `.redesign` documents remain supported. Missing legacy parent fields are inferred from full geometric enclosure on import; explicit `null` means intentional root placement. Runtime validation checks parent existence/type, cycles and depth. Do not infer parents again on every render or edit.

## Context actions and layer state

`src/ui/context-menu-actions.ts` builds a typed action tree with live selection/disabled states. `src/ui/context-menu.ts` owns popover placement, submenus, keyboard focus and dismissal. `src/ui/editor-actions.ts` owns shortcut bindings, rename focus and selected SVG export. Menu code invokes commands rather than mutating document nodes directly.

`src/commands/structure.ts`, `layer-order.ts`, `layer-state.ts` and `selection.ts` implement the corresponding operations. `src/model/groups.ts` fits group bounds after child changes. `src/model/layer-state.ts` resolves inherited locks/visibility and group click targets. Node validation supplies defaults for older documents without lock/hidden flags. Locked ancestors protect descendants; rendering/export omit inherited-hidden nodes. Keep context-menu, panel and shortcut behavior connected to the same commands as additional functionality is introduced.

## Manipulation, constraints and text

- `src/model/snapping.ts` computes screen-space snap corrections, guide geometry and spacing measurements; `src/render/guides.ts` renders transient overlays. Gesture snapshots exclude moving subtrees from snap candidates.
- `src/model/rotation.ts` and `src/commands/rotation.ts` own rotation math and subtree transforms. Rotated children retain document-space centers and individual angles; SVG containers do not apply a second inherited rotation. Group bounds project child corners into group axes.
- `src/model/constraints.ts` resolves five constraint modes per axis in the resizing frame's axes and propagates into nested frames. `src/commands/node-options.ts` validates typed geometry/typography options; `src/ui/design-options.ts` owns the controls.
- `src/render/document.ts` is the shared hierarchical canvas/export renderer, including frame clipping, container opacity, visibility and pointer locking. `src/model/clipping.ts` handles clip-aware point selection; `render-bounds.ts` computes conservative clipped visual bounds.
- `src/model/text-layout.ts` owns pure grapheme-aware wrapping. `src/render/text.ts` uses browser text measurement for SVG output. `src/editor/text-edit.ts` owns transactional inline editing; `src/ui/inline-text.ts` owns the positioned input and keyboard/IME interaction.
- Node option defaults and import validation live in `src/model/node-options.ts`; version-1 documents remain supported. Browser-level validation and remaining geometry/typography limits are recorded in `donefun.md`.


## Layout, assets and page state

`model/features.ts` defines optional version-1 extensions and validates paints, raster data, layouts, grids, vectors and links. `workspace-validation.ts` validates page metadata, guides and globally unique node IDs. Documents without extensions remain readable. The active page uses `doc.nodes`; inactive pages archive their nodes in `workspace.pages`, and the active page entry has an empty `nodes` array. Page commands swap arrays in one undoable transaction. `allNodes` resolves cross-page references.

`auto-layout.ts` measures nested hug frames and arranges fill/fixed children in parent axes. Commit normalizes edited vector bounds, lays out the active page, synchronizes component templates and overrides, then resolves layout and group bounds before validation/history/autosave. `components.ts` reconciles added/deleted source children and retains stable instance IDs. Main-component deletion detaches instances safely. Nested component composition and variants are not supported yet.

`vector.ts` owns normalized compound rings and actual polygon booleans through `polygon-clipping`. Ellipses and rounded rectangles are approximated for boolean operations. `render/paint.ts` owns self-contained image clipping, gradients, strokes and effect definitions shared by canvas and SVG export. UI grids/rulers/guides are separate overlays, excluded from exports.

`ui/workspace.ts` composes page, image, ruler, vector and prototype controls; `feature-properties.ts` supplies inspector fields. `model/prototype.ts` owns navigation without mutating editor data. The modal preview renders frame subtrees with click/keyboard navigation, back/restart and optional dissolve animation.


`model/bezier.ts` owns cubic evaluation, exact extrema/bounds, SVG path commands, adaptive flattening for booleans, and anchor/handle editing. Vector points optionally store normalized incoming/outgoing handles and a smooth flag. `mapVectorPoint` carries controls through normalization and coordinate transforms; normalizing a rotated path preserves its world geometry. `render/vector-editor.ts` draws editor-only anchor/tangent overlays; `ui/vector-editor.ts` separates draft point dragging from committed anchor/handle transactions. Legacy straight paths need no additional fields.


`interop/document-save.ts` owns save naming, session-only file handles, concurrency, write/close completion, cancellation and failure handling. `document-name.ts` owns filename-to-title conversion and portable download names. `file-actions.ts` chooses native-picker or download behavior, resets handles after opening a new document, and applies opened filenames. The saved payload gets the chosen title before serialization; the live title changes only after success. `renderToolbar` synchronizes the header and browser tab title. File handles are never serialized. Native picker/writer adapters are simulated in browser tests; actual OS dialogs are outside automated coverage.


Vector editing uses editor-only `editingVectorId` state. Selection changes, deletion and undo clear invalid edit sessions; the selection renderer hides object resize controls during point editing. Canvas pointer handling prevents compatibility mouse events and redraws SVG nodes, so vector double-clicks are detected from two stationary pointer tap pairs on stable node/anchor IDs. Native double-click handling remains as a fallback, with duplicate activation suppression. Editor-only wide path hit strokes make thin curves easier to target; these are omitted from prototypes and SVG exports.


Save semantics are explicit: `DocumentFileSaver.save()` writes a retained handle, or persists to browser storage when native saving is unavailable. `save(true)` performs Save As/native picking or requests a name for an explicit download. Ordinary Save never infers a new destination from a changed document title. `reset(handle)` connects native-opened files. File-action capture handles Ctrl/Cmd+S and Shift+S before editor handlers or browser Save Page, commits focused fields/text/gestures, and dispatches a before-save event for pen drafts. The custom `ui/save-dialog.ts` is used only for explicit fallback downloads. Native adapters remain simulated in browser tests; actual OS dialogs are outside automated coverage.

## Native Figma reader

`interop/fig-container.ts` routes files by signature or extension. `fig-reader.ts` creates a dedicated worker and enforces a 15-second deadline. Inside `interop/fig/`, archive parsing reads bounded ZIP central-directory entries and checks canvas CRC; compression bounds DEFLATE output and Zstandard frame/window sizes. The Kiwi interpreter reads each file's embedded schema without dynamic code generation. Geometry, paint and document conversion are separate modules. Only the final validated document and a conversion report cross the worker boundary.

`ui/fig-import-dialog.ts` displays losses before any editor mutation. Accepting opens the imported subset through the existing document registry with no source file handle. Unsupported component/instance/vector subtrees are counted and skipped. The original native schema/data/assets are not retained for rewriting; this is not a round-trip codec. `kiwi-schema` is a development dependency for synthetic test encoding/types; production decompression uses MIT-licensed `fflate` and `fzstd`. Fixtures, licenses and measured results are in `tests/fixtures/fig/` and [research/native-fig.md](research/native-fig.md).

## Startup loading

`index.html` includes critical loader styles and hides the editor before app assets arrive. Its early theme script colors the loading screen using the saved/system preference. `bootstrap.ts` dynamically imports `main.ts`, waits for fonts and a render frame, then reveals the initialized editor and removes the loading screen. Both a missing entry script and a rejected application import show a Reload action while keeping the skeleton hidden. The spinner honors reduced motion; a noscript message explains the JavaScript requirement. No artificial loading delay is added.
