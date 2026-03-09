# Session Summary (2026-03-05a)

## 1. Shift+RMB Edge Bundle interaction

- Added `Shift + right-drag` bundle gesture in Relation Graph Workspace (saved topics only).
- While dragging, workspace renders dotted bundle path preview.
- On release, intersected edges are grouped by `fromNodeID` (source node), and only groups with `>= 2` edges create bundles.
- New bundle hub position is the centroid of edge/path intersection points in that group.
- Existing bundle memberships are re-bound by newest gesture:
  - hit edges are removed from old bundles,
  - then attached to new bundle(s),
  - old bundles with `<2` members are auto-removed.

## 2. Bundle hub behavior

- Added hover-near reveal for bundle hub (black dot), and hide-on-leave behavior.
- Added left-drag hub move with current snap policy:
  - snap enabled -> grid-snapped hub position,
  - snap disabled -> free move.
- Added bundle hub right-click menu with single action:
  - `Dissolve` (`溶解`) removes that bundle metadata and restores direct edge rendering.

## 3. Data model and storage updates

- Extended topic schema with optional `bundles` map under each topic.
- Implemented bundle storage APIs in `src/storage.js`:
  - `listBundles`
  - `createBundle`
  - `updateBundle`
  - `deleteBundle`
  - `replaceBundles` (batch replace, used by gesture flow)
- Added normalization/cleanup constraints:
  - one edge belongs to at most one bundle,
  - bundle edge must exist and match `sourceNodeID`,
  - bundles with fewer than 2 edges are removed.
- `removeEdge` / `removeNode` now trigger bundle cleanup.

## 4. Rendering and export consistency

- Refactored render flow to use bundle-aware visible edge geometry:
  - direct edges,
  - bundle trunk (`source -> hub`),
  - bundle branches (`hub -> target`).
- Added reusable curve/segment intersection-point extraction helpers (used by cut/bundle).
- SVG export now follows current bundle visuals and includes bundle hub dots.
- JSON export now includes `topic.bundles`.

## 5. State wiring and UX integration

- Extended graph pane state with bundle interaction fields:
  - modifier state (`shiftModifierPressed`),
  - bundle draft/hover/drag/context fields,
  - bundle menu references.
- Added bundle context-menu DOM + handler wiring in workspace mount/unmount lifecycle.
- Updated outside-click closing logic to include bundle menu.
- Added cursor state class for bundle-ready mode and new bundle-related styles.

## 6. Updated docs

- Updated `doc/current-features.md` with Shift+RMB bundle behavior and export results.
- Updated `doc/storage-crud.md` with `topic.bundles` schema and bundle CRUD contracts.
