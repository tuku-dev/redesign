# reDesign development handoff

Updated 2026-11-01. Implementation stopped at the user's request to conserve usage. Current work is **local and not yet committed/pushed**. The last published baseline was 7b3cb1e (experimental native import, SVG fixes and startup loader).

## Start here next time

1. Read this file, inspect git status, and preserve current work. Do not rebuild already implemented features.
2. Update compatibility/research details for the new import subset, review screenshots, then commit/push only when requested.
3. Continue the agreed checklist in [docs/FUNCTIONALITY.md](docs/FUNCTIONALITY.md), beginning with richer paints after stabilizing the current changes.

## Implemented locally in this batch

| Stage | Changes | Important limits |
| --- | --- | --- |
| 1. Native .fig vectors/images | Editable cached Bezier fill paths; simple network stroke centerlines; native winding rules; embedded PNG/JPEG/GIF/WebP image fills, dimensions, opacity and fitting; ZIP asset CRC/size checks | Branched stroke networks, per-region paints and exact custom image crops remain unsupported. Cached fill paths do not retain the original network topology. No native export or verified Figma round trips. |
| 2. Point insertion/deletion | Double-click an editing-mode segment to insert; inspector Insert after/Delete; click an anchor then Delete/Backspace; exact cubic subdivision, closing segments, compound-ring handling, locks and undo | Minimum two anchors per remaining path. Deleting a point intentionally changes adjacent geometry. Figma vector networks remain outside the local path model. |
| 3. Masks/outline strokes | Use the bottom selected closed shape as an outline mask; release mask; mask-aware canvas selection/export bounds; cloning/deletion/reference handling. Solid strokes convert to editable filled outlines while retaining the original fill/opacity. | Outline masks ignore paint alpha/luminance. Stroke conversion is polygonized: curve tolerance 0.25 world units, 32-point round caps/joins and generated-coordinate quantization. Dashed strokes, effects and text/frame/group stroke outlining are rejected. Full visual parity remains unverified. |

Two public native fixtures now yield **10 imported / 0 skipped** layers (corners, writer 106) and **18 imported / 5 skipped** (structure, writer 48), including two raster images. Earlier counts in the chronological work log describe older behavior.

## Validation

- **204 Node model/format/controller tests pass.**
- Strict TypeScript production build, ESLint and formatting checks pass.
- Full Chrome browser suite: **83 passed**.
- The mask reload timeout was caused by the E2E fixture clearing `localStorage` on every navigation. The fixture now only seeds an absent document, verifying actual persisted mask state after reload.
- Point-insertion segment overlays now use separate segment-coordinate data attributes, avoiding ambiguity with legacy anchor selectors.
- Production-preview QA remains pending.

## Code map

- Native assets: `src/interop/fig/{archive,decode,convert,paint,images,vectors}.ts`.
- Point editing: `src/model/vector-edit.ts`, `commands/features.ts`, vector editor/rendering and inspector modules.
- Masks: `model/masks.ts`, `commands/masks.ts`, `render/masks.ts`; integrated with hierarchy, clipping, export bounds, store reconciliation, cloning and component reconciliation.
- Stroke conversion: `model/stroke-outline.ts`, `commands/outline.ts`.
- Optional model additions: vector fillRule, image opacity, group maskId. Legacy documents retain defaults.
- New tests: `tests/fig-assets.test.ts`, `vector-edit.test.ts`, `masks-outline.test.ts` and corresponding Chrome specs. Existing native-import expectations were updated.

## Remaining agreed work

- [ ] Finish broad validation/documentation of stages 1-3; inspect native assets, masks and outlined strokes visually. Test mask interactions with components/pages/clipboard and export selection. Broader current-version .fig fixtures remain needed.
- [ ] Richer paints: multiple fills/strokes, richer gradient types and stops/handles, stroke alignment, inner shadows/background blur and effect stacks. **Not started in this batch.**
- [ ] Auto layout: wrapping/grid flow, min/max sizing, absolute children and canvas spacing controls. **Not started in this batch.**
- [ ] Components/design systems: variants/properties, nested swaps, shared styles, variables/collections/modes/aliases/bindings and libraries. **Not started in this batch.**
- [ ] Other backlog: rich typography, advanced prototypes, raster/PDF export and presets, workspace search/sections, performance, accessibility and cross-browser checks.
- [ ] Native .fig export and both editable Figma round trips. **Not implemented.**

## Session constraints and preferences

- Online saving/user panel/backend work is deferred by the user. Do not restart it while continuing editor features.
- Use TypeScript with separate modules; retain CSS and the System/Light/Dark preference. Keep the rD logo and reDesign name.
- Preserve existing AGENTS.md. Track deliveries in [donefun.md](donefun.md) and the functionality inventory.
- donefun.md and package-lock.json are currently gitignored. Do not assume they will be pushed.
- Windows PowerShell may require `npm.cmd`. This session previously had read-only .git metadata; do not assume Git can commit locally. Never reset or overwrite user work to work around permissions.
