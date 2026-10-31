# reDesign Functionality Specification

## Product goal

Build a web-based design application targeting Figma Design functionality, interaction behavior, rendering fidelity, and editable native `.fig` interchange in both directions. This is the working feature backlog, not a claim of complete Figma coverage. Expand it as reference behavior is investigated. Other Figma products require separate specifications.

Status updated on 2026-10-31. **Basic** means an implementation exists but browser verification and parity testing remain pending. **Pending** means not implemented. **Research** means feasibility or reference behavior must be established. No feature is currently certified as matching Figma exactly.

## 1. Files and workspace

| ID | Functionality | Status / required behavior |
| --- | --- | --- |
| FILE-01 | Rename document | Basic; editable header, saved/opened filename synchronization, browser tab title and autosaved name |
| FILE-02 | Local autosave | Basic; browser storage, with save failure notice |
| FILE-03 | Save/open local document | Basic; versioned `.redesign` JSON, native open/save with retained handles where supported, browser-storage Save fallback, explicit Save As/download app dialog, focused-field Ctrl+S capture, cancel/failure handling, validation and 100 MB import limit |
| FILE-04 | New, duplicate, close document | Pending; protect unsaved work |
| FILE-05 | Multiple documents/tabs | Pending; independent state and history |
| FILE-06 | Pages | Basic; create, rename, duplicate, reorder, delete and switch pages; undo and multi-page save/open tested in Chrome |
| FILE-07 | File browser | Pending; recent files, drafts, search, thumbnails, trash and restore |
| FILE-08 | Teams and projects | Pending; organize documents, ownership and project access |
| FILE-09 | Version history | Pending; named versions, previews and restore |
| FILE-10 | Templates and shared resources | Pending; reusable starting documents and discovery |
| FILE-11 | Offline recovery | Pending; crash recovery, storage migrations and conflict handling |

## 2. Canvas and navigation

| ID | Functionality | Status / required behavior |
| --- | --- | --- |
| VIEW-01 | Pan canvas | Basic; hand tool, Space-drag, middle-button drag |
| VIEW-02 | Zoom | Basic; wheel, buttons, reset; zoom around pointer |
| VIEW-03 | Fit document/selection | Basic; Fit / Shift+1 for all layers, Selection / Shift+2 for selection |
| VIEW-04 | Rulers and guides | Basic; zoom-aware rulers, drag/numeric guide creation and movement, visibility and removal; snapping and cancel tested |
| VIEW-05 | Layout grids | Basic; frame square/column/row grids with size/count, gutter and margin; editor-only overlays |
| VIEW-06 | Pixel grid and pixel preview | Pending; zoom-dependent precision |
| VIEW-07 | Outline mode and UI visibility | Pending; inspect geometry and hide panels |
| VIEW-08 | Canvas settings | Pending; editable background and view preferences |
| VIEW-09 | Find and navigate layers | Pending; search, reveal, zoom to item |
| VIEW-10 | Touch and trackpad input | Pending; gesture behavior and browser compatibility |

## 3. Selection and editing

| ID | Functionality | Status / required behavior |
| --- | --- | --- |
| EDIT-01 | Single selection | Basic; canvas and layer list |
| EDIT-02 | Multiple selection | Basic; Shift toggle, intersection marquee, Shift-add and Ctrl/Cmd+A |
| EDIT-03 | Nested selection | Basic; Ctrl/Cmd-click group drilling, parent/child selection, bounding-box Select layer menu |
| EDIT-04 | Move and nudge | Basic; drag, arrows, Shift for 10px |
| EDIT-05 | Resize | Basic; eight handles, multi-layer bounds, Shift aspect lock and Alt center resize; text metrics remain limited |
| EDIT-06 | Rotation, flips and scale | Partial; subtree rotation handle/Angle field, 15-degree Shift snapping, rotated resizing and context-menu 90°/180° rotation plus horizontal/vertical flips; full scale transforms pending |
| EDIT-07 | Snapping and measurements | Basic; edge/center and equal-gap drag snapping, drawing/resize snapping, magenta guides and spacing measurements; grid/ruler snapping pending |
| EDIT-08 | Alignment and distribution | Basic; six edge/center alignments and equal-gap horizontal/vertical distribution |
| EDIT-09 | Duplicate and delete | Basic; full selection duplicated/deleted in one transaction |
| EDIT-10 | Clipboard | Partial; validated native clipboard payloads for reDesign tabs, in-tab fallback and paste in place; browser verification and Figma clipboard pending |
| EDIT-11 | Layer ordering | Basic; multi-layer forward/backward/front/back in menu and shortcuts; drag reorder among siblings in the Layers panel |
| EDIT-12 | Undo/redo | Basic; 100 snapshots, one entry per changed gesture, no entry for selection/no-op clicks |
| EDIT-13 | Context menus and commands | Partial; functional canvas/layer context menus with nested actions and keyboard navigation; command search pending |
| EDIT-14 | Cancel interactions | Basic; Escape, pointer cancellation, capture loss and blur restore pre-gesture state without history entries |
| EDIT-15 | Selection/property synchronization | Partial; mixed appearance and geometry values; batch fill/opacity/radius/font size and shared X/Y/width/height edits across selected roots; richer batch geometry transforms pending |
| EDIT-16 | Keyboard accessibility | Partial; editor shortcuts plus keyboard-navigable menus; full accessibility audit pending |

