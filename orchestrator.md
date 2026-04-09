# Reconciler Orchestrator — 子 Agent 搭建指南

## 概述

通过 tmux 启动子 Claude Code 会话，每个子 agent 负责一个独立任务。
主 agent（你）负责编排：生成 YAML spec → 启动子 agent 写 JS → 收集结果 → 部署。

## 文件结构

```
<module>/
├── structure.yaml    ← 主 agent 编写（表 + 页面骨架）
├── enhance.yaml      ← 主 agent 编写（弹窗 + JS 占位）
├── state.yaml        ← deployer 自动生成
├── js/               ← 子 agent 并行实现
│   ├── col_xxx.js
│   ├── detail_xxx.js
│   └── filter_xxx.js
└── charts/           ← 如需 chart 配置
```

## 流程

### Phase 1: 主 agent 设计 spec（structure + enhance）

根据用户需求，参考 CRM 导出模板（exports/crm-v2/），编写：

1. `structure.yaml` — collections + pages + blocks + layout
2. `enhance.yaml` — popups (addNew/edit/view with field_layout)

**JS 只写 desc + file 路径，不写代码**：
```yaml
js_columns:
  - title: 库存状态
    desc: stock_qty < min_stock 红色, < min_stock*2 橙色, 否则绿色
    file: ./js/col_stock_status.js

js_items:
  - desc: 产品概览KPI卡片 — 价格/成本/利润率/库存
    file: ./js/detail_product_overview.js
```

### Phase 2: 部署骨架

```bash
cd /home/albert/prj/vscodes/nocobase-reconciler
python deployer.py <module>/
```

这一步创建 collections + pages + popups + 空 JS 占位。

### Phase 3: 子 agent 并行写 JS

通过 tmux 启动子 agent：

```bash
# 启动 tmux session
tmux new-session -d -s js-agents

# 子 agent 1: 写表格 JS 列
tmux send-keys -t js-agents "env -u CLAUDECODE -u CLAUDE_CODE_RUNNING claude -p '$(cat <<PROMPT
你是 NocoBase JS 开发者。写一个 JSColumnModel 的渲染代码。

需求：$(cat <module>/js/col_stock_status.js.desc 2>/dev/null || echo "库存预警标签")
Collection: erp_products
可用字段: stock_qty(integer), min_stock(integer), status(select)

技术要求:
- 使用 ctx.record 获取当前行数据
- 使用 ctx.antd (Tag, Badge, Typography 等) 渲染
- ctx.render(<Component />) 输出
- 不需要 import，ctx 已注入

输出: 只输出 JS 代码到 /home/albert/prj/vscodes/nocobase-reconciler/<module>/js/col_stock_status.js
PROMPT
)' --dangerously-skip-permissions" Enter
```

**每个子 agent 的 prompt 模板**：

```
你是 NocoBase JS 开发者。

任务: {TASK_TYPE} — {DESC}
Collection: {COLLECTION}
可用字段: {FIELDS}

技术约束:
- JSColumnModel: ctx.record 获取行数据, ctx.render(<JSX/>) 输出
- JSItemModel: ctx.record 获取详情数据, ctx.antd 组件库
- JSBlockModel: ctx.api.request() 查数据, ctx.React hooks
- 所有组件从 ctx.antd 取 (Tag, Card, Row, Col, Statistic, Badge, Space 等)
- 不需要 import，ctx.React / ctx.antd 已注入

输出路径: {FILE_PATH}
只输出代码文件，不要解释。
```

### Phase 4: 注入 JS

```bash
python deployer.py <module>/ --force
```

`--force` 会：
- 检测新增的 JS 文件 → 注入到对应 block
- 不重建页面/弹窗（原地更新）
- 自动替换 TARGET_BLOCK_UID

### Phase 5: 验证

刷新浏览器检查效果，有问题再启动子 agent 修改对应 JS 文件。

---

## 参考：CRM 模板结构

```
exports/crm-v2/
├── structure.yaml    ← 7 页面模板
├── enhance.yaml      ← 3 个详情弹窗（多 tab + JS items + 关联 list）
├── js/               ← 30 个 JS 文件
└── charts/           ← 5 个 chart 配置
```

用 `python view.py exports/crm-v2/ --popups` 查看完整结构。

---

## 子 agent 启动快捷方式

```bash
# 启动单个子 agent 写一个 JS 文件
launch_js_agent() {
    local session=$1 desc=$2 coll=$3 fields=$4 file=$5
    tmux send-keys -t "$session" "env -u CLAUDECODE -u CLAUDE_CODE_RUNNING claude -p '你是NocoBase JS开发者。需求: $desc。Collection: $coll。字段: $fields。技术: ctx.record获取数据, ctx.antd组件, ctx.render输出。只写代码到 $file' --dangerously-skip-permissions" Enter
}

# 批量启动
tmux new-session -d -s js
tmux new-window -t js -n w1
tmux new-window -t js -n w2
tmux new-window -t js -n w3

launch_js_agent "js:w1" "库存预警标签" "erp_products" "stock_qty,min_stock" "/path/js/col_stock.js"
launch_js_agent "js:w2" "利润率百分比" "erp_products" "price,cost" "/path/js/col_profit.js"
launch_js_agent "js:w3" "到货倒计时" "erp_purchase_orders" "expected_date,status" "/path/js/col_countdown.js"
```

---

## 与旧版流程的区别

| 旧版（MCP + phases） | 新版（Reconciler + deployer） |
|----------------------|------------------------------|
| 6 个 phase 文件，逐步执行 | 2 个 YAML 文件，一条命令部署 |
| MCP tools 调用（nb_compose_page 等）| deployer.py 统一处理 |
| notes.md 状态跟踪 | state.yaml 自动维护 |
| 子 agent 需要 MCP 环境 | 子 agent 只写 JS 文件（零依赖） |
| 失败需要重试整个 phase | 失败只重跑对应 JS 文件 |
| 每个系统 ~800 行 prompt | structure + enhance ~200 行 |
