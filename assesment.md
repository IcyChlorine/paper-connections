# Paper Relations 数据存储评估（Zotero 7）

日期：2026-02-27  
环境：Zotero 7.0.32（BuildID 20260114201345，本机 `C:\Program Files\Zotero\app\application.ini`）

## 1. 需求抽象

- 每篇论文可属于一个或多个 `topic/problem`。
- 每个 topic 对应一张关系图（节点=论文，边=先行/后续等关系）。
- 节点需要 topic 内语境字段（例如短记 `CSD`）、布局坐标等元数据。
- 需要可持续增删改查，并尽量兼容 Zotero 原生机制。

## 2. Zotero 可用接口（本机源码核对）

已核对本机 `C:\Program Files\Zotero\app\omni.ja` 内以下模块：

- `chrome/content/zotero/xpcom/data/item.js`
- `chrome/content/zotero/xpcom/data/dataObject.js`
- `chrome/content/zotero/xpcom/data/relations.js`
- `chrome/content/zotero/xpcom/syncedSettings.js`
- `chrome/content/zotero/xpcom/db.js`
- `chrome/content/zotero/xpcom/schema.js`

关键事实：

- `Zotero.Item`/`DataObject` 提供 `addRelation/removeRelation/getRelations/setRelations`。
- 原生 related items 本质是 `dc:relation`，适合“有关联”语义，不适合复杂图边属性。
- `Zotero.SyncedSettings` 以 `(libraryID, setting)` 存 JSON，并参与 Zotero 同步。
- `Zotero.DB.*` 可直接 SQL，但属于内部层，不宜作为插件业务主路径。

## 3. 存储组织结论

采用 **topic-centered** 结构，不采用“按论文分散存整图”：

- 主存储按 topic 聚合，天然承载“同一问题语境下”的节点/边。
- 节点可包含 topic 私有元数据（shortLabel、x/y、note）。
- 论文多 topic 通过索引映射支持。
- 避免跨论文分散存导致的一致性、迁移和去重复杂度。

## 4. 推荐数据模型（存入 SyncedSettings）

建议 setting key：`paper-relations.graph.v1`

```json
{
  "schemaVersion": 1,
  "topics": {
    "topic_xxx": {
      "id": "topic_xxx",
      "libraryID": 1,
      "name": "Quantum Circuit Synthesis",
      "createdAt": 1730000000000,
      "updatedAt": 1730000000000,
      "nodes": {
        "node_xxx": {
          "id": "node_xxx",
          "libraryID": 1,
          "itemKey": "ABCD1234",
          "title": "Paper title",
          "shortLabel": "CSD",
          "x": 120,
          "y": 80
        }
      },
      "edges": {
        "edge_xxx": {
          "id": "edge_xxx",
          "fromNodeID": "node_a",
          "toNodeID": "node_b",
          "type": "extends",
          "note": "method transfer"
        }
      }
    }
  },
  "itemTopicIndex": {
    "1/ABCD1234": ["topic_xxx"]
  }
}
```

## 5. 为什么优先 SyncedSettings

- 库级隔离：不是全局偏好，而是按 `libraryID` 区分。
- 可同步：同一库在多设备可同步关系图。
- API 层稳定：通过 Zotero 官方对象接口读写，无需直接写 SQLite。

## 6. 实施建议

- 核心关系图数据：`Zotero.SyncedSettings`。
- 条目实体读取：`Zotero.Items/Zotero.Item` API。
- 可选兼容层：仅在需要时将部分边镜像到原生 `related`（失去边属性，不作为主数据）。
- 明确不做：插件直接写 Zotero 核心表。
