# Graph Render / Refresh API

## Purpose
- This document defines the frontend render/refresh contract for the `Relation Graph Workspace`.
- It exists to keep future interaction work off the old pattern of "any UI change => rebuild the whole SVG DOM".

## Layer Split
- `refreshGraph(window)`
  - Heavy path.
  - Rebuilds graph DOM from current state.
  - Recomputes node render metrics.
  - Recreates DOM lookup caches.
  - Use for structural or context-wide changes only.
- `updateNodeDOM(window, nodeID, { propagate })`
  - Light path for one node or one bundle hub.
  - Updates existing DOM in place.
  - Optionally propagates to related edges.
- `updateEdgeDOM(window, edgeID, { propagate })`
  - Light path for one edge path.
  - Recomputes current bezier geometry and marker state.

## State Caches
- `state.nodeElemsByID`
  - `nodeID -> <g class="paper-connections-node">`
- `state.edgeElemsByID`
  - `edgeID -> <path class="paper-connections-edge">`
- `state.bundleHubElemsByID`
  - `bundleID -> <circle class="paper-connections-bundle-hub">`

These caches are recreated by `refreshGraph(window)` and reused by incremental DOM updates.

## API Details

### `refreshGraph(window)`
Use when the set of rendered elements may change.

Typical callers:
- topic switch
- temporary-topic apply
- graph reload from storage
- add/remove node
- add/remove edge
- cut edges
- create bundle
- dissolve bundle
- workspace first mount

Responsibilities:
- clear and rebuild `edgesGroup`, `nodesGroup`, `overlayGroup`
- recompute `node.renderWidth`, `node.renderHeight`, `node.renderLabelLines`
- recreate DOM caches
- rebuild draft overlays that are still treated as render-time overlays

### `updateNodeDOM(window, nodeID, { propagate = false })`
Use when a node already exists in DOM and only its local presentation changed.

Updates:
- node class (`root` / `leaf` / `selected` / `renaming`)
- node transform
- rect width/height
- title/text/tspans
- anchor positions and active state
- bundle hub position/visibility when `nodeID` is a bundle node

Return value:
- `true` if node geometry changed materially
- `false` otherwise

Propagation:
- `false`
  - update only the node/bundle itself
- `"bundle"`
  - update direct incident edges
  - if those edges touch bundle nodes, also update sibling edges around those bundle hubs
  - does not recurse through the whole graph

Typical callers:
- node selection/deselection
- rename preview while typing
- node drag move
- node drag mouseup snap/persist
- bundle hub drag move
- bundle slope-mode toggle
- remark-driven label refresh

### `updateEdgeDOM(window, edgeID, { propagate = false })`
Use when an existing edge still exists structurally but its geometry or endpoint state changed.

Updates:
- path `d`
- `marker-end`
- `marker-start`

Return value:
- `true` if edge DOM geometry/state changed
- `false` otherwise

Propagation:
- `false`
  - update only the specified edge
- `"bundle"`
  - update sibling edges around bundle endpoints

## Current Helper Boundary
These still remain lightweight helpers and should not trigger a full graph refresh for pure visibility changes:
- `applyAnchorVisibilityToDOM(state)`
- `applyBundleVisibilityToDOM(state)`
- `updateAnchorVisibilityForNodeElement(state, nodeID)`
- `updateBundleVisibilityForHubElement(state, bundleID)`

## Usage Rule of Thumb
- If DOM membership changes, call `refreshGraph(window)`.
- If a node, hub, or edge is still the same logical element and only its appearance/geometry changed, call `updateNodeDOM(...)` or `updateEdgeDOM(...)`.
- Do not call heavy refresh from high-frequency pointer flows unless the operation is genuinely structural.

## Why This Split Exists
- Preserves DOM continuity for native interaction chains such as `click` / `dblclick`.
- Reduces unnecessary full-SVG rebuilds during drag and rename.
- Keeps structural rebuild logic explicit instead of accidental.

## Related Files
- `src/graph-render.js`
- `src/graph-interaction.js`
- `src/graph-topic.js`
- `src/graph-export.js`
- `src/graph-workspace.js`
