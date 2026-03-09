# Session Summary (2026-03-05b)

## 1. Bundle model refactor to real graph entities

- Removed runtime/storage dependency on legacy `topic.bundles` metadata.
- Bundle hubs are now real nodes in `topic.nodes`:
  - `nodeType: "bundle"`
  - persisted `x/y/slopeMode`.
- Bundle links are now real edges in `topic.edges`:
  - incoming trunk `source -> bundleNode`
  - outgoing branch `bundleNode -> target`
- Supports nested chaining naturally (bundle on edges from bundle nodes).

## 2. Storage schema upgrade and migration

- Upgraded `schemaVersion` to `2`.
- `loadStore()` now normalizes and auto-migrates v1 data:
  - converts legacy bundle metadata into real bundle nodes + real edges,
  - removes `topic.bundles`,
  - rewrites store back in v2 shape.
- `itemTopicIndex` now only indexes `paper` nodes.

## 3. New storage APIs

- Added `applyBundleGroups(libraryID, topicID, groups, options)`.
- Added `dissolveBundleNode(libraryID, topicID, bundleNodeID)`.
- Added `analyzeBundleTopology(topic)`.
- Deprecated metadata-era bundle APIs retained only as compatibility wrappers.

## 4. Interaction/render/export updates

- Shift+RMB bundle now:
  - groups by `fromNodeID`,
  - creates bundle node even for single-edge groups,
  - persists through `applyBundleGroups(...)`,
  - reloads topic state after mutation.
- Hub drag persists via `updateNode(...)` on bundle nodes.
- Hub context actions:
  - `Dissolve` calls `dissolveBundleNode(...)`
  - `Flat Tangent` toggles bundle node `slopeMode`.
- Curve generation now applies bundle constraints per endpoint:
  - `flat` => slope 0 at hub side
  - `free` => hub-side handle length 0
- SVG export keeps hub dots hidden and arrow marker `stroke="none"`.

## 5. Topology warning and cleanup policy

- Added multi-inbound bundle warning flow (load / bundle / dissolve paths).
- No automatic repair for multi-inbound hubs.
- Only isolated bundle hubs (`0 in` and `0 out`) are auto-cleaned.

## 6. Documentation sync

- Updated `doc/current-features.md` for real-node bundle behavior.
- Rewrote `doc/storage-crud.md` for schema v2 and new APIs.