## 4. Layers, containers and geometry

| ID | Functionality | Status / required behavior |
| --- | --- | --- |
| NODE-01 | Rectangles and ellipses | Basic; draw and edit numeric bounds |
| NODE-02 | Text layers | Basic; explicit newlines and basic size/color |
| NODE-03 | Frames | Basic; persistent nested hierarchy, subtree operations, parenting, clipping, constraints and horizontal/vertical auto layout |
| NODE-04 | Groups and nested hierarchy | Basic; nested frames/groups, reparenting and ungrouping; local transforms pending |
| NODE-05 | Sections | Pending; named organizational regions |
| NODE-06 | Layer naming | Basic through property field, context menu and F2; inline and batch rename pending |
| NODE-07 | Visibility and locking | Basic; persisted/inherited visibility and locking, layer-panel toggles, mutation protection and export filtering |
| NODE-08 | Clipping and masks | Partial; nested frame clipping in canvas/export and clipped hit filtering; masks pending |
| NODE-09 | Lines, arrows, polygons and stars | Pending; editable geometry-specific parameters |
| NODE-10 | Pen and vector editing | Partial; straight and cubic Bezier pen paths, click-drag mirrored handles, anchor/handle editing, independent handles, smooth/corner conversion, open/closed compound paths and exact cubic bounds; vector networks and segment insertion pending |
| NODE-11 | Pencil/freehand | Pending; smoothing and editable paths |
| NODE-12 | Boolean operations | Partial; union, subtract, intersect and exclude create editable compound paths with holes; operands recover through undo, live boolean containers pending; curves polygonized |
| NODE-13 | Flatten and outline strokes | Pending; predictable conversion to vector geometry |
| NODE-14 | Corner controls | Basic uniform radius; independent corners and smoothing pending |
| NODE-15 | Image layers | Partial; PNG/JPEG/WebP/GIF picker and drop, embedded image fills, cover/contain/stretch, focal crop and non-destructive brightness/contrast/saturation; clipboard images and tiling pending |

## 5. Appearance and rendering

| ID | Functionality | Status / required behavior |
| --- | --- | --- |
| PAINT-01 | Solid fill | Basic; one opaque RGB color plus layer opacity |
| PAINT-02 | Multiple fills | Pending; ordered paints, per-paint visibility and opacity |
| PAINT-03 | Gradients | Partial; two-stop linear gradients with start/end colors and angle; radial/angular/diamond gradients, arbitrary stops and canvas handles pending |
| PAINT-04 | Strokes | Partial; one centered stroke with width/color and round joins/caps; alignment, dashes, multiple strokes and stroke outlining pending |
| PAINT-05 | Opacity and blend modes | Basic layer opacity; blend modes pending |
| PAINT-06 | Shadows and blur | Partial; one drop shadow and layer blur via shared SVG filters; conservative export bounds; inner/background blur and effect stacks pending |
| PAINT-07 | Color picker | Basic browser picker; hex/RGB/HSL/alpha, eyedropper and shared swatches pending |
| PAINT-08 | Image adjustments | Partial; non-destructive brightness, contrast and saturation controls (0–200%) for image fills |
| PAINT-09 | Rendering fidelity | Research; antialiasing, compositing, clipping and export consistency |

## 6. Typography

