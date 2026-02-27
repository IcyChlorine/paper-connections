# Paper Relations - Current Features

## Snapshot
- Date: 2026-02-27
- Target: Zotero 7 (`src-2.0`)
- Plugin id: `paper-relations@example.com`
- Storage backend: `Zotero.SyncedSettings` (`paper-relations.graph.v1`)

## Implemented Features
- Right item-pane custom section: `Paper Relations`
  - Shows current item key and active graph context summary.
  - Provides `Create topic from selected paper` button.
  - Provides `Remove topic` button with confirm dialog (enabled only when active saved topic exists).
- Right item-pane custom section: `Graph Selection`
  - Shows selected graph node label/id.
  - Shows incoming and outgoing linked nodes for debug.
- Middle-bottom graph pane under item list
  - Resizable with splitter (top edge drag).
  - Grid board and nodes pan together.
  - Pane resize does not auto-scale graph objects.
  - Toolbar includes `Pinned` switch to freeze graph context while selecting other items.
- Topic/context loading behavior
  - On item selection, if item belongs to one or more topics, loads latest-updated topic.
  - If item belongs to no topic, renders a temporary in-memory topic (not persisted).
  - Creating topic from selected paper persists topic and switches graph context immediately.
  - Removing topic deletes topic and item-index mappings, then reloads context.
- Drag-and-drop behavior
  - Drag Zotero items from main list into graph canvas to add nodes to active saved topic.
  - Temporary topic and no-topic state reject drop.
  - Duplicate item nodes in same topic are skipped.
- Graph interactions
  - Mouse wheel zoom (zoom around cursor position).
  - Drag blank canvas to pan.
  - Click node to select; click blank area to clear selection.
  - Drag selected node to move it and persist position to storage.
- Node rendering improvements
  - Multi-line title wrapping with overflow truncation.
  - Dynamic node height based on wrapped lines.
  - Reduced corner radius and tighter spacing.

## Data Layer
- Implemented topic/node/edge CRUD in `src-2.0/paper-relations.js`.
- Data schema and API details documented in `doc/storage-crud.md`.

## Build/Package
- Build command: `./make-zips`
- Output xpi: `build/paper-relations-2.0.xpi`
- Update template: `updates-2.0.json.tmpl`

## Pending TODO (Next Stage)
- Topic chooser UI when a paper belongs to multiple topics.
- Edge creation/editing UI (relation type and note).
- Integration with real relation semantics in right pane (beyond debug scaffolding).
- Schema migration helpers for future storage versions.
