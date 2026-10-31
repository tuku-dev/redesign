# Editor Feature Guide

## Auto layout

Select layers and use **Add auto layout** (Shift+A). A new frame wraps loose layers. Choose horizontal or vertical flow, independent padding, gap, cross alignment and distribution. Frames can hug contents or use fixed dimensions; children can fill available width/height. Changes to child geometry, visibility and sibling order recalculate layout. Nested frames are supported. Wrapping, grid auto layout, min/max sizing and intrinsic text sizing remain pending.

## Components and instances

Select a frame or loose layers and choose **Create component** (Ctrl/Cmd+Alt+K). Use **Create instance**, or the main-component selector under **Tools & resources**, to insert a linked copy. Main edits propagate across pages; instance edits override inherited fields. **Reset overrides** restores the main's values; **Detach instance** (Ctrl/Cmd+Alt+B) removes links. Source deletion detaches surviving instances. Nested component swaps, variants and external libraries remain pending.

## Images

Use **Insert image**, drop raster files onto the canvas, or select a frame, rectangle or ellipse and choose **Set image fill**. Image fills are clipped to the selected shape (including its corner radius). PNG, JPEG, WebP and GIF files up to 8 MB are embedded in the document. Choose crop/cover, fit or stretch; crop X/Y values move the focal point from 0 to 1. The image inspector provides non-destructive brightness, contrast and saturation controls from 0% to 200%, with a reset action. Images survive save/open and SVG export. Document imports allow up to 100 MB; browser autosave remains subject to storage quota, so download image-heavy documents. Animated GIF playback follows browser behavior. Clipboard raster import and tiling remain pending.

## Rulers, guides and grids

Expand **Tools & resources** and choose **Show rulers** (Shift+R). Drag from a ruler to create a guide, drag guides to move them, double-click to remove, or use numeric guide controls. Escape cancels a drag. Visible guides participate in geometry snapping; Ctrl bypasses snapping. Select a frame to show a square, column or row layout grid in the inspector. Rulers, guides and frame grids are editor overlays and excluded from exports. Guides are currently document-wide.

## Numeric controls and corner radii

Drag horizontally on a numeric field's label to scrub its value. Hold Shift for larger steps or Alt for finer steps; click the field to type a value. Only rectangles and frames expose corner-radius fields and canvas handles. The hollow canvas handles use the blue `#10a1cf` accent. Drag diagonally to change all corners together; double-click a handle to select that corner, then drag diagonally to adjust it alone. Setting the uniform radius links all corners again.

With multiple layers selected, X, Y, W and H fields show a shared value or **Mixed**. Entering a value applies that coordinate or dimension to each selected root; moving a frame also moves its descendants, and resizing a frame continues to honor child constraints.

Use **Apply fill** beside Fill to paint the current color onto a clicked canvas layer. The eyedropper at the bottom-center toolbar samples a clicked layer's fill onto the current selection; Shift-click samples its stroke. Press Escape to cancel.

Use the **Snap to grid** icon above the canvas to snap drawing and layer movement to the 8-unit grid. Geometry snapping can be toggled separately.

## Align and justify

Select two or more layers to show alignment controls in the Properties panel. **Align Objects** aligns layers to the selection's left, horizontal center, right, top, vertical center or bottom. With three or more layers, **Distribute Objects** spaces the selected edges or centers evenly while keeping the outer layers in place; **Distribute Spacing** instead equalizes the gaps between layers. Hover over an icon for its tooltip; each icon also has an accessible name.

## Styling

Fill and Stroke controls sit together in the inspector; Stroke's enable toggle, visible color picker and width share one row. The inspector also provides two-color linear gradients with angle, a drop shadow and layer blur. Color edits preview live while the picker is open. Shadows expose offset, blur, color and opacity. Canvas and SVG export share paint definitions; conservative effect bounds protect export edges. These are shape paints: radial/complex gradients, effect stacks, inner shadows, background blur and arbitrary group effects remain pending.

## Vector editing

Choose the **Pen tool** icon in the bottom canvas toolbar (P), then click for corner points or click-drag for smooth Bezier points with mirrored tangent handles. Shift constrains a segment to 45-degree increments. Click the first vertex or use Shift+Enter/**Close path** to close; Enter/**Finish path** creates an open path. Escape cancels; Backspace removes the last draft point. Double-click the shape or its stroke to enter point editing. You can also select it and press **Enter**, click the visible **Edit vector** action on the canvas, or use **Tools & resources > Edit points**. The **Editing vector** bar confirms the mode, and resize handles are replaced by anchors and tangent handles. Click **Done** or press **Escape** to leave point editing. Moving an anchor carries its handles. Smooth handles stay aligned; Alt-drag adjusts one independently, and Alt-click an anchor removes its handles. Double-click an anchor or use its inspector Smooth/Corner button to convert it. Numeric controls edit normalized anchors and handles. Curve bounds include exact cubic extrema so exports are not clipped.

Select closed rectangles, ellipses or paths and choose **Union**, **Intersect**, **Subtract** or **Exclude**. Subtract uses document stacking order: the lowest selected shape is the subject. Operations produce editable compound paths and holes; undo restores operands. Ellipses and rounded corners use polygon approximations. SVG export preserves cubic Bezier commands. Boolean operations adaptively flatten curves; vector networks and live boolean operands remain pending.

## Pages

Use the left **Pages** section to create, rename, duplicate, reorder, switch or delete pages. One page must remain. Page duplication gives layers fresh IDs and remaps internal parent, component and prototype links. Page changes are undoable and included in local autosave/downloaded `.redesign` documents. The viewport is currently shared across pages.

## Prototypes

Select a hotspot layer, choose an **On click** destination frame, then select instant or dissolve and a duration. Top-level frames on any page can be destinations. Select a starting screen and choose **Present prototype**. Click or keyboard-activate hotspots; use **Back**, **Restart**, **Close preview**, or Escape. Presentation does not change editor history, page selection or saved data. Reduced-motion preferences suppress dissolve animation. Advanced triggers, overlays, scrolling, smart animation and sharing remain pending.

## Verification and compatibility

Run `npm test` for geometry, document, command and undo regressions. Run `npm run test:e2e` for real Chrome interactions, image/file workflows, exports and prototype navigation. Type checks, lint, formatting and production builds are separate commands listed in the README. Chrome tests do not establish Firefox/Safari support or Figma parity. Native `.fig` import/export remains a separate, unimplemented milestone.

## Save and Save As

Use Ctrl+S to save. Supporting browsers connect a disk file on the first save and reuse that destination; opening through the native file picker also retains the handle. Ctrl+Shift+S chooses a new destination. Other browsers save in browser storage with Ctrl+S; use Download copy for an explicit disk download through the app dialog. Downloaded copies cannot be updated automatically. Header tooltips, button names and save status identify the active workflow. No browser prompt is used. File handles currently last for the tab session; native OS dialogs and permission prompts are controlled by the browser.