| ID | Functionality | Status / required behavior |
| --- | --- | --- |
| TEXT-01 | Text content and font size | Basic; inline and side-panel text editing, uniform font size |
| TEXT-02 | Inline editing | Basic; double-click/new-text inline textarea, native caret/selection, Escape cancel and Ctrl/Cmd+Enter commit |
| TEXT-03 | Fonts | Partial; browser/system family, weight and italic controls; variable axes, custom font import and missing-font workflows pending |
| TEXT-04 | Paragraph layout | Partial; word wrapping, explicit newlines, fixed width and horizontal alignment; auto size, truncation and rich paragraphs pending |
| TEXT-05 | Text metrics | Partial; line-height multiplier and letter spacing; paragraph spacing/indentation and exact Figma metrics pending |
| TEXT-06 | Rich text | Pending; mixed formatting, decorations, links and lists |
| TEXT-07 | International text | Research; shaping, bidirectional text, input methods, emoji and fallback |
| TEXT-08 | OpenType features | Pending; available font features and matching output |

## 7. Responsive layout

| ID | Functionality | Status / required behavior |
| --- | --- | --- |
| LAYOUT-01 | Constraints | Basic; start/end/center/stretch/scale on both axes during numeric/drag frame resizing, including nested frames |
| LAYOUT-02 | Auto layout | Partial; horizontal/vertical frames with reactive child placement; grid flow and wrapping pending |
| LAYOUT-03 | Sizing | Partial; fixed/hug frame dimensions and fill children; min/max, intrinsic text sizing and advanced affine layouts pending |
| LAYOUT-04 | Spacing and alignment | Partial; independent padding, gap, cross alignment and start/center/end/space-between distribution; wrapping pending |
| LAYOUT-05 | Absolute positioning | Pending; out-of-flow children with constraints |
| LAYOUT-06 | Nested layout | Partial; nested frame measurement and arrangement with subtree translation; advanced text measurement and cyclic sizing parity pending |
| LAYOUT-07 | Layout controls | Partial; inspector controls and sibling-order-driven layout; canvas gap handles, drag reordering and responsive preview presets pending |

## 8. Components and design systems

| ID | Functionality | Status / required behavior |
| --- | --- | --- |
| SYSTEM-01 | Main components and instances | Basic; main frames, stable source links, automatic source updates, instance insertion across pages, child reconciliation and safe detachment on source removal |
| SYSTEM-02 | Overrides | Partial; per-layer text/appearance/geometry overrides, reset and detach; nested component swaps and property sets pending |
| SYSTEM-03 | Variants and properties | Pending; sets, variant selection, boolean/text/instance properties |
| SYSTEM-04 | Shared styles | Pending; paint, text, effect and grid styles |
| SYSTEM-05 | Variables | Pending; collections, modes, types, aliases, bindings and scope |
| SYSTEM-06 | Libraries | Pending; publish, consume, update and resolve missing dependencies |
| SYSTEM-07 | Assets browser | Partial; main-component selector and insert-instance action in Tools & resources; previews and drag insertion pending |

## 9. Prototyping and presentation

| ID | Functionality | Status / required behavior |
| --- | --- | --- |
| PROTO-01 | Flows and starting points | Partial; start from selected/top-level frame, connect screens across pages and launch preview; named multiple flows pending |
| PROTO-02 | Triggers and actions | Partial; click/keyboard-accessible navigation hotspots with ancestor action lookup; hover, press, drag, delays, links and conditional actions pending |
| PROTO-03 | Overlays and scrolling | Pending; positions, dismissal, overflow and fixed/sticky elements |
| PROTO-04 | Transitions | Partial; instant and timed dissolve transitions with reduced-motion support; easing controls and smart animation pending |
| PROTO-05 | Interactive components | Pending; variant transitions and state |
| PROTO-06 | Variables and conditional logic | Pending; assignment, expressions and branching |
| PROTO-07 | Presentation player | Partial; modal player with fitted screens, navigation, back, restart and close; device presets and shared previews pending |

## 10. Import, export and interoperability

| ID | Functionality | Status / required behavior |
| --- | --- | --- |
| IO-01 | Native reDesign files | Basic; editable versioned JSON round trip |
| IO-02 | Native Figma import | Research; identify codec and preserve supported semantics |
| IO-03 | Native Figma export | Research; genuine `.fig` accepted and editable in Figma |
| IO-04 | Bidirectional round trips | Pending; edits preserved through both application journeys |
| IO-05 | SVG export | Basic; whole document; Figma import and visual checks pending |
| IO-06 | SVG import | Pending; safe parsing and editable path/paint conversion |
| IO-07 | Raster/PDF interchange | Partial; embedded PNG/JPEG/WebP/GIF import and SVG embedding; PNG/JPEG/PDF export pending |
| IO-08 | Export presets | Partial; whole-document and selected-subtree SVG export; presets, scales, batch formats and slices pending |
| IO-09 | Figma API/plugin bridge | Research; explicit interim integration, separate from native file support |
| IO-10 | Unsupported features | Pending; preflight report, safe preservation and explicit loss warnings |
| IO-11 | Asset/reference integrity | Pending; fonts, images, IDs, styles and component dependencies |
| IO-12 | File safety | Basic JSON validation; expand limits, fuzzing and codec isolation |

