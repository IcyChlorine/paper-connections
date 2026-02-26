# Paper Relations - Current Features

## Snapshot
- Date: 2026-02-26
- Target: Zotero 7 (`src-2.0`)
- Plugin id: `paper-relations@example.com`

## Implemented Features
- Right item-pane custom section: `Paper Relations`
  - Shows scaffold summary for relation editing and graph workflow.
- Right item-pane custom section: `Graph Selection`
  - Shows selected graph node label/id.
  - Shows incoming and outgoing linked nodes for debug.
- Middle-bottom graph pane under item list
  - Resizable with splitter (top edge drag).
  - Inner graph canvas resizes with pane height.
  - Mindmap-style placeholder nodes and directed Bezier edges.
- Graph interactions
  - Mouse wheel zoom (zoom around cursor position).
  - Drag blank canvas to pan.
  - Click node to select; click blank area to clear selection.
  - Selected node border becomes thicker.
  - Drag selected node to move it; connected edges update in real time.

## Build/Package
- Build command: `./make-zips`
- Output xpi: `build/paper-relations-2.0.xpi`
- Update template: `updates-2.0.json.tmpl`

## Pending TODO (Next Stage)
- Replace placeholder graph data with real relation data model.
- Persist and load graph/node/edge data via Zotero-friendly storage approach.
- Bind graph selection with real Zotero item identity (`libraryID + itemKey`).
- Add relation CRUD UI in right pane.
