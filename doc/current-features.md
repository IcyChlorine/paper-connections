# Paper Connections - Current Features

## Snapshot
- Date: 2026-03-06
- Target: Zotero 7 (`src`)
- Plugin id: `paper-connections@example.com`
- Storage backend: `Zotero.SyncedSettings` (`paper-connections.graph.v1`)
- Storage shape: topic/node/edge store
- Add-on package icon: `assets/paper-connections-svgrepo-com.svg`

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
  - Stores remark in item `extra` as `remark: ...`.
  - Editing `Remark` in right info pane immediately refreshes graph node labels for that paper in open workspaces.
- Middle-bottom `Relation Graph Workspace` under item list
  - Resizable with splitter.
  - Grid board and nodes pan together.
  - Pane resize does not auto-scale graph objects.
  - Item-list toolbar includes a graph workspace toggle button to show/hide workspace.
  - Keyboard shortcut `Ctrl+\`` also toggles graph workspace visibility.
  - SVG canvas top-right includes two icon toggle buttons:
    - magnet button toggles magnetic snap-to-grid.
    - pin button toggles pinned graph context while selecting other items.
  - Controls are icon-only (dim gray inactive, solid dark gray active).
  - Snap-to-grid is enabled by default on workspace init.
- Topic/context loading behavior
  - On item selection, if item belongs to topics, loads latest-updated topic.
  - If item belongs to no topic, renders a temporary in-memory topic (not persisted).
  - Creating topic from selected paper persists topic and switches graph context immediately.
  - Removing topic deletes topic and item-index mappings, then reloads context.
- Drag-and-drop behavior
  - Drag Zotero items from main list into graph canvas to add nodes to active saved topic.
  - Temporary topic and no-topic state reject drop.
  - Duplicate item nodes in same topic are skipped.
- Graph interactions
  - Mouse wheel zoom around cursor.
  - Drag blank canvas to pan.
  - Click node to select; click blank area to clear selection.
  - Selecting a graph node reverse-syncs selection to Zotero item list.
  - Double-clicking a paper node attempts to open its best attachment/PDF using the same Zotero item-open flow as double-clicking the item in the item list.
  - Right-click node menu: `Remove`, `Rename`.
  - Right-click blank-canvas menu is context-aware:
    - temporary topic: `Create topic from this paper`, separator, `Export as SVG`.
    - saved topic: `Rename`, `Delete`, separator, `Export as SVG`, `Export as JSON`.
    - no topic loaded: menu suppressed (no disabled placeholder entries).
  - Topic-menu `Rename` updates active saved topic name.
  - Topic-menu `Delete` uses same confirm/remove flow as right-pane `Remove topic`.
  - Topic-menu `Create topic from this paper` reuses the same create-topic flow.
  - Topic-menu `Export as SVG`:
    - opens SVG export settings dialog (`SVG 导出设置`: include grid + margin),
    - opens save dialog,
    - exports content-bounds plus margin as SVG.
  - Topic-menu `Export as JSON` opens save dialog and exports topic JSON (`topic` payload).
  - Node `Remove` deletes node and incident edges from active saved topic.
  - Node `Rename` (or `F2`) enters inline edit mode; `Enter` confirms, `Esc` cancels.
  - Node left/right anchors appear near cursor and support drag-to-create edge.
  - Edge creation only allows left-right anchor pairing.
  - Backward links use wrap-around bezier routing with rightward endpoint tangents.
  - Hold `Alt` + right-drag to cut intersected edges.
  - Hold `Shift` + right-drag (saved topics only) to edge-bundle intersected edges:
    - shows a dotted bundle path while dragging.
    - groups hits by same source node.
    - any non-empty group creates a real bundle node (`nodeType=bundle`), including single-edge groups.
    - bundle action rewrites real edges (`source -> hub`, `hub -> target`) and supports nested chaining.
  - Bundle hub behavior:
    - hub appears on hover-near, hides when pointer leaves.
    - left-drag moves hub and follows current snap mode.
    - right-click hub menu: `Dissolve`, separator, and `Flat Tangent` toggle (checked when enabled).
    - `Dissolve` works on `1-in-N-out` topology; non-`1-in` topology is warned and not auto-fixed.
    - default slope mode is `Flat Tangent`; disabled state removes hub-side handle extension (hub-end handle length = 0).
  - SVG export renders current bundled edge visuals (bundle hubs are not rendered).
  - Background grid remains visible regardless of snap toggle.
  - Drag node with 24px magnetic snap-to-grid by node center and persist snapped position.
- Node rendering behavior
  - Node text prefers item `Remark`; falls back to paper title.
  - Confirming node rename writes back to item `Remark` (`extra` field) and refreshes all open graph labels.
  - During rename typing, node size reflows live while preserving node center.
  - Label-change relayout preserves center and grid stability.
  - Persisted drag/relayout positions use displayed label metrics (`snapLabel`) to avoid subtle drift.
  - Node width adapts by text length.
  - Multi-line wrapping prefers word boundaries; long-word split uses hyphen.
  - Dynamic node height and improved line spacing/readability.

## Data Layer
- Implemented topic/node/edge CRUD in `src/storage.js`.
- Data schema and API details documented in `doc/storage-crud.md`.

## Runtime Script Architecture
- `src/graph-workspace.js`: pane mount/unmount, visibility toggle, event wiring, DOM assembly.
- `src/graph-render.js`: SVG render and geometry helpers.
- `src/graph-interaction.js`: pointer/keyboard interaction, selection, drag/drop, rename interaction.
- `src/graph-topic.js`: topic lifecycle and selection-driven topic/temporary-topic transitions.
- `src/graph-export.js`: node/workspace context menus and SVG/JSON export flows.
- Frontend render contract reference: `doc/graph-render-refresh.md`
  - documents `refreshGraph(window)` heavy refresh vs `updateNodeDOM(...)` / `updateEdgeDOM(...)` incremental updates.

## Build/Package
- Build command (Git Bash): `./make-zips.sh`
- Build command (PowerShell): `.\make-zips.ps1`
- Output xpi: `build/paper-connections.xpi`
- Update template: `updates.json.tmpl`

## Developer Tooling
- `tools/screenshot.py` prefers window-targeted capture on Windows (`--window-query` default `Zotero`) and falls back to full-screen.
- `tools/screenshot.py --list-windows` lists matched top-level windows for debugging.
- `tools/screenshot_server.py` mirrors the same behavior in MCP tools and adds `list_windows`.

## Pending TODO (Next Stage)
- Topic chooser UI when a paper belongs to multiple topics.
- Edge editing UI (relation type and note).
- Integration with real relation semantics in right pane (beyond debug scaffolding).
