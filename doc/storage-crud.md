# Paper Connections Storage and CRUD

Date: 2026-03-06  
Target: Zotero 7 (`src`)

## 1. Storage backend

- Backend: `Zotero.SyncedSettings`
- Setting key: `paper-connections.graph.v1`
- Scope: per `libraryID` (not global preference)
- Sync behavior: uses Zotero synced settings channel (library-scoped)
- Native Zotero related items (`dc:relation`) are not the primary backend because they do not preserve typed edges or graph-local metadata.
- Direct Zotero SQLite writes are out of scope; storage mutation goes through Zotero APIs.

## 2. Store shape

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

## 4. Data integrity rules

- Stable paper identity uses `libraryID + itemKey`.
- Duplicate paper nodes in same topic are skipped.
- Edge endpoints must reference existing nodes.
- Removing a node removes all incident edges.
- After edge/node mutation, only isolated bundle hubs (`in=0 && out=0`) are auto-removed.
- Multi-inbound bundle hubs are warned, not auto-repaired.

## 5. Frontend integration notes

- Shift+RMB bundling persists real graph edits through `applyBundleGroups(...)`.
- Hub drag persists by `updateNode(...)` on `bundle` node.
- Hub dissolve uses `dissolveBundleNode(...)`.
- JSON export writes topic data directly as `{ "topic": ... }`.

## 6. Known constraints

- No visual topic chooser yet for papers in multiple topics.
- No dedicated edge-editing UI yet (API exists).
- Multi-inbound bundle hubs are not auto-corrected by storage.

## 7. Remark storage

- Scope: per Zotero item (not in `paper-connections.graph.v1`).
- Backend: Zotero item field `extra`.
- Format: `remark: <text>` line.
