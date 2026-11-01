# Native Figma import: first editable subset

Observed and implemented on 2026-11-01. This is experimental native **import**, not native export or verified Figma round-trip compatibility. Figma Design is the target; other Figma products are excluded.

## Evidence and provenance

The format is undocumented and can change. [Evan Wallace's public parser](https://madebyevan.com/figma/fig-file-parser/) identifies this as an internal format. [Kiwi's author documentation](https://github.com/evanw/kiwi) defines its wire primitives and embedded schemas. The [Sketch fig2sketch reader](https://github.com/sketch-hq/fig2sketch/blob/450e3b350a6f9cf05d659459cf240def6b7f0483/src/figformat/kiwi.py) provides an independently inspectable native reader. [OpenFig's parser](https://github.com/OpenFig-org/openfig-core/blob/0d67354fcd6d14c37b89c42f55330faf0a79e1ce/src/parser.ts) corroborates container/chunk handling. Those implementations are evidence, not proof of our fidelity.

Two public fixtures from Sketch revision `450e3b350a6f9cf05d659459cf240def6b7f0483` are bundled with its MIT notice in `tests/fixtures/fig/`. They were not exported from our own Figma account, and we have not independently reimported them into Figma. Their header writer versions are **48** and **106**; these are not Figma application release numbers.

## Confirmed by our decoder and regression fixtures

- ZIP central directories identify a root `canvas.fig`. Local size fields may use descriptors; the reader uses central sizes. Stored and DEFLATE entries work. Extracted canvas size and CRC32 must match.
- Bare streams begin with eight ASCII bytes `fig-kiwi`, followed by a little-endian uint32 version and length-prefixed compressed chunks. Chunk 0 contains the binary Kiwi schema; chunk 1 contains its `Message` snapshot.
- Both fixtures use raw DEFLATE schemas. The older message uses DEFLATE; the newer uses Zstandard. The reader sniffs Zstandard magic, checks frame/window bounds, then decompresses.
- Schema interpretation yields `NODE_CHANGES`, `guid`, `parentIndex`, `size`, `transform`, paints and related properties. No runtime source generation or evaluation is used. Synthetic tests cross-check wire primitives against the MIT `kiwi-schema` encoder.
- GUIDs become stable `fig:sessionID:localID` IDs. Siblings sort by parent position. Local matrices compose through ancestors; orthogonal transforms become world geometry/rotation/reflection. Sheared or singular subtrees are skipped with a warning.

## Editable conversion and known losses

| Feature | Current conversion |
| --- | --- |
| Pages | Public CANVAS entries; internal-only pages excluded |
| Frames/groups | Hierarchy, positions, supported transforms, visibility and locking |
| Rectangles/ellipses | Geometry, circular corner radii, solid fill/stroke and independent paint alpha |
| Text | Plain characters, one font/style/size, basic alignment/spacing; installed-font metrics may differ |
| Layout | Existing positions only; responsive auto layout and constraints are not preserved |
| Components/instances/vectors | Unsupported subtrees skipped and counted |
| Images/gradients/effects | Not converted; encountered paints/effects disclosed |
| Variables/styles/prototypes | Not preserved |
| Native export | Unimplemented; the original binary is not retained for lossless rewriting |

The real `corners.fig` fixture yields **6 imported / 4 skipped** layers and a corner-smoothing warning. `structure.fig` yields **10 imported / 13 skipped** layers and paint/effect warnings. These are subset counts, not fidelity scores. Per-corner arcs substitute for Figma smoothing; centered strokes approximate inside/outside strokes. Nonuniform/reflected text can differ. Exact rich text and font shaping remain unverified.

## Input limits and failure behavior

A dedicated browser worker is terminated after 15 seconds. Input is capped at 100 MB; canvas/message/window at 64 MB each; schema at 2 MB; declared ZIP expansion at 128 MB and 1024 entries. Additional limits cover schema fields, decoded values/arrays/strings, 128 hierarchy levels, 100 pages and 10000 editable layers. Streaming decompression bounds output; names, framing, references and model values are validated. ZIP64, encrypted/split archives, concatenated Zstandard frames, dictionaries, duplicate/incremental node records and old writer versions below 15 fail explicitly.

The editor opens nothing until a review dialog is accepted. Errors, cancellation and timeout leave existing work intact. Native source handles are discarded so `.redesign` saving cannot overwrite a `.fig` source. Imports add a document unless replacing an untouched blank. No files are uploaded.

## Next acceptance gates

1. Add authorized minimal fixtures for vectors, images, text styles, components and current Figma exports. Expand conversion with explicit loss reporting.
2. Design native encoding around observed schemas and required invariants; do not invent a schema or rename JSON to `.fig`.
3. Verify exported files open in Figma with editable layers, then test both edited round trips. Record Figma date/version, reference files, structural checks and visual tolerances before claiming compatibility.
