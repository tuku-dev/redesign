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

Tests are written in TypeScript, compiled into ignored `.test-build/` output, then executed by Node's test runner. Tests cover document/clipboard validation, selection geometry, transforms, alignment, history, store transactions, gesture commit/cancel, viewport math and the storage adapter. Browser DOM/event wiring, visual fidelity and system clipboard interaction still require browser verification.

## Frame hierarchy

`src/model/hierarchy.ts` owns parent references, subtree traversal, root-selection normalization, containment, adoption, detached clipboard copies and graph validation. `src/ui/parent-control.ts` owns explicit parent selection. Layers and SVG paint order follow the hierarchy, with parent backgrounds painted before descendants.

Node `x`/`y` values currently remain in document coordinates. Parent relationships do not imply SVG translate transforms; commands move subtree coordinates together. A selected frame and its selected children must be normalized to root selections before structural operations to prevent double movement. Ordinary frame resize changes the container size without scaling child sizes. Clipping, layout constraints and inherited container appearance remain separate pending features.

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
