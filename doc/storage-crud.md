# Paper Relations Storage and CRUD

Date: 2026-03-04  
Target: Zotero 7 (`src`)

## 1. Storage backend

- Backend: `Zotero.SyncedSettings`
- Setting key: `paper-relations.graph.v1`
- Scope: per `libraryID` (not global preference)
- Sync behavior: uses Zotero synced settings channel (library-scoped)

## 2. Store schema

Top-level JSON shape:

```json
{
  "schemaVersion": 1,
  "topics": {
    "<topicID>": {
      "id": "<topicID>",
      "libraryID": 1,
      "name": "Topic name",
      "createdAt": 1730000000000,
      "updatedAt": 1730000000000,
      "nodes": {
        "<nodeID>": {
          "id": "<nodeID>",
          "libraryID": 1,
          "itemKey": "ABCD1234",
          "title": "Paper title",
          "shortLabel": "",
          "note": "",
          "x": 120,
          "y": 100,
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
- `itemTopicIndex` key format is `${libraryID}/${itemKey}`.
- One paper can belong to multiple topics via index array.

## 3. Implemented CRUD API

Implemented in `src/storage.js` (storage/CRUD), and consumed by graph runtime mixins in:
- `src/graph-topic.js` (topic lifecycle/context loading),
- `src/graph-interaction.js` (edge/node interaction persistence),
- `src/graph-export.js` (topic export payload assembly).

### Topic CRUD

- `listTopics(libraryID)`
- `getTopic(libraryID, topicID)`
- `getTopicsForItem(libraryID, itemKey)`
- `createTopic(libraryID, { name, centerItem })`
- `updateTopic(libraryID, topicID, patch)`
- `deleteTopic(libraryID, topicID)`

### Node CRUD

- `addNode(libraryID, topicID, nodeInput, options = {})`
- `updateNode(libraryID, topicID, nodeID, patch)`
  - When patching `x/y`, optional `patch.snapLabel` can be passed so grid snapping uses current displayed label width instead of fallback title width.
- `removeNode(libraryID, topicID, nodeID)`
- `listNodes(libraryID, topicID)`

### Edge CRUD

- `addEdge(libraryID, topicID, edgeInput)`
- `updateEdge(libraryID, topicID, edgeID, patch)`
- `removeEdge(libraryID, topicID, edgeID)`
- `listEdges(libraryID, topicID)`

## 4. Internal helper contracts

- `ensureSyncedSettingsLoaded(libraryID)`: must run `Zotero.SyncedSettings.loadAll(libraryID)` before `get/set`.
- `loadStore(libraryID)` / `saveStore(libraryID, store)`: normalized IO boundary.
- `normalizeStore(rawStore)`: schema guard for missing fields and invalid values.
- `updateItemTopicIndexForTopic(store, topic)`: keeps reverse index consistent with topic nodes.

## 5. Frontend integration (current behavior)

- UI surfaces:
  - `Topic Context Section`: right item-pane custom section for context and topic actions.
  - `Selection Debug Section`: right item-pane custom section for selected-node debug info.
  - `Relation Graph Workspace`: middle graph pane/canvas for graph interaction.
- Selection-driven context loader:
  - `handlePrimaryItemChanged(window, item, options)`
  - If item has topics: load latest-updated topic.
  - If item has no topics: create temporary in-memory topic graph.
- Topic creation:
  - `promptCreateTopicFromItem(window, item)` prompts name and persists topic.
- Topic removal:
  - `promptRemoveActiveTopic(window, item)` confirms and removes active topic.
- Drag in items:
  - `onGraphDrop(window, event)` reads `dataTransfer.getData("zotero/item")`.
  - Adds dropped regular items as nodes into active saved topic.

## 6. Data integrity rules

- Use stable identity: `libraryID + itemKey`.
- Skip duplicate nodes for same item in same topic.
- Remove incident edges when node is removed.
- Persist node coordinates after drag in saved topic context.
- Reject cross-library dropped items.

## 7. Known constraints

- No visual topic chooser yet for papers that belong to multiple topics.
- No edge-editing UI yet (API exists, UI pending).
- Versioned migration path for future schema changes not yet implemented.

## 8. Remark storage (new)

- Scope: per Zotero item (not in `paper-relations.graph.v1`).
- Backend: Zotero built-in item field `extra`.
- Format: a single line in `extra`, case-insensitive prefix:
  - `remark: <text>`
- Compatibility:
  - Ethereal Style data already written as `remark:` in `extra` is directly readable/writable by Paper Relations.
- One-time migration utility:
  - `Migrate ES Remarks` scans regular items in a library.
  - If an item has no `extra remark`, it tries legacy ES note-tag remark fallback (child note tagged `remark`) and writes into `extra`.
