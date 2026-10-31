# Copilot instructions for redesign

This repository is a browser-based design editor inspired by Figma. The project is organized around a typed document model, command-driven editing operations, and a separate rendering/UI layer. Keep changes aligned with that architecture instead of introducing app-global state or ad hoc DOM mutation.

## Build, test, and lint

Prerequisites: Node.js 22.18+ and npm.

```sh
npm ci
npm run dev
```

Useful commands:

```sh
npm run check        # Type-check without emitting files
npm run build        # tsc --noEmit && vite build
npm run lint         # ESLint over the repo
npm run test         # tsc -p tsconfig.test.json && node --test .test-build/tests/*.test.js
npm run test:e2e     # Playwright browser tests
npm run format       # Prettier write
npm run format:check # Prettier check
```

Run a single Node test after compiling the TypeScript test suite:

```sh
npx tsc -p tsconfig.test.json && node --test .test-build/tests/selection.test.js
```

Or target a single test name within a file:

```sh
npx tsc -p tsconfig.test.json && node --test --test-name-pattern "marquee works" .test-build/tests/selection.test.js
```

Playwright tests live under `tests/e2e/` and are intended for browser-level checks; traces/screenshots remain in `test-results/` on failures.

## High-level architecture

The codebase is split by responsibility and should stay that way:

- `src/main.ts`: app composition and subscriptions; should stay as a coordinator, not a dumping ground for feature logic.
- `src/model/`: document schema, geometry, selection, hierarchy, validation, constraints, snapping, text/layout, and workspace rules.
- `src/commands/`: editing operations, transforms, alignment, structure, history and undo/redo entry points.
- `src/editor/`: store, gesture state, pointer handling, keyboard shortcuts, view transforms and transactional edit flow.
- `src/render/`: rendering and SVG generation for shapes, guide overlays, scene and selection.
- `src/ui/`: panels, toolbar, dialogs, context menus, properties, actions and notifications.
- `src/interop/`: clipboard integration, file open/save/download and SVG export.
- `src/storage/`: browser/local document persistence.
- `tests/`: Node-based regression tests and Playwright browser tests.

The important architectural boundary is: model and command logic should not depend on browser DOM APIs. UI modules should invoke commands instead of mutating document nodes directly. `EditorStore.change` is the transaction boundary for app updates, and history snapshots are wrapped around command-driven changes.

## Key conventions and repo-specific patterns

- Keep feature logic in the module that owns its behavior. Avoid adding new logic to `src/main.ts`.
- Use `import type` for type-only imports; the codebase explicitly separates runtime values from types.
- External documents, clipboard payloads and other untrusted inputs are validated at runtime, not trusted because of a cast. `unknown` inputs should be checked before use.
- Frame and hierarchy logic is a critical subsystem: `src/model/hierarchy.ts` owns parent/child relationships, subtree operations and normalization. Preserve parent validity, cycle safety and root-selection normalization when editing structure.
- `src/model/selection.ts`, `src/commands/transforms.ts`, and related geometry commands are the authoritative path for multi-select move/resize behavior; changes in selection math or transform semantics should be reflected in tests.
- Undo/redo behavior is intentionally transactional. Several editing flows commit a single history entry on completion and revert to the snapshot on cancellation.
- Version-1 `.redesign` documents remain supported; legacy fields and missing metadata must continue to load safely.
- Keep page/workspace logic consistent with the active page model: active page nodes live in `doc.nodes`, while inactive pages archive their nodes in workspace state. Structural operations should respect that contract.
- UI actions and shortcuts should trigger delegate commands rather than directly editing model state. This keeps menu items, keyboard actions, and toolbar actions consistent.
- Tests are written in TypeScript and compiled into the ignored `.test-build/` directory before Node's built-in test runner executes them. Follow the same test style and keep geometry/selection regressions covered.

## Practical guidance for future changes

- When adding new editing behavior, place it beside the related document/command module instead of creating cross-cutting global logic.
- Validate document invariants and selection geometry in the model layer before exposing behavior through UI actions.
- For browser-facing integrations, keep the file/export/clipboard behavior under `src/interop/` and avoid mixing them into rendering code.
- Prefer surgical changes that preserve the repo's existing module boundaries and compatibility requirements.