## 11. Accounts, collaboration and sharing

All items below are **Pending** and require server-side architecture.

- COLLAB-01: Sign-in, sessions, account settings and recovery.
- COLLAB-02: File/project roles, invitations, link access and permission enforcement.
- COLLAB-03: Live cursors, presence, selections and follow-user mode.
- COLLAB-04: Concurrent editing, conflict resolution and reconnect synchronization.
- COLLAB-05: Shared persistence, backups, recovery and document ownership.
- COLLAB-06: Comment threads, pins, replies, mentions, resolution and notifications.
- COLLAB-07: Shared version history, branching and merging workflows.
- COLLAB-08: Review, approval and handoff states.

## 12. Developer workflows and extensibility

All items below are **Pending**, with API parity requiring research.

- DEV-01: Inspect dimensions, spacing, colors, typography and asset metadata.
- DEV-02: Developer mode, code snippets, variable references and downloadable assets.
- DEV-03: Component/code mappings and development resource links.
- DEV-04: Plugin API, sandbox, lifecycle, permissions and document operations.
- DEV-05: Widgets and interactive embedded content.
- DEV-06: REST API, authentication, rate limits and webhook events.
- DEV-07: Integration interfaces for automation and external tools.

## 13. Reliability and application quality

- QUALITY-01: **Partial** Playwright regression suite runs in real Chrome on Windows; Firefox and Safari verification remain pending.
- QUALITY-02: **Basic** document serialization, validation and history tests; broaden to geometry, gestures and layout.
- QUALITY-03: **Partial** captured dark editor screenshot reviewed; automated visual-diff baselines and explicit tolerances remain pending.
- QUALITY-04: **Pending** large-document benchmarks, culling, incremental rendering and memory budgets.
- QUALITY-05: **Pending** screen-reader labels audit, keyboard operation, contrast checks and reduced motion.
- QUALITY-06: **Pending** server access controls, auditability and private asset storage when backend features arrive.
- QUALITY-07: **Pending** consistent errors, loading states, import progress and recovery paths.
- QUALITY-08: **Pending** localization and platform-specific shortcut conventions.

## 14. Additional product scope

Track FigJam whiteboarding, Slides, Sites, Make, Draw, AI assistance, and organizational administration in separate reference investigations before promising equivalent functionality. Product names here identify areas to investigate; availability and exact capabilities require current verification. They are not included in the current editor milestone.

Implementation details and limits are recorded in [`donefun.md`](../donefun.md). All Basic items still require browser verification.

## Next implementation order

1. **Editing foundation:** multiselection, marquee, clipboard, full resize handles, gesture cancellation, fit-to-selection and selection history behavior. Acceptance: select three objects, move/resize/duplicate them together, undo once, and restore exact prior geometry.
2. **Document hierarchy:** pages, groups, real frames, reparenting, locking, visibility and clipping. Acceptance: nested content survives save/open and parent transforms without coordinate drift.
3. **Geometry and appearance:** pen paths, booleans, strokes, gradients, images and effects. Acceptance: structural and visual fixture checks at multiple zoom levels.
4. **Typography and layout:** inline editing, font handling, wrapping, constraints and auto layout. Acceptance: deterministic layout and text metrics across reference fixtures.
5. **Native file feasibility, in parallel with the early editor milestones:** collect authorized minimal `.fig` fixtures, document observed format behavior, and establish minimal editable import/export before scaling feature claims. No codec result has been demonstrated yet.
6. **Reusable design systems:** components, overrides, styles, variables and libraries.
7. **Prototyping:** flow graph, presentation runtime, interactions and animation.
8. **Backend and extensibility:** accounts, collaboration, sharing, version history, developer tools and plugins.

## Definition of done for each feature

Record its ID, reference behavior, implementation limits, tests, browser verification, and interoperability impact. A feature is complete only when its stated acceptance checks pass. Keep this inventory and `compatibility.md` synchronized. Native Figma compatibility additionally requires editable round-trip verification in both applications; screenshots or SVG exports alone do not qualify.



## Implementation architecture

Application code and tests now use strict TypeScript with Vite. Responsibilities are split into model, command, editor/controller, renderer, UI, interoperability and storage modules. See [ARCHITECTURE.md](ARCHITECTURE.md) for module ownership; append delivered changes to [donefun.md](../donefun.md).
