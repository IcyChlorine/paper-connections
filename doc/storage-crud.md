# Paper Connections Storage and CRUD

Date: 2026-03-06  
Target: Zotero 7 (`src`)

## 1. Storage backend

- Backend: `Zotero.SyncedSettings`
- Setting key: `paper-connections.graph.v1`
- Scope: per `libraryID` (not global preference)
- Sync behavior: uses Zotero synced settings channel (library-scoped)
- One-time migration in this release:
  - `migrateLegacyStoreOnce(libraryID)` runs before normal store reads.
  - Converts legacy `paper-relations.graph.v1` payloads and schema-tagged / metadata-era stores into the canonical current payload.
  - Canonical payload has no top-level `schemaVersion` and no legacy `topic.bundles` metadata.
  - After migration, normal runtime paths read and write only the canonical shape under `paper-connections.graph.v1`.

## 2. Canonical store shape

Top-level JSON shape:

```json
{
  "topics": {
    "<topicID>": {
      "id": "<topicID>",
      "libraryID": 1,
      "name": "Topic name",
      "createdAt": 1730000000000,
      "updatedAt": 1730000000000,
      "nodes": {
        "<paperNodeID>": {
          "id": "<paperNodeID>",
          "nodeType": "paper",
          "libraryID": 1,
          "itemKey": "ABCD1234",
          "title": "Paper title",
          "shortLabel": "",
          "note": "",
          "x": 120,
          "y": 100,
          "createdAt": 1730000000000,
          "updatedAt": 1730000000000
        },
        "<bundleNodeID>": {
          "id": "<bundleNodeID>",
          "nodeType": "bundle",
          "x": 236.5,
          "y": 180.2,
          "slopeMode": "flat",
          "createdAt": 1730000000000,
          "updatedAt": 1730000000000
        }
      },
      "edges": {
        "<edgeID>": {
          "id": "<edgeID>",
          "fromNodeID": "<nodeID>",
          "toNodeID": "<nodeID>",
          "type": "related",
          "note": "",
          "createdAt": 1730000000000,
          "updatedAt": 1730000000000
        }
      }
    }
  },
  "itemTopicIndex": {
    "1/ABCD1234": ["<topicID>"]
  }
}
```

Notes:
- Canonical store has no top-level `schemaVersion` field.
- Canonical store has no legacy `topic.bundles` metadata.
- `itemTopicIndex` only indexes `nodeType="paper"` nodes.
- `slopeMode` allowed values: `flat` (default) / `free`.

## 3. Implemented CRUD API

Implemented in `src/storage.js`, consumed by:
- `src/graph-topic.js`
- `src/graph-interaction.js`
- `src/graph-export.js`

### Topic CRUD

- `listTopics(libraryID)`
- `getTopic(libraryID, topicID)`
- `getTopicsForItem(libraryID, itemKey)`
- `createTopic(libraryID, { name, centerItem })`
- `updateTopic(libraryID, topicID, patch)`
- `deleteTopic(libraryID, topicID)`

### Node CRUD

- `addNode(libraryID, topicID, nodeInput, options = {})`
  - default `nodeType` is `paper`.
  - `bundle` nodes are used as real middle hubs.
- `updateNode(libraryID, topicID, nodeID, patch)`
  - paper node: supports `shortLabel/note/title/x/y`.
  - bundle node: supports `x/y/slopeMode`.
- `removeNode(libraryID, topicID, nodeID)`
- `listNodes(libraryID, topicID)`

### Edge CRUD

- `addEdge(libraryID, topicID, edgeInput)`
- `updateEdge(libraryID, topicID, edgeID, patch)`
- `removeEdge(libraryID, topicID, edgeID)`
- `listEdges(libraryID, topicID)`

### Bundle-node operations

- `applyBundleGroups(libraryID, topicID, groups, options)`
  - creates real `bundle` nodes,
  - rewrites grouped hit edges to `bundleNode -> target`,
  - creates trunk edges `source -> bundleNode`.
- `dissolveBundleNode(libraryID, topicID, bundleNodeID)`
  - requires `bundleNode` in-degree exactly `1`,
  - rewires predecessor to each outgoing target and removes hub.
- `analyzeBundleTopology(topic)`
  - reports bundle topology issues/warnings (multi-inbound detection).

### Deprecated compatibility wrappers

These remain as wrappers only and should not be used by new logic:
- `listBundles(...)`
- `createBundle(...)`
- `updateBundle(...)`
- `deleteBundle(...)`
- `replaceBundles(...)`

## 4. One-time migration and normalization

- `migrateLegacyStoreOnce(libraryID)` runs before normal `loadStore()` reads the current key.
- Legacy sources handled by the migration step:
  - old namespace key `paper-relations.graph.v1`
  - stores that still contain top-level `schemaVersion`
  - topics that still contain metadata-era `bundles`
  - legacy bundle nodes with `slopeMode: "matched"`
- Migration rewrites legacy bundle metadata into canonical real graph entities:
  - each legacy bundle becomes a real `bundle` node,
  - member edges are rewritten to originate from that hub,
  - a trunk edge `source -> hub` is created,
  - legacy `topic.bundles` is dropped,
  - legacy slope mode `matched` maps to canonical `free`.
- Migration rebuilds `itemTopicIndex` and writes the canonical payload back under `paper-connections.graph.v1`.
- If the current key already exists but is empty while the legacy key still has data, migration prefers the legacy data once so old user data is not masked by an empty new-key placeholder.
- After that migration step, normal runtime code only reads/writes the canonical store shape; it does not keep separate v1/v2 branches in steady-state logic.
- `normalizeStore()` still performs lightweight canonical cleanup on current data (for example invalid endpoints or stale index cleanup), but not legacy-format branching.

## 5. Data integrity rules

- Stable paper identity uses `libraryID + itemKey`.
- Duplicate paper nodes in same topic are skipped.
- Edge endpoints must reference existing nodes.
- Removing a node removes all incident edges.
- After edge/node mutation, only isolated bundle hubs (`in=0 && out=0`) are auto-removed.
- Multi-inbound bundle hubs are warned, not auto-repaired.

## 6. Frontend integration notes

- Shift+RMB bundling persists real graph edits through `applyBundleGroups(...)`.
- Hub drag persists by `updateNode(...)` on `bundle` node.
- Hub dissolve uses `dissolveBundleNode(...)`.
- JSON export contains canonical topic data directly (`{ "topic": ... }`, no top-level `schemaVersion`, no `topic.bundles`).

## 7. Known constraints

- No visual topic chooser yet for papers in multiple topics.
- No dedicated edge-editing UI yet (API exists).
- Multi-inbound bundle hubs are not auto-corrected by storage.

## 8. Remark storage

- Scope: per Zotero item (not in `paper-connections.graph.v1`).
- Backend: Zotero item field `extra`.
- Format: `remark: <text>` line.
- Ethereal Style-compatible and migration-supported.