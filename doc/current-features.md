# Paper Relations - Current Features

## Snapshot
- Date: 2026-02-28
- Target: Zotero 7 (`src`)
- Plugin id: `paper-relations@example.com`
- Storage backend: `Zotero.SyncedSettings` (`paper-relations.graph.v1`)

## Implemented Features
- Right item-pane custom section: `Topic Context Section`
  - Shows current item key and active graph context summary.
  - Provides `Create topic from selected paper` button.
  - Provides `Remove topic` button with confirm dialog (enabled only when active saved topic exists).
- Right item-pane custom section: `Selection Debug Section`
  - Shows selected graph node label/id.
  - Shows incoming and outgoing linked nodes for debug.
- Remark system
  - Adds a custom main-list column `Remark` via `Zotero.ItemTreeManager`.
  - Adds a custom editable info-row `Remark` in right item info pane (`afterCreators`).
  - Stores remark in item `extra` as `remark: ...` (directly compatible with Ethereal Style remark data already in this format).
  - `Topic Context Section` includes a one-time `Migrate ES Remarks` action to import legacy ES note-tag based remark data into `extra`.
- Middle-bottom `Relation Graph Workspace` under item list
  - Resizable with splitter (top edge drag).
  - Grid board and nodes pan together.
  - Pane resize does not auto-scale graph objects.
  - SVG canvas top-right includes two icon toggle buttons:
    - left magnet button toggles magnetic snap-to-grid.
    - right pin button toggles pinned graph context while selecting other items.
  - Controls are icon-only (no button border/background): dim gray at 30% opacity when inactive, solid dark gray when active.
  - Snap-to-grid is enabled by default on workspace init.
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
  - Selecting a graph node reverse-syncs selection to the top Zotero item list.
  - Node left/right anchors appear as black dots only when cursor nears an anchor.
  - Drag from one anchor to another to create relation edge; preview edge follows cursor while dragging.
  - Edge creation allows only left-right anchor pairing (left-left and right-right are rejected).
  - Backward links (target anchor left of source anchor) use wrap-around bezier routing while keeping rightward tangents at both endpoints.
  - Hold `Alt` and drag with right mouse button to draw a dotted cut line and remove intersected relation edges on release.
  - Cut preview shows a scissors icon near cut-path start.
  - Background grid remains visible regardless of snap toggle state.
  - Drag selected node with 24px magnetic snap-to-grid by node center and persist snapped position to storage.
- Node rendering improvements
  - Graph node text prefers item `Remark` (if present); falls back to full paper title when remark is empty.
  - Node width adapts by title length within a wider range to reduce excessive wrapping.
  - Multi-line title wrapping prefers word boundaries; if forced to split a long word, adds hyphen.
  - Dynamic node height based on wrapped lines.
  - Line spacing increased by about 10% for better readability.
  - Reduced corner radius and tighter spacing.

## Data Layer
- Implemented topic/node/edge CRUD in `src/paper-relations-storage.js`.
- Data schema and API details documented in `doc/storage-crud.md`.

## Build/Package
- Build command: `./make-zips`
- Output xpi: `build/paper-relations.xpi`
- Update template: `updates.json.tmpl`

## Developer Tooling
- `tools/screenshot.py` now prefers window-targeted capture on Windows (`--window-query` default `Zotero`) and falls back to full-screen.
- `tools/screenshot.py --list-windows` lists matched top-level windows for debugging query strings.
- `tools/screenshot_server.py` mirrors the same behavior in MCP tools (`take_screenshot`, `take_screenshot_base64`) and adds `list_windows`.

## Pending TODO (Next Stage)
- Topic chooser UI when a paper belongs to multiple topics.
- Edge editing UI (relation type and note).
- Integration with real relation semantics in right pane (beyond debug scaffolding).
- Schema migration helpers for future storage versions.

