# Reconciler 工作流程 — AI 协作指南

## 概述

用户和 AI 交互式对话推进系统搭建。AI 根据需要自行决定是否启动子 agent 并行处理。

## 核心流程

### 1. 需求理解
用户描述业务场景 → AI 设计数据模型 + 页面结构

### 2. 编写 spec
AI 编写 `structure.yaml`（表+页面）+ `enhance.yaml`（弹窗+JS占位）

### 3. 部署骨架
```bash
python deployer.py <module>/
```

### 4. JS 实现（可并行）
JS 文件互相独立 → AI 可启动多个子 agent 并行写 JS：
- 每个子 agent 只负责一个 JS 文件
- 只需要知道：需求描述 + collection 字段 + ctx API
- 不需要知道 UID、布局、deployer

### 5. 注入 JS
```bash
python deployer.py <module>/ --force
```

### 6. 验证 + 迭代
用户看效果 → 反馈 → AI 修改 spec 或 JS → 增量部署

## JS 子 agent 上下文

子 agent 实现 JS 时只需要以下信息：

```
技术环境:
- ctx.record: 当前行/记录数据
- ctx.React: React hooks (useState, useEffect 等)
- ctx.antd: Ant Design 组件 (Tag, Card, Row, Col, Statistic, Badge, Progress 等)
- ctx.api.request({url, params}): API 调用
- ctx.render(<JSX />): 输出渲染
- ctx.engine.getModel(uid): 跨区块联动

JS 类型:
- JSColumnModel: 表格自定义列 — ctx.record 有当前行
- JSItemModel: 详情/表单内 JS — ctx.record 有当前记录
- JSBlockModel: 独立 JS 区块 — 需要自己查数据
```

## 参考模板
- `exports/crm-v2/` — CRM 完整导出（7页面+弹窗+30 JS）
- `python view.py exports/crm-v2/ --popups` — 可视化结构
