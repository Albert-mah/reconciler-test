# JS Component Templates

Reusable JS block/column templates for NocoBase pages.

## SQL 执行规范

NocoBase JS Block 中 **不能** 直接执行 SQL。必须用两步流程：

```javascript
// 1. 注册 SQL 模板（仅在配置模式下执行一次）
if (ctx.flowSettingsEnabled) {
  await ctx.sql.save({
    uid: 'unique_report_id',
    sql: 'SELECT count(*) AS value FROM my_table',
    dataSourceKey: 'main',
  });
}

// 2. 执行已注册的 SQL
const result = await ctx.sql.runById('unique_report_id', {
  type: 'selectRows',
  dataSourceKey: 'main',
});
// result = [{ value: 42 }, ...]
```

## 使用方式

1. 复制模板到页面 `js/` 目录
2. 修改 `CONFIG` 区域的参数（SQL、字段名、标题等）
3. 在 `layout.yaml` 中引用

## Templates

| Template | Type | Description |
|----------|------|-------------|
| `kpi-card.js` | JSBlockModel | KPI 卡片组（antd Statistic + Row/Col） |
| `stats-filter.js` | JSItemModel | 状态分布筛选按钮组（antd Button + Badge） |
| `status-tag.js` | JSColumnModel | 彩色状态标签（antd Tag） |
| `progress-bar.js` | JSColumnModel | 进度条列 |
| `currency.js` | JSColumnModel | 货币格式化列 |

## 代码规范

- 使用 JSX 语法（NocoBase 运行时支持）
- 使用 `ctx.antd` 组件（Row, Col, Statistic, Button, Tag, Badge, Spin...）
- 主题适配：`ctx.themeToken` 获取当前主题 token
- i18n：`ctx.t(key, { ns: 'namespace' })` 国际化
- 暗色模式检测：`ctx.antdConfig?.theme?.algorithm` 判断
