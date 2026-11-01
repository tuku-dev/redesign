# Compatibility and Product Scope

reDesign is a web app. Target Figma Design's editor behavior, rendering, shortcuts, editable document semantics, and bidirectional native file compatibility. Treat parity as an ongoing acceptance program. No native Figma round trips have been verified.

| Feature | Current state | Required next validation |
| --- | --- | --- |
| Web editor shell | Implemented; core Chrome workflows tested | Desktop interaction and responsive layout |
| Basic shapes and text | Implemented, browser QA pending | Geometry, typography, hit testing |
| Move, resize, layers, history | Single/multiple selection, marquee, batch move/resize/duplicate/delete, and gesture cancellation implemented | Gesture and transaction regression tests |
| Local documents | Version 1 `.redesign` JSON | Model and multi-page Chrome save/open round trips tested |
| SVG export | Implemented, browser QA pending | Visual checks and Figma SVG import |
| Hierarchical frames and groups | Basic frame parenting, nested layers, subtree movement/duplicate/delete, drop reparenting and legacy migration; groups, group/frame selection and ungrouping implemented | Browser verification, layout fidelity and local-coordinate transforms |
| Vector paths and booleans | Straight/cubic Bezier pen paths, editable anchors/handles, polygon booleans and holes | Chrome drawing/editing and numerical geometry tests pass; live booleans and vector networks pending; boolean curves are adaptively polygonized |
| Typography and fonts | Inline editing, font family/weight/style, line height, spacing, alignment and wrapping implemented | Browser font metrics, shaping, rich text, font import and auto sizing |
| Auto layout and constraints | Five child constraints plus horizontal/vertical auto layout, padding/gaps, fixed/hug/fill and nesting | Browser fixture comparison and advanced transforms |
| Components, instances, variants | Main components, linked instances, overrides, reset and detach tested | Nested swaps, variants and full Figma behavior remain pending |
| Styles, variables, libraries | Pending | References, modes, publishing |
| Prototyping and animation | Click navigation, instant/dissolve, modal preview, back and restart tested | Advanced triggers, smart animation, sharing and device presets pending |
| Multiplayer, comments, history | Pending | Server architecture and consistency |
| Plugins and developer tools | Pending | API contracts and sandboxing |
| Native `.fig` import | Experimental editable subset: pages, frames/groups, rectangles, ellipses and plain text; ZIP/bare Kiwi, DEFLATE/Zstandard; review before lossy conversion | Broader authorized fixtures, vectors/assets/components, text fidelity and Figma reference checks |
| Native `.fig` export | Not implemented | Both editable round trips in Figma |
| Additional Figma products | Separate scope, pending | Product-specific acceptance matrices |

## Acceptance rules

Record reference dates/versions, fixtures, evidence, and tolerances per feature. Verify appearance, values, editability, and behavior independently. Native interchange must pass Figma -> reDesign -> Figma and reDesign -> Figma -> reDesign after edits. Report unsupported features before lossy conversion. Do not claim full compatibility based on SVG or screenshots.

## Sources

- https://developers.figma.com/docs/rest-api/file-endpoints/
- https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma
- https://www.figma.com/prototyping/

These describe reference capabilities; they do not establish this implementation's parity.


Native import evidence, limits and fixture counts are recorded in [research/native-fig.md](research/native-fig.md). Import is partial and does not establish export compatibility.
