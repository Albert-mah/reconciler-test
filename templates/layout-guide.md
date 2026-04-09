# 详情弹窗布局规范

## 核心原则

- **概览 tab 给人完整画面** — 不需要切 tab 就能了解 80% 信息
- **关联数据分层** — 概览放紧凑版（最近 5 条），独立 tab 放完整版
- **左主右辅** — 左 16 格放核心字段，右 8 格放辅助信息和快览

## Tab 结构

```
Tab 0: 概览（必须有）
  左 16:
    [JS: KPI 卡片]         ← 关键指标一目了然
    --- 分组标题 ---
    [字段行 3 列]
    [字段行 2 列]
    ...
  右 8:
    --- 辅助信息 ---        ← 卡片式字段（价格/财务等）
    [字段]
    --- 最近 xxx ---        ← 紧凑关联表格（5 条）
    [关联表格 pageSize=5]

Tab 1-N: 关联数据（按需）
  [全宽表格]               ← 完整数据，可分页搜索

最后 Tab: 历史记录
  [RecordHistory]
```

## 什么放概览，什么放独立 Tab

| 放概览右侧 | 放独立 Tab |
|-----------|-----------|
| 最近 3-5 条关联记录 | 完整关联数据（>10 条） |
| 3-4 列紧凑表格 | 5+ 列详细表格 |
| 不需要搜索/筛选 | 需要分页/排序/筛选 |
| 辅助信息卡片（价格/财务） | — |

## 示例：物料管理

```yaml
tabs:
  - title: 概览
    blocks:
      - key: detail_main    # 左 16
        type: details
        fields: [编码, 名称, 分类, 规格, 单位, 状态, 库存, 安全库存, ...]
        js_items: [KPI 卡片]
        field_layout:
          - "--- 基本信息 ---"
          - [编码, 名称, 分类]
          - [规格, 单位, 状态]
          - "--- 库存 ---"
          - [库存量, 安全库存, 最大库存]
        recordActions: [edit]

      - key: detail_price    # 右 8（卡片式）
        type: details
        fields: [标准价, 成本价, 备注]

      - key: recent_inv      # 右 8（紧凑表格）
        type: table
        title: 最近入出库
        coll: inventory
        resource_binding: { associationName: ... }
        fields: [类型, 数量, 仓库, 日期]  # 4 列够了
        # pageSize: 5

    layout:
      - [{col: [detail_main], size: 16},
         {col: [detail_price, recent_inv], size: 8}]

  - title: 库存流水    # 完整表格
    blocks:
      - type: table
        fields: [类型, 数量, 仓库, 单号, 操作人, 日期]  # 6 列

  - title: 质检记录
  - title: 历史记录
```

## 右侧卡片式 Detail

用于**少量高价值字段**（3-5 个），不需要 divider，紧凑显示：

```yaml
- key: detail_price
  type: details
  fields: [标准价, 成本价, 备注]
  field_layout:
    - "--- 价格 ---"
    - [标准价, 成本价]
    - "--- 备注 ---"
    - [备注]
```

## 紧凑关联表格

用于**快速一览最近记录**：

```yaml
- key: recent_orders
  type: table
  title: 最近订单
  coll: orders
  resource_binding:
    associationName: collection.orders
    sourceId: "{{ctx.view.inputArgs.filterByTk}}"
  fields: [单号, 金额, 状态]  # 3-4 列
  # pageSize: 5, 不需要操作按钮
```
