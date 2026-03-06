# Paper Connections Storage and CRUD

Date: 2026-03-06  
Target: Zotero 7 (`src`)

## 1. Storage backend

- Backend: `Zotero.SyncedSettings`
- Setting key: `paper-connections.graph.v1`
- Legacy compatibility: if the new key is empty, runtime falls back to `paper-relations.graph.v1` and rewrites the normalized store into the new key
- Scope: per `libraryID` (not global preference)
- Sync behavior: uses Zotero synced settings channel (library-scoped)

## 2. Store schema (v2)

Top-level JSON shape:

```json
{
  "schemaVersion": 2,
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
- Legacy `topic.bundles` metadata is removed in v2.
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

## 4. Migration and normalization

- `loadStore()` performs normalization and auto-migration.
- During rename rollout, `loadStore()` first tries `paper-connections.graph.v1` and falls back to legacy `paper-relations.graph.v1`.
- If legacy data is loaded, the normalized store is persisted back under `paper-connections.graph.v1`.
- If store is v1 (or topic still has legacy `bundles`):
  - each legacy bundle becomes a real `bundle` node,
  - member edges are rewritten to originate from the new hub,
  - a trunk edge `source -> hub` is created,
  - legacy `topic.bundles` is removed.
- Store is rewritten with `schemaVersion = 2` after migration.

## 5. Data integrity rules

- Stable paper identity uses `libraryID + itemKey`.
- Duplicate paper nodes in same topic are skipped.
- Edge endpoints must reference existing nodes.
- Removing a node removes all incident edges.
- After edge/node mutation, only isolated bundle hubs (`in=0 && out=0`) are auto-removed.
- Multi-inbound bundle hubs are warned, not auto-repaired.

## 6. Frontend integration notes

- Shift+RMB bundling now persists real graph edits through `applyBundleGroups(...)`.
- Hub drag persists by `updateNode(...)` on `bundle` node.
- Hub dissolve uses `dissolveBundleNode(...)`.
- JSON export contains v2 node/edge model directly (no `topic.bundles`).

## 7. Known constraints

- No visual topic chooser yet for papers in multiple topics.
- No dedicated edge-editing UI yet (API exists).
- Multi-inbound bundle hubs are not auto-corrected by storage.

## 8. Remark storage

- Scope: per Zotero item (not in `paper-connections.graph.v1`).
- Backend: Zotero item field `extra`.
- Format: `remark: <text>` line.
- Ethereal Style-compatible and migration-supported.
