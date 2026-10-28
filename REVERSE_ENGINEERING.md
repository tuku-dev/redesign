# Figma-Compatible Editor: Engineering Rules

## Objective and Scope

Build an independently implemented design editor with Figma-like behavior and bidirectional, editable Figma Design `.fig` interchange. Treat exact parity as a goal requiring evidence, never as an assumption. Scope the initial target to Figma Design; track FigJam, Slides, and other products separately. Record the reference application version or observation date for every compatibility result.

## Reverse-Engineering Method

1. Use documents and accounts you own or are authorized to inspect. Study public documentation, observable application behavior, and locally exported fixtures. Do not use leaked source code, proprietary assets, or bypass access controls.
2. Create minimal fixtures with one feature at a time. Export a baseline, change one property, export again, and compare structure and bytes. Repeat observations before inferring a rule.
3. Record each finding in `docs/research/`: reproduction steps, input files, observed behavior, hypotheses, confidence, and counterexamples. Clearly separate confirmed facts from guesses.
4. Implement from recorded behavioral specifications. Track the provenance and licenses of any third-party implementation or format research reused.
5. Never infer compatibility merely from a filename, successful decoding, or one successful import.

## Compatibility Contract

- Maintain `docs/compatibility.md` with feature-level import, export, rendering, and editability results, including known losses and tested versions.
- Distinguish REST API JSON, plugin data, SVG/PDF exports, and native `.fig` files. Do not rename JSON or SVG to `.fig` or present an API-based bridge as native file compatibility.
- Investigate the native container, versioning, serialization, compression, assets, identifiers, and references from evidence. Do not invent a binary schema and call it compatible.
- Preserve hierarchy, geometry, transforms, vector paths, typography, images, paints, effects, clipping, layout, components, instances, styles, variables, and prototype relationships as each feature is implemented.
- Preserve unrecognized data only where proven safe. Warn about unsupported features before lossy export; never silently flatten editable content.
- A plugin bridge may be an explicitly labeled interim workflow. It does not satisfy native `.fig` export acceptance.

## Architecture and Implementation

Use a versioned internal document model independent of the UI and file codec. Separate document operations, rendering, layout, input handling, persistence, and collaboration. Keep import/export adapters isolated. Use stable identifiers and explicit migration rules. Model undo/redo as reversible document transactions.

Recommended directories, to create when implemented: `src/model/`, `src/editor/`, `src/render/`, `src/interop/`, `tests/fixtures/`, and `docs/research/`. Select the language and rendering stack after a prototype demonstrates text, vector, and layout fidelity.

Implement in stages: document model and codec feasibility; basic canvas editing; text and vectors; layout and components; variables and prototypes; collaboration. Establish working native interchange early, before claiming the broader product is compatible.

## Required Verification

For every supported feature, test both journeys:

1. Figma -> local `.fig` -> this editor -> edited `.fig` -> Figma.
2. This editor -> `.fig` -> Figma -> edited local `.fig` -> this editor.

Verify appearance, structure, property values, asset integrity, and continued editability. Use structural assertions and visual comparisons with documented tolerances; do not require byte-identical exports. Include non-ASCII text, missing fonts, nested transforms, large documents, and unsupported nodes. Record manual Figma verification when automation is unavailable.

Treat file inputs as untrusted: enforce limits on decompression, asset sizes, nesting, and parsing time. Reject malformed files without crashing or damaging the current document. Add regression fixtures for every codec defect.

## Completion and Reporting

Every change must identify the behavior implemented, evidence used, tests run, and remaining gaps. Never claim full Figma parity or universal compatibility until a defined, versioned acceptance matrix supports that claim. UI resemblance, collaboration parity, and file interoperability are separate deliverables.

## Reference Sources

- [Figma local file copies](https://help.figma.com/hc/en-us/articles/8403626871063-Save-a-local-copy-of-files): native local copies and reimport behavior.
- [Figma file API endpoints](https://developers.figma.com/docs/rest-api/file-endpoints/): documented JSON access; do not assume this specifies native `.fig` serialization.
- [Figma file imports](https://help.figma.com/hc/en-us/articles/360041003114-Import-files-to-the-file-browser): supported application import workflow.

Recheck documentation and observable behavior when the compatibility target changes.
