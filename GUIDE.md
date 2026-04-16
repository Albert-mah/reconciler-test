# NocoBase Application Builder

> 参考项目：`templates/crm/` — CRM 系统完整示例（JS/charts/structure）

## 响应方式

| 用户说 | 做什么 |
|--------|--------|
| "搭建 XXX 系统" | 先设计确认 → 再分轮搭建 |
| "修改字段/布局" | 改 YAML → `deploy --force` |
| "导出" | `npx tsx cli/cli.ts export-project "Group" outdir/` |

## 搭建流程

### 第零轮：需求设计（先确认再动手）

列出数据表、字段、关系，让用户确认：
```
模块：项目管理
数据表：
  nb_pm_projects: name, code, status(select:planning/active/completed), start_date, end_date, budget(number)
  nb_pm_tasks: name, status(select:todo/in_progress/done), project(m2o→projects), assignee(m2o→members), due_date
  nb_pm_members: name, email, role(select:manager/developer/designer)
页面：Dashboard + Projects, Tasks, Members
确认后开始搭建？
```

### 第一轮：数据表 + 页面布局

```bash
# 1. Scaffold
cd src && npx tsx cli/cli.ts scaffold /tmp/app AppName \
  --collections nb_app_coll1,nb_app_coll2,nb_app_coll3

# 2. 编辑 collections/*.yaml — 加业务字段（select 必须有 uiSchema.enum）
# 3. 编辑 templates/block/*.yaml — 更新 field_layout（必须有 --- 分组 ---）
# 4. 编辑 pages/*/layout.yaml — filterForm 必须有搜索框 + table 字段

# 5. Deploy
NB_USER=admin@nocobase.com NB_PASSWORD=admin123 \
  npx tsx cli/cli.ts deploy-project /tmp/app --group "App" --force

# 6. 插入测试数据（每表 5-8 条）
```

### 第二轮：详情页 + 弹窗

- 加 o2m 反向关系到 collections
- 编辑 popup 模板加 tabs + 关联表格
- deploy --force

### 第三轮：JS 区块 + 图表

**必须从 `templates/crm/js/` 复制再改，不要自己写：**
- KPI：复制 `analytics_jsBlock_6~9.js`，改 CONFIG 的 SQL
- Stats Filter：复制 `customers_filterForm_1_*.js`
- SQL 规范：`ctx.sql.save({uid,sql}) + ctx.sql.runById(uid)`

### 第四轮：ACL 权限

定义角色 → 配置数据范围 → 配置菜单可见性 → deploy-acl

## 关键规则

1. **先设计后动手** — 必须用户确认数据表和字段
2. **select 必须有 enum** — `uiSchema: { enum: [{label,value}] }`
3. **filterForm 必须有搜索框** — `field: name, label: Search, filterPaths: [name,description]`
4. **field_layout 必须有分组** — `--- Section Name ---`
5. **默认 actions 自动加** — table: [filter,refresh,addNew]+[edit,delete]; details: [edit]; form: [submit]
6. **JS 不能直接 ctx.sql()** — 必须 save+runById 两步

## 文件结构

```
/tmp/app/
├── collections/*.yaml     # 数据表（编辑字段）
├── templates/block/*.yaml  # 表单/详情模板（编辑 field_layout）
├── templates/popup/*.yaml  # 弹窗模板（ref: 引用 block 模板）
├── pages/<mod>/<page>/
│   ├── layout.yaml         # 页面布局
│   ├── js/*.js             # JS 区块
│   └── popups/*.yaml       # 弹窗引用
├── routes.yaml             # 菜单
├── defaults.yaml           # m2o 自动弹窗绑定
└── state.yaml              # 部署状态（自动管理）
```

## 字段类型

| interface | 用途 | 示例 |
|-----------|------|------|
| input | 短文本 | name, code |
| textarea | 长文本 | description |
| select | 下拉 | status, priority（必须有 enum） |
| number | 数字 | amount, budget |
| integer | 整数 | quantity |
| dateOnly | 日期 | start_date |
| m2o | 多对一关系 | project, assignee（需要 target） |
| o2m | 一对多关系 | tasks, members（需要 target） |
| email | 邮箱 | email |
| phone | 电话 | phone |

## 命令

```bash
cd /path/to/nocobase-reconciler

# Scaffold
npx tsx src/cli/cli.ts scaffold /tmp/app AppName \
  --collections nb_app_coll1,nb_app_coll2

# Deploy
cd src && NB_USER=admin@nocobase.com NB_PASSWORD=admin123 \
  npx tsx cli/cli.ts deploy-project /tmp/app --group "App" --force

# Export
npx tsx src/cli/cli.ts export-project "App" /tmp/export
```
