# UI Naming Memo

This memo records the agreed naming for the three plugin UI parts.

1. `Topic Context Section` (中文: `主题上下文区`)
- Type: `ItemPane custom section` (registered via `Zotero.ItemPaneManager.registerSection()`).
- Runtime id: `paper-connections-topic-context-section`.
- Responsibility: show current item/topic context and provide `Create/Remove topic` actions.

2. `Selection Debug Section` (中文: `选中节点调试区`)
- Type: `ItemPane custom section`.
- Runtime id: `paper-connections-selection-debug-section`.
- Responsibility: show selected graph node details (incoming/outgoing links) for debug.

3. `Relation Graph Workspace` (中文: `关系图工作区`)
- Type: custom middle pane area created by the plugin (`vbox/div + svg` canvas).
- Core ids: `paper-connections-graph-pane`, `paper-connections-graph-canvas`.
- Responsibility: core graph visualization and interactions (zoom/pan/drag/select/drop).

## Terminology Clarification

- The two right-side areas are `Section` objects inside the Zotero Item Pane.
- The middle graph area is a custom `Pane/Workspace` region created by the plugin.
- In daily communication, use these short names:
  - `上下文区` (Topic Context Section)
  - `调试区` (Selection Debug Section)
  - `图工作区` (Relation Graph Workspace)
