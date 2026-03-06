# Zotero 插件需求与可行性评估（关系记录 + 可视化）

- 文档日期：2026-02-25
- 项目目标：为 Zotero 开发插件，实现论文关系记录与关系可视化。

## 1. 你的问题与核心需求

你当前使用 Zotero 管理文献，希望开发一个插件，在 Zotero 内完成两件事：

1. 记录论文之间的关系。
2. 可视化这些关系。

你特别提出了实际约束：

- Zotero 安装在系统级路径，而不是当前单一项目目录。
- 该任务可能需要访问 Zotero GUI 与数据库。
- 这超出了典型“命令行 + 子目录”工作流，需要评估是否能由 Codex 协助完成。

## 2. 评估结论（具体版）

结论：可以完成，但需要“协作开发模式”，不是“我单端全自动闭环”。

- 我可以在当前工作区完成插件核心开发（架构、数据层、UI、可视化、打包脚本、调试工具）。
- 你需要在本机执行少量 GUI 验证、安装操作，并回传日志/截图/复现步骤。
- 涉及系统目录或真实 profile/db 的读写时，通常需要你授权或你本机手动执行命令。

## 3. 研究结果摘要（为什么技术上可行）

1. Zotero 7/8 支持插件开发，且有 UI 扩展能力（例如 item pane section、菜单等）。
2. Zotero JavaScript API 可用于条目读取、更新与事务保存（如 `saveTx()`）。
3. Zotero 原生存在 related items 机制（`relatedItems`、`addRelatedItem`），可作为兼容层参考。
4. 官方对数据库实践建议是：外部工具可读取 SQLite，但不建议直接写 SQLite；插件内应优先走 Zotero API。

## 4. 建议的插件设计

### 4.1 关系模型

采用“有向带类型边”：

- `sourceKey -> targetKey`
- `type`: `cites | extends | contradicts | related`
- 可扩展字段：`weight`、`note`、`confidence`、`evidence`

### 4.2 存储策略

双层存储：

1. 主存储：插件自有存储（JSON/SQLite，位于 Zotero profile 下插件目录）。
2. 兼容镜像（可选）：同步到 Zotero 原生 Related（注意原生 related 不带类型信息）。

### 4.3 UI 方案

1. 条目面板中提供关系编辑（新增、删除、改类型）。
2. 独立关系图视图（筛选、搜索、点击节点跳回条目）。

## 5. 开发计划（可执行）

### 阶段 0：环境确认与脚手架（0.5-1 天）

- 确认 Zotero 主版本（先锁定 Zotero 8）。
- 确认 profile 路径与开发 profile。
- 建立插件基础结构（`manifest.json`、`bootstrap.js`、构建脚本）。

### 阶段 1：先做工具层（1-2 天）

- `run-zotero-dev`：开发启动脚本。
- `link-plugin-dev`：插件开发态链接/代理安装脚本。
- `collect-debug-bundle`：一键打包日志脚本。

### 阶段 2：关系数据核心（2-3 天）

- 边模型、CRUD、去重、完整性检查。
- 使用 `libraryID + itemKey` 绑定关系，避免标题变化导致断链。

### 阶段 3：关系录入 UI（3-4 天）

- 在 item pane/右键菜单建立关系。
- 支持多选条目的快速建边。

### 阶段 4：关系可视化（3-5 天）

- 图谱渲染与布局。
- 按类型、年份、标签、collection 筛选。
- 点击节点定位回 Zotero 条目。

### 阶段 5：稳定化与发布（2-3 天）

- 性能优化（大库子图加载、节点上限）。
- 导入导出（JSON/CSV）。
- 打包 `.xpi`、安装说明、回滚说明。

## 6. 你需要配合的事项

1. 提供基础环境信息：
   - Zotero 版本
   - 操作系统
   - 是否必须兼容 Zotero 7 与 8
2. 按步骤执行本机 GUI 验证，并回传：
   - 报错日志
   - 截图
   - 复现路径
3. 提供一份可测试小型文献库（可匿名）。
4. 关键产品决策：
   - 关系是否默认有向
   - 是否允许跨库关系
   - 是否需要与原生 Related 同步

## 7. 主要风险与应对

1. API 文档与实际行为存在细节差异。
   - 应对：以官方样例 + 实测日志校准。
2. Zotero 7/8 差异导致兼容成本上升。
   - 应对：先交付 Zotero 8 MVP，再加兼容层。
3. 大型文献库可视化性能问题。
   - 应对：默认子图加载 + 渐进渲染 + 节点上限。
4. 数据一致性与迁移风险。
   - 应对：版本化 schema + 导出备份 + 索引重建工具。

## 8. 推荐起步范围（MVP）

第一版优先目标：

- 关系类型仅支持：`cites`、`extends`、`contradicts`、`related`
- 支持关系录入与基础图谱查看
- 支持按类型筛选和节点点击回跳 Zotero 条目

## 9. 参考资料（后续开发可直接使用）

- Zotero 8 for Developers: https://www.zotero.org/support/dev/zotero_8_for_developers
- Zotero 7 for Developers: https://www.zotero.org/support/dev/zotero_7_for_developers
- Plugin Development: https://www.zotero.org/support/dev/client_coding/plugin_development
- JavaScript API: https://www.zotero.org/support/dev/client_coding/javascript_api
- Related Items: https://www.zotero.org/support/related
- 示例插件（Make It Red）: https://github.com/zotero/make-it-red
