# Compatibility and Product Scope

reDesign is a web app. Target Figma Design's editor behavior, rendering, shortcuts, editable document semantics, and bidirectional native file compatibility. Treat parity as an ongoing acceptance program. No native Figma round trips have been verified.

| Feature | Current state | Required next validation |
| --- | --- | --- |
| Web editor shell | Implemented, browser QA pending | Desktop interaction and responsive layout |
| Basic shapes and text | Implemented, browser QA pending | Geometry, typography, hit testing |
| Move, resize, layers, history | Single/multiple selection, marquee, batch move/resize/duplicate/delete, and gesture cancellation implemented | Gesture and transaction regression tests |
| Local documents | Version 1 `.redesign` JSON | Tested model round trip; browser file workflow pending |
| SVG export | Implemented, browser QA pending | Visual checks and Figma SVG import |
| Hierarchical frames and groups | Basic frame parenting, nested layers, subtree movement/duplicate/delete, drop reparenting and legacy migration; groups, group/frame selection and ungrouping implemented | Browser verification, layout fidelity and local-coordinate transforms |
| Vector paths and booleans | Pending | Geometry and winding fixtures |
| Typography and fonts | Inline editing, font family/weight/style, line height, spacing, alignment and wrapping implemented | Browser font metrics, shaping, rich text, font import and auto sizing |
| Auto layout and constraints | Five child constraint modes on each axis implemented; auto layout pending | Browser fixture comparison and advanced transforms |
| Components, instances, variants | Pending | Overrides and nested instance preservation |
| Styles, variables, libraries | Pending | References, modes, publishing |
| Prototyping and animation | Pending | Triggers, transitions, interactions |
| Multiplayer, comments, history | Pending | Server architecture and consistency |
| Plugins and developer tools | Pending | API contracts and sandboxing |
| Native `.fig` import/export | Research pending | Both editable round trips in Figma |
| Additional Figma products | Separate scope, pending | Product-specific acceptance matrices |

## Acceptance rules

Record reference dates/versions, fixtures, evidence, and tolerances per feature. Verify appearance, values, editability, and behavior independently. Native interchange must pass Figma -> reDesign -> Figma and reDesign -> Figma -> reDesign after edits. Report unsupported features before lossy conversion. Do not claim full compatibility based on SVG or screenshots.

## Sources

- https://developers.figma.com/docs/rest-api/file-endpoints/
- https://help.figma.com/hc/en-us/articles/360040451373-Guide-to-auto-layout-in-Figma
- https://www.figma.com/prototyping/

These describe reference capabilities; they do not establish this implementation's parity.

