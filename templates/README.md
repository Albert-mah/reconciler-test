# JS 积木模板

可复用的 JS 代码模板。AI 复制文件后只需修改 `CONFIG` 区域，通用逻辑不动。

## 使用方式

1. 复制模板文件到模块的 `js/` 目录
2. AI 修改 `=== AI 修改指南 ===` 标注的 CONFIG 区域
3. deployer 注入时自动替换 `__TABLE_UID__`

## 模板列表

### kpi-card.js — KPI 卡片（SQL 版）

全屏渐变卡片，显示大数值 + 环比趋势。

**AI 只需改**：
```js
const CONFIG = {
  title: '本月销售额',              // 标题
  gradient: ['#1677ff', '#4096ff'], // 渐变色
  textColor: '#fff',                // 文字色
  prefix: '¥',                      // 前缀
};
const SQL = `SELECT ... as current_value, ... as previous_value FROM ...`;
const parseResult = (row) => ({ value: ..., previous: ... });
```

**颜色参考**：
- 销售/营收：蓝色 `['#1677ff', '#4096ff']`
- 采购/支出：橙色 `['#fa8c16', '#ffc53d']`, textColor: `'#333'`
- 生产/产出：绿色 `['#52c41a', '#95de64']`
- 质检/质量：紫色 `['#722ed1', '#b37feb']`
- 库存/物料：青色 `['#13c2c2', '#5cdbd3']`

### filter-stats.js — 筛选统计按钮组

按钮组 + 计数徽章，点击筛选表格。支持多组（Divider 分隔）。

**AI 只需改**：
```js
const COLLECTION = 'your_collection';
const GROUPS = [
  { name: '状态', items: [
    { key: 'all', label: '全部', filter: null },
    { key: 'active', label: '有效', filter: { status: { $eq: '有效' } } },
  ]},
];
```

**自动处理**：
- `__TABLE_UID__` 替换为同页表格 UID
- 计数通过 API 并行获取
- 点击联动表格筛选
