# NocoBase Application Builder

## How to Respond

| User says | Do this |
|-----------|---------|
| "Build me a XXX system" | **Build Mode** → design → confirm → scaffold → edit → deploy |
| "Modify / add a field" | Edit collections/*.yaml + templates/block/*.yaml → redeploy `--force` |
| "Export pages" | `npx tsx src/cli/cli.ts export-project "Group" outdir/` |

## Build Mode

### Step 1 — Design (show plan, ask to confirm)

```
Module: Project Management
Pages: Projects, Tasks, Milestones, Members, TimeEntries

Collections:
  nb_pm_projects: name, code, status(select), priority(select), start_date, end_date, budget(number), owner(m2o→members)
  nb_pm_tasks: name, status(select), priority(select), project(m2o), assignee(m2o), due_date, estimated_hours(number)
  nb_pm_members: name, email, role(select), department

Each page: JS stats filter + search + table + addNew/edit/detail popups (auto-generated)

Shall I start building?
```

### Step 2 — Scaffold + Edit + Deploy

```bash
# 1. Scaffold (auto-generates everything)
cd /path/to/nocobase-reconciler
npx tsx src/cli/cli.ts scaffold /tmp/my-app MyApp \
  --pages Projects,Tasks,Members \
  --collections nb_myapp_projects,nb_myapp_tasks,nb_myapp_members

# 2. Edit collections — add business fields
# 3. Edit templates/block — update field_layout to match new fields
# 4. Deploy
cd src && NB_USER=admin@nocobase.com NB_PASSWORD=admin123 \
  npx tsx cli/cli.ts deploy-project /tmp/my-app --group "My App" --blueprint

# 5. Insert test data (5-8 records per table)
# 6. Force update after edits
npx tsx cli/cli.ts deploy-project /tmp/my-app --group "My App" --force
```

Report each step result. Ask before continuing.

## What Scaffold Generates

```
/tmp/my-app/
├── routes.yaml              # Menu structure
├── defaults.yaml            # Auto-binds popup templates to m2o fields
├── collections/*.yaml       # Table definitions (edit these: add fields)
├── templates/
│   ├── block/               # Form/detail content (edit these: field_layout)
│   │   ├── form_add_new_xxx.yaml
│   │   ├── form_edit_xxx.yaml
│   │   └── detail_xxx.yaml
│   └── popup/               # Whole-drawer templates (don't edit)
│       ├── add_new_xxx.yaml
│       ├── edit_xxx.yaml
│       └── detail_xxx.yaml
├── pages/<mod>/<page>/
│   ├── layout.yaml          # Page layout (filterForm + table)
│   ├── js/stats_filter.js   # Stats button group stub
│   └── popups/              # Popup refs (don't edit)
└── state.yaml               # Deploy state (auto-managed)
```

> **Only edit**: `collections/*.yaml` (fields) + `templates/block/*.yaml` (form layout)
> Everything else is auto-generated and auto-wired.

## Collection Template

```yaml
name: nb_myapp_orders
title: Orders
fields:
  - name: name
    interface: input
    title: Name
  - name: status
    interface: select
    title: Status
    uiSchema:
      enum:
        - { label: Draft, value: draft }
        - { label: Active, value: active }
        - { label: Done, value: done }
  - name: customer
    interface: m2o
    title: Customer
    target: nb_myapp_customers
  - name: total
    interface: number
    title: Total Amount
  - name: due_date
    interface: dateOnly
    title: Due Date
```

> titleField auto-set to `name` or `title`. FK fields auto-created for m2o.

## Block Template (form/detail layout)

```yaml
# templates/block/form_add_new_nb_myapp_orders.yaml
name: 'Form (Add new): Orders'
type: block
collectionName: nb_myapp_orders
content:
  key: createForm
  type: createForm
  coll: nb_myapp_orders
  fields: [name, status, customer, total, due_date, description]
  field_layout:
    - '--- Basic Info ---'
    - [name, status]
    - [customer, due_date]
    - '--- Financial ---'
    - [total]
    - [description]
  actions:
    - submit
```

> edit + detail templates use the **same field_layout**. Edit all 3 together.

## Page Layout Template

```yaml
# pages/myapp/orders/layout.yaml
blocks:
  - key: filterForm
    type: filterForm
    coll: nb_myapp_orders
    fields:
      - field: name
        label: Search
        filterPaths: [name, description]
      - status
    js_items:
      - desc: Stats Filter Block
        file: ./js/stats_filter.js
    field_layout:
      - ['[JS:Stats Filter Block]']
      - [name, status]
  - key: table
    type: table
    coll: nb_myapp_orders
    fields:
      - field: name
        popup: templates/popup/detail_nb_myapp_orders.yaml
      - customer
      - status
      - total
      - due_date
      - createdAt
    actions: [filter, refresh, addNew]
    recordActions:
      - edit
      - updateRecord:
          key: mark_done
          icon: checkoutlined
          tooltip: Done
          assign: { status: done }
          hiddenWhen: { status: done }
layout:
  - [filterForm]
  - [table]
```

## Key Rules

1. **Design first** — never build without user confirmation
2. **Scaffold first** — always start with `scaffold`, then edit generated files
3. **filterForm** — max 2-3 fields + must have js_items stats block on first row
4. **No manual actions on filterForm** — NocoBase auto-creates submit/reset
5. **No `view` in recordActions** — name field clickToOpen already provides detail view
6. **Edit 3 block templates together** — addNew, edit, detail share same field_layout baseline
7. **m2o fields auto-popup** — defaults.yaml binds popup templates, no manual config needed
8. **Incremental** — always `--force` update, never destroy + recreate
9. **Layout required** — >2 blocks need `layout:`, >2 form fields need `field_layout:`

## Field Types

| interface | Use for | Example |
|-----------|---------|---------|
| `input` | Short text | name, code, title |
| `textarea` | Long text | description, notes |
| `select` | Dropdown | status, priority, role |
| `number` | Numbers | amount, quantity, rate |
| `percent` | Percentage | progress, discount |
| `dateOnly` | Date | start_date, due_date |
| `date` | Date+time | created_at |
| `m2o` | Relation (many-to-one) | project, assignee, customer |
| `email` | Email | email |
| `checkbox` | Boolean | is_active |

## Commands

```bash
cd /path/to/nocobase-reconciler

# Scaffold
npx tsx src/cli/cli.ts scaffold /tmp/app AppName \
  --pages Page1,Page2 --collections nb_app_coll1,nb_app_coll2

# Deploy (first time)
cd src && NB_USER=admin@nocobase.com NB_PASSWORD=admin123 \
  npx tsx cli/cli.ts deploy-project /tmp/app --group "App Name" --blueprint

# Redeploy (after edits)
npx tsx cli/cli.ts deploy-project /tmp/app --group "App Name" --force

# Export
npx tsx cli/cli.ts export-project "App Name" /tmp/export
```
