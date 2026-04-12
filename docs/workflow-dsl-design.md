# Workflow DSL Design — NocoBase as Code

> Design doc for extending nocobase-reconciler to export/import workflows as YAML.
> Status: DRAFT  |  Date: 2026-04-12

## Table of Contents

1. [Problem Statement](#problem-statement)
2. [Design Goals](#design-goals)
3. [Data Model Recap](#data-model-recap)
4. [YAML DSL Format](#yaml-dsl-format)
5. [Graph Syntax](#graph-syntax)
6. [Trigger Definitions](#trigger-definitions)
7. [Node Definitions](#node-definitions)
8. [Variable System](#variable-system)
9. [Complex Config via $ref](#complex-config-via-ref)
10. [Export Strategy](#export-strategy)
11. [Import (Deploy) Strategy](#import-deploy-strategy)
12. [Integration with Page Builder](#integration-with-page-builder)
13. [State Tracking](#state-tracking)
14. [Complete Examples](#complete-examples)
15. [Open Questions](#open-questions)

---

## Problem Statement

The reconciler currently handles pages (structure.yaml + enhance.yaml + state.yaml) but not
workflows. Workflows are a critical part of any NocoBase application — they automate business
logic, approval flows, scheduled tasks, and API integrations. Without workflow-as-code support:

- Workflows cannot be version-controlled alongside pages/collections
- There is no reproducible way to replicate a full app to another environment
- AI agents cannot design and deploy complete systems in one pass

## Design Goals

1. **Human-readable**: The YAML should be understandable by a developer or AI at a glance
2. **Round-trip safe**: Export from live system, import to another, re-export and get the same YAML
3. **Mermaid-inspired graph**: The flow topology should read like a Mermaid flowchart
4. **Separation of concerns**: Graph topology separate from node config details
5. **$ref for complex nodes**: Large configs (approval forms, manual schemas) stored externally
6. **Consistent with existing DSL**: Follow conventions from structure.yaml / enhance.yaml

## Data Model Recap

NocoBase workflows have four tables at play:

```
workflows (id, key, type, title, config, sync, enabled, options)
    |
    +-- flow_nodes (id, key, type, title, config, workflowId, upstreamId, downstreamId, branchIndex)
    |
    +-- executions (runtime, not exported)
    |
    +-- jobs (runtime, not exported)
```

Key facts:
- Nodes form a linked list via `upstreamId` / `downstreamId`
- Branch nodes (condition, parallel, loop, multi-condition, approval) spawn child chains via `branchIndex`
- Node `key` is a stable random string used for cross-version variable references
- Variables reference nodes by `key`, not `id`: `{{$jobsMapByNodeKey.<key>.field}}`

## YAML DSL Format

### Top-level structure: `workflow.yaml`

```yaml
# A single workflow definition
title: "Order Status Automation"
type: collection                    # trigger type
sync: false                         # async execution
description: "Auto-process orders on status change"
options:
  deleteExecutionOnStatus: [1, -1]
  stackLimit: 1

trigger:
  collection: orders
  mode: 3                           # 1=create, 2=update, 3=both
  changed: [status]
  condition:
    $and:
      - status: { $ne: canceled }
  appends: [customer, items]

# -- Flow graph (Mermaid-inspired) --
graph:
  - check_status                                          # first node (no arrow = chain head)
  - check_status --> [yes] update_inventory               # true branch
  - check_status --> [no] notify_admin                    # false branch
  - update_inventory --> calc_total                       # linear chain within branch
  - calc_total --> create_log

# -- Node definitions --
nodes:
  check_status:
    type: condition
    title: "Status is Paid?"
    config:
      rejectOnFalse: false
      engine: basic
      calculation:
        group:
          type: and
          calculations:
            - calculator: equal
              operands:
                - "{{$context.data.status}}"
                - paid

  update_inventory:
    type: update
    title: "Deduct Inventory"
    config:
      collection: products
      params:
        filter:
          $and:
            - id: { $eq: "{{$context.data.productId}}" }
        values:
          stock: "{{$jobsMapByNodeKey.calc_stock.result}}"

  calc_total:
    type: calculation
    title: "Calculate Total"
    config:
      engine: formula.js
      expression: "{{$context.data.quantity}} * {{$context.data.unitPrice}}"

  create_log:
    type: create
    title: "Create Audit Log"
    config:
      collection: order_logs
      params:
        values:
          orderId: "{{$context.data.id}}"
          action: status_change
          total: "{{$jobsMapByNodeKey.calc_total}}"

  notify_admin:
    type: request
    title: "Notify Admin"
    config: $ref: components/notify_admin.yaml
```

### Key design decisions

1. **`graph` section is ordered**: The first entry is the chain head. Arrows (`-->`) define
   downstream connections. Branch labels in `[brackets]` map to `branchIndex` values.

2. **`nodes` section is a flat map**: Keys are human-readable names (slugified to become
   node `title` defaults). These keys are used in the graph section and in variable references
   during export/import mapping.

3. **Node configs are inline by default**: Only use `$ref` when the config is large or
   shared across workflows.

## Graph Syntax

### Arrow notation

```
source --> target                    # main chain (branchIndex: null)
source --> [yes] target              # branch with label
source --> [no] target               # another branch
source --> [1] target                # numeric branch index (for parallel)
source --> [otherwise] target        # multi-condition default branch
```

### Branch label mapping

| Label | branchIndex | Used by |
|-------|-------------|---------|
| `yes`, `true`, `1` | 1 | condition (rejectOnFalse=false) |
| `no`, `false`, `0` | 0 | condition (rejectOnFalse=false) |
| `otherwise`, `default`, `0` | 0 | multi-condition |
| `1`, `2`, `3`, ... | 1, 2, 3 | multi-condition conditions, parallel branches |
| `approved`, `2` | 2 | approval |
| `rejected`, `-1` | -1 | approval |
| `returned`, `1` | 1 | approval |
| `body`, `loop`, `0` | 0 | loop |

### Graph parsing rules

1. Parse top-to-bottom; the first bare name with no `-->` is the chain head (`upstreamId: null`, `branchIndex: null`)
2. For each `A --> B` or `A --> [label] B`:
   - B's `upstreamId` = A
   - B's `branchIndex` = resolve(label) or null if no label
3. `downstreamId` is automatically computed: if A appears as upstream of B with `branchIndex: null`, then A's `downstreamId` = B
4. Nodes not mentioned in `graph` but present in `nodes` are warnings (orphaned nodes)

### Graph validation

- Every node in `nodes` must appear in `graph` (no orphans)
- Every name in `graph` must exist in `nodes` (no dangling references)
- Exactly one chain head (node with no incoming main-chain arrow)
- Branch nodes must have the correct labels for their type (condition needs yes/no, etc.)

## Trigger Definitions

The `trigger` section maps directly to the workflow's `config` field. The `type` at top level determines which trigger schema applies.

### Collection event

```yaml
type: collection
trigger:
  collection: orders              # dataSource:collection if not main
  mode: 1                         # 1=create, 2=update, 3=both, 4=delete
  changed: [status, amount]       # fields that trigger on update
  condition:                      # optional filter
    $and:
      - status: { $ne: archived }
  appends: [customer, items]      # preload associations
```

### Schedule (cron)

```yaml
type: schedule
trigger:
  mode: 0                         # 0=custom time, 1=date field
  startsOn: "2026-01-01T09:00:00Z"
  repeat: "0 */30 * * * *"        # cron expression
  endsOn: "2026-12-31T00:00:00Z"
  limit: 1000
```

### Schedule (date field)

```yaml
type: schedule
trigger:
  mode: 1
  collection: orders
  startsOn:
    field: createdAt
    offset: 30
    unit: 60000                    # minutes
  repeat: null
  appends: [createdBy]
```

### Action trigger (post-action)

```yaml
type: action
trigger:
  collection: posts
  global: true
  actions: [create, update]
  appends: [category, author]
```

### Custom action trigger

```yaml
type: custom-action
trigger:
  type: 1                         # 0=global, 1=single record, 2=multiple
  collection: orders
  appends: [items]
```

### Request interception (pre-action)

```yaml
type: request-interception
sync: true                         # always sync for interception
trigger:
  collection: orders
  global: true
  actions: [create, update]
```

### Webhook

```yaml
type: webhook
sync: true
trigger:
  basicAuthentication:
    username: webhook
    password: "{{$env.WEBHOOK_SECRET}}"
  request:
    headers:
      - key: x-signature
    query:
      - key: event
        alias: Event
    body:
      - key: data.id
        alias: Order ID
  response:
    statusCode: 200
    headers:
      - name: content-type
        value: application/json
    body:
      ok: true
```

### Approval

```yaml
type: approval
trigger:
  collection: expenses
  mode: 0                          # 0=save then approve, 1=approve then save
  centralized: true
  appends: [details, department]
  withdrawable: true
```

## Node Definitions

Each node in the `nodes` map has `type`, optional `title`, and `config`. Below are all supported node types with their config schemas.

### Data operations

```yaml
# Query
query_orders:
  type: query
  title: "Find active orders"
  config:
    collection: orders
    multiple: true
    params:
      filter:
        $and:
          - status: { $eq: active }
      sort:
        - field: createdAt
          direction: desc
      pageSize: 50
      appends: [customer]
    failOnEmpty: false

# Create
create_log:
  type: create
  config:
    collection: audit_logs
    params:
      values:
        action: "{{$context.data.action}}"
        userId: "{{$context.user.id}}"

# Update
update_status:
  type: update
  config:
    collection: orders
    params:
      filter:
        $and:
          - id: { $eq: "{{$context.data.id}}" }
      values:
        status: completed
        completedAt: "{{$system.now}}"

# Destroy
cleanup:
  type: destroy
  config:
    collection: temp_records
    params:
      filter:
        $and:
          - createdAt: { $lt: "{{$system.dateRange.yesterday}}" }

# Aggregate
count_orders:
  type: aggregate
  config:
    aggregator: count
    associated: false
    collection: orders
    params:
      field: id
      filter:
        status: { $eq: paid }
      distinct: true
    precision: 0

# SQL
custom_report:
  type: sql
  config:
    dataSource: main
    sql: "SELECT COUNT(*) AS total FROM orders WHERE status = 'paid'"
    withMeta: false
```

### Logic & control flow

```yaml
# Condition (if/else)
check_amount:
  type: condition
  config:
    rejectOnFalse: false           # false = yes/no branches; true = continue-or-fail
    engine: basic
    calculation:
      group:
        type: and
        calculations:
          - calculator: gt
            operands:
              - "{{$context.data.amount}}"
              - 1000

# Multi-condition (switch/case)
route_by_type:
  type: multi-conditions
  config:
    conditions:
      - uid: c1
        title: "Type A"
        engine: basic
        calculation:
          group:
            type: and
            calculations:
              - calculator: equal
                operands:
                  - "{{$context.data.type}}"
                  - A
      - uid: c2
        title: "Type B"
        engine: formula.js
        expression: "{{$context.data.type}} == 'B'"
    continueOnNoMatch: true

# Loop
process_items:
  type: loop
  config:
    target: "{{$context.data.items}}"
    exit: 2                        # 0=exit workflow, 1=exit loop, 2=skip item

# Parallel
parallel_calls:
  type: parallel
  config:
    mode: all                      # all, any, race, allSettled

# End workflow
fail_exit:
  type: end
  config:
    endStatus: -1                  # 1=success, -1=failure

# Workflow output (for subflows)
return_result:
  type: output
  config:
    value:
      total: "{{$jobsMapByNodeKey.calc_total}}"
      count: "{{$jobsMapByNodeKey.count_orders}}"
```

### Calculation & transformation

```yaml
# Calculation
calc_tax:
  type: calculation
  config:
    engine: formula.js
    expression: "{{$context.data.amount}} * 0.13"

# JavaScript
custom_logic:
  type: script
  config:
    arguments:
      - name: price
        value: "{{$context.data.price}}"
      - name: qty
        value: "{{$context.data.quantity}}"
    content: |
      const discount = qty > 100 ? 0.9 : 1.0;
      return price * qty * discount;
    timeout: 5000

# JSON Query
extract_payload:
  type: json-query
  config:
    engine: jmespath
    source: "{{$context.data}}"
    expression: "items[?status=='ok']"
    model:
      - path: id
        alias: item_id
      - path: name

# JSON Variable Mapping
map_webhook:
  type: json-variable-mapping
  config:
    dataSource: "{{$context.body}}"
    variables:
      - path: user.id
        alias: User ID
        key: user_id
      - path: items.0.name
        key: first_item
```

### External & notifications

```yaml
# HTTP Request
call_api:
  type: request
  config:
    method: POST
    url: "https://api.example.com/v1/orders"
    contentType: application/json
    headers:
      - name: Authorization
        value: "Bearer {{$env.API_TOKEN}}"
    data:
      orderId: "{{$context.data.id}}"
    timeout: 10000
    ignoreFail: false

# Delay
wait_30min:
  type: delay
  config:
    unit: 60000                    # minutes
    duration: 30
    endStatus: 1

# Notification
alert_ops:
  type: notification
  config:
    message:
      channelName: in-app
      title: "Low Stock Alert"
      content: "Product {{$context.data.name}} is below threshold"
    ignoreFail: true

# Response Message (for sync intercept flows)
reject_msg:
  type: response-message
  config:
    message: "Validation failed: {{$jobsMapByNodeKey.check_result}}"

# Subflow call
run_subflow:
  type: subflow
  config:
    workflow: order-calc            # workflow key (not id)
    context:
      data:
        orderId: "{{$context.data.id}}"
```

### Approval & manual

```yaml
# Manual process
review_task:
  type: manual
  config:
    assignees:
      - "{{$context.data.ownerId}}"
    mode: 1                        # 0=collaborate, 1=all pass, -1=any pass
    title: "Review: {{$context.data.title}}"
    # schema and forms are complex UI configs — use $ref
    schema: $ref: components/review_schema.yaml
    forms: $ref: components/review_forms.yaml

# Approval node
approve_expense:
  type: approval
  config:
    branchMode: true
    assignees:
      - "{{$context.data.managerId}}"
    negotiation: 1
    order: false
    endOnReject: true
    title: "Expense Approval: {{$context.data.title}}"
```

## Variable System

Variables are preserved as-is in the YAML. The DSL does not interpret or resolve variables — they
are opaque strings passed directly to the NocoBase API.

### Variable groups available in workflows

| Prefix | Description | Example |
|--------|-------------|---------|
| `$context` | Trigger data | `{{$context.data.title}}` |
| `$jobsMapByNodeKey` | Upstream node results (by node key) | `{{$jobsMapByNodeKey.abc123.name}}` |
| `$scopes` | Loop/branch scope variables | `{{$scopes.loop1.item.id}}` |
| `$system` | System values | `{{$system.now}}` |
| `$env` | Environment variables | `{{$env.API_KEY}}` |

### Key mapping problem: node keys

In the live system, node `key` is a random string like `6qww6wh1wb8`. In the DSL, we use
human-readable names like `check_status`. The reconciler must maintain a mapping between DSL
names and actual node keys.

**Export**: Replace `{{$jobsMapByNodeKey.<randomKey>...}}` with `{{$jobsMapByNodeKey.<dslName>...}}`.
**Import**: After creating nodes (which generates real keys), rewrite all variable references in
node configs from `<dslName>` to the actual `key`.

This mapping is stored in `state.yaml` (see [State Tracking](#state-tracking)).

### Scope variable mapping

For `$scopes`, the same key-to-name mapping applies:
- Export: `{{$scopes.abc123.item}}` becomes `{{$scopes.process_items.item}}`
- Import: Reverse-map back to real keys

## Complex Config via $ref

Large or shareable configs can be extracted to external files:

```yaml
# In workflow.yaml
approve_expense:
  type: approval
  config: $ref: components/expense_approval.yaml

# In components/expense_approval.yaml
branchMode: true
assignees:
  - "{{$context.data.managerId}}"
negotiation: 1
order: false
endOnReject: true
title: "Expense Approval"
applyDetail:
  # ... large UI schema ...
```

### $ref resolution rules

1. Path is relative to the workflow.yaml file
2. The referenced file contains only the `config` content (not wrapped in `config:`)
3. $ref can be used at the `config` level only (not for individual config sub-fields)
4. During import, the $ref is resolved and inlined before sending to the API
5. During export, configs larger than a threshold (e.g., 50 lines when serialized) are
   automatically extracted to `components/`

## Export Strategy

### API calls for export

1. **List workflows**: `GET /api/workflows:list?filter[current]=true&appends[]=nodes&appends[]=versionStats`
2. **For each workflow**: Already have all data from the list with `appends[]=nodes`
3. **Build graph**: Reconstruct the linked list from `upstreamId` / `downstreamId` / `branchIndex`

### Export algorithm

```
function exportWorkflow(workflow, nodes):
  1. Build node map: id -> node
  2. Find chain head (upstreamId == null, branchIndex == null)
  3. Walk the linked list, building graph edges
  4. For branch nodes, recursively walk each branch
  5. Generate human-readable names from node titles (slugify + deduplicate)
  6. Build name-to-key mapping
  7. Rewrite all variable expressions: replace real keys with DSL names
  8. Output:
     - Top-level: title, type, sync, description, options
     - trigger: workflow.config
     - graph: list of edges
     - nodes: map of name -> {type, title, config}
  9. For large configs (>50 lines), extract to components/ with $ref
```

### File structure for export

```
workflows/
  order_automation/
    workflow.yaml                  # main definition
    components/                    # extracted large configs
      review_schema.yaml
      approval_form.yaml
  daily_cleanup/
    workflow.yaml
  expense_approval/
    workflow.yaml
    components/
      approval_detail.yaml
```

When exporting as part of a project (`exportProject`), workflows go under a top-level
`workflows/` directory alongside `pages/` and `collections/`.

### Naming conventions

- Directory name: slugified workflow title (e.g., "Order Status Automation" -> `order_status_automation`)
- Node names: slugified node title, deduped with numeric suffix if needed
  (e.g., two "Update Status" nodes become `update_status` and `update_status_2`)
- Components: slugified node name + optional suffix (e.g., `review_schema.yaml`)

## Import (Deploy) Strategy

### Overview

Import is a two-phase process, similar to page deploy:

```
workflow.yaml (human-authored) --> deploy --> workflow-state.yaml (key registry)
```

### Phase 1: Create workflow shell

```
POST /api/workflows:create
{
  title, type, sync, enabled: false, options,
  config: <trigger config>
}
```

Save returned `id` and `key` to state.

### Phase 2: Create nodes (SERIAL, ordered by graph topology)

Walk the graph in topological order (chain head first, then downstream, depth-first into branches):

```
For each node in topological order:
  1. Resolve $ref if present
  2. Rewrite variable expressions: replace DSL names with real node keys (from state)
  3. POST /api/workflows/<workflowId>/nodes:create
     { type, title, upstreamId, branchIndex, config }
  4. Save returned id and key to state
```

**Critical**: Nodes must be created serially (one at a time) because the server adjusts
internal link relationships during each creation.

### Phase 3: Verify

```
GET /api/workflows:get?filterByTk=<id>&appends[]=nodes
```

Verify: node count, chain connectivity, all configs correct.

### Phase 4: Enable (with user confirmation)

```
POST /api/workflows:update?filterByTk=<id>
{ enabled: true }
```

### Incremental deploy (update existing)

When `workflow-state.yaml` already exists:

1. Check if workflow version has been executed (`versionStats.executed > 0`)
2. If executed: create new revision via `workflows:revision`, update state with new id
3. Compare current live nodes with DSL:
   - New nodes: create via `nodes:create`
   - Changed nodes: update via `flow_nodes:update`
   - Removed nodes: destroy via `flow_nodes:destroy`
   - Moved nodes: use `flow_nodes:move`
4. Update trigger config if changed: `workflows:update` with new `config`

### Variable rewriting during import

The key challenge is that variable references like `{{$jobsMapByNodeKey.calc_total}}` use
DSL names during authoring but must use real node keys at runtime.

Algorithm:
1. Maintain a `nameToKey` map, built incrementally as nodes are created
2. Before creating each node, scan its `config` JSON for patterns matching
   `\{\{\$jobsMapByNodeKey\.(\w+)` and `\{\{\$scopes\.(\w+)`
3. Replace DSL names with actual keys from `nameToKey`
4. If a referenced name hasn't been created yet (forward reference), this is an error —
   the graph must be topologically sorted so all upstream nodes are created first

## Integration with Page Builder

### Module-level workflow support

The existing `structure.yaml` spec gains a new `workflows` section:

```yaml
# structure.yaml
module: "Order Management"
icon: shoppingoutlined

collections:
  orders:
    title: "Orders"
    fields: [...]

pages:
  - page: "Order List"
    blocks: [...]

workflows:
  - file: workflows/order_automation/workflow.yaml
  - file: workflows/daily_cleanup/workflow.yaml
```

Or inline for simple workflows:

```yaml
workflows:
  - title: "Auto-update status on create"
    type: collection
    sync: false
    trigger:
      collection: orders
      mode: 1
    graph:
      - set_default_status
    nodes:
      set_default_status:
        type: update
        config:
          collection: orders
          params:
            filter:
              $and:
                - id: { $eq: "{{$context.data.id}}" }
            values:
              status: pending
```

### Action trigger binding

When a page has a `workflowTrigger` action, the workflow key must be bound to it.
This is handled in enhance.yaml:

```yaml
# enhance.yaml
bindings:
  - action: $OrderList.table.recordActions.workflowTrigger
    workflow: order_automation     # matches workflow directory name / state key
```

### Deploy order

1. Collections (data model must exist for workflow triggers/nodes that reference collections)
2. Workflows (trigger configs reference collection names)
3. Pages (action buttons may reference workflow keys)
4. Enhance (bindings connect page actions to workflows)

## State Tracking

### workflow-state.yaml

Alongside the existing `state.yaml` for pages, workflows get their own state file:

```yaml
# workflow-state.yaml
workflows:
  order_automation:
    id: 42
    key: "a1b2c3"
    version: 1
    nodes:
      check_status:
        id: 101
        key: "6qww6wh1wb8"
      update_inventory:
        id: 102
        key: "7rwx7xi2xc9"
      calc_total:
        id: 103
        key: "8syz8yj3yd0"
      create_log:
        id: 104
        key: "9tza9zk4ze1"
      notify_admin:
        id: 105
        key: "0uab0al5af2"

  daily_cleanup:
    id: 43
    key: "d4e5f6"
    version: 1
    nodes:
      delete_old_records:
        id: 201
        key: "1vbc1bm6bg3"
```

This state file is the bridge between human-readable DSL names and runtime IDs/keys.

### State usage

- **Export**: Read live system, build name-to-key mapping, write state
- **Import**: Read state to check if workflow exists; after creating new nodes, update state
- **Variable rewriting**: Use `nodes.<name>.key` to rewrite variable expressions

## Complete Examples

### Example 1: Simple order processing workflow

```yaml
# workflows/order_processing/workflow.yaml
title: "Order Processing"
type: collection
sync: false
description: "Process orders when status changes to paid"
options:
  deleteExecutionOnStatus: [1]

trigger:
  collection: orders
  mode: 2
  changed: [status]
  condition:
    $and:
      - status: { $eq: paid }
  appends: [customer, items]

graph:
  - query_inventory
  - query_inventory --> check_stock
  - check_stock --> [yes] deduct_stock
  - check_stock --> [no] notify_out_of_stock
  - deduct_stock --> calc_shipping
  - calc_shipping --> update_order
  - update_order --> send_confirmation

nodes:
  query_inventory:
    type: query
    title: "Query Product Inventory"
    config:
      collection: products
      multiple: false
      params:
        filter:
          $and:
            - id: { $eq: "{{$context.data.productId}}" }
      failOnEmpty: true

  check_stock:
    type: condition
    title: "Stock Sufficient?"
    config:
      rejectOnFalse: false
      engine: basic
      calculation:
        group:
          type: and
          calculations:
            - calculator: gte
              operands:
                - "{{$jobsMapByNodeKey.query_inventory.stock}}"
                - "{{$context.data.quantity}}"

  deduct_stock:
    type: calculation
    title: "Calculate New Stock"
    config:
      engine: formula.js
      expression: "{{$jobsMapByNodeKey.query_inventory.stock}} - {{$context.data.quantity}}"

  notify_out_of_stock:
    type: request
    title: "Notify Out of Stock"
    config:
      method: POST
      url: "{{$env.SLACK_WEBHOOK}}"
      contentType: application/json
      data:
        text: "Out of stock: order #{{$context.data.id}}"
      timeout: 5000

  calc_shipping:
    type: script
    title: "Calculate Shipping"
    config:
      arguments:
        - name: weight
          value: "{{$jobsMapByNodeKey.query_inventory.weight}}"
        - name: qty
          value: "{{$context.data.quantity}}"
        - name: region
          value: "{{$context.data.customer.region}}"
      content: |
        const rates = { domestic: 5, international: 15 };
        const rate = rates[region] || 10;
        return weight * qty * rate;
      timeout: 3000

  update_order:
    type: update
    title: "Update Order Total"
    config:
      collection: orders
      params:
        filter:
          $and:
            - id: { $eq: "{{$context.data.id}}" }
        values:
          shippingCost: "{{$jobsMapByNodeKey.calc_shipping}}"
          status: processing

  send_confirmation:
    type: notification
    config:
      message:
        channelName: in-app
        title: "Order Confirmed"
        content: "Your order #{{$context.data.id}} is being processed"
      ignoreFail: true
```

### Example 2: Approval workflow with parallel branches

```yaml
# workflows/expense_approval/workflow.yaml
title: "Expense Approval Flow"
type: approval
sync: false

trigger:
  collection: expenses
  mode: 0
  centralized: true
  appends: [department, receipts]
  withdrawable: true

graph:
  - check_amount
  - check_amount --> [yes] manager_approval
  - check_amount --> [no] auto_approve
  - manager_approval --> [approved] finance_check
  - manager_approval --> [rejected] notify_rejected
  - finance_check --> parallel_tasks
  - parallel_tasks --> [1] update_budget
  - parallel_tasks --> [2] create_payment
  - parallel_tasks --> notify_approved
  - auto_approve --> update_status

nodes:
  check_amount:
    type: condition
    title: "Amount > 5000?"
    config:
      rejectOnFalse: false
      engine: basic
      calculation:
        group:
          type: and
          calculations:
            - calculator: gt
              operands:
                - "{{$context.data.amount}}"
                - 5000

  manager_approval:
    type: approval
    title: "Manager Approval"
    config:
      branchMode: true
      assignees:
        - "{{$context.data.department.managerId}}"
      negotiation: 0
      endOnReject: false
      title: "Expense: {{$context.data.title}}"

  auto_approve:
    type: update
    title: "Auto Approve (Small Amount)"
    config:
      collection: expenses
      params:
        filter:
          $and:
            - id: { $eq: "{{$context.data.id}}" }
        values:
          status: approved
          approvedAt: "{{$system.now}}"

  finance_check:
    type: query
    title: "Check Budget Remaining"
    config:
      collection: budgets
      multiple: false
      params:
        filter:
          $and:
            - departmentId: { $eq: "{{$context.data.departmentId}}" }
        appends: []

  parallel_tasks:
    type: parallel
    title: "Post-Approval Tasks"
    config:
      mode: all

  update_budget:
    type: update
    title: "Deduct Budget"
    config:
      collection: budgets
      params:
        filter:
          $and:
            - departmentId: { $eq: "{{$context.data.departmentId}}" }
        values:
          remaining: "{{$jobsMapByNodeKey.finance_check.remaining}}"

  create_payment:
    type: create
    title: "Create Payment Record"
    config:
      collection: payments
      params:
        values:
          expenseId: "{{$context.data.id}}"
          amount: "{{$context.data.amount}}"
          status: pending

  notify_approved:
    type: notification
    config:
      message:
        channelName: in-app
        title: "Expense Approved"
        content: "Your expense #{{$context.data.id}} has been approved"

  notify_rejected:
    type: notification
    config:
      message:
        channelName: in-app
        title: "Expense Rejected"
        content: "Your expense #{{$context.data.id}} was rejected"

  update_status:
    type: update
    title: "Mark as Approved"
    config:
      collection: expenses
      params:
        filter:
          $and:
            - id: { $eq: "{{$context.data.id}}" }
        values:
          status: approved
```

### Example 3: Scheduled cleanup with loop

```yaml
title: "Daily Cleanup"
type: schedule
sync: false

trigger:
  mode: 0
  startsOn: "2026-01-01T02:00:00Z"
  repeat: "0 0 2 * * *"           # every day at 2am

graph:
  - query_expired
  - query_expired --> loop_items
  - loop_items --> [body] archive_record
  - archive_record --> delete_original
  - loop_items --> send_summary

nodes:
  query_expired:
    type: query
    config:
      collection: temp_records
      multiple: true
      params:
        filter:
          $and:
            - expiresAt: { $lt: "{{$system.now}}" }
        pageSize: 100

  loop_items:
    type: loop
    config:
      target: "{{$jobsMapByNodeKey.query_expired}}"
      exit: 2

  archive_record:
    type: create
    config:
      collection: archived_records
      params:
        values:
          originalId: "{{$scopes.loop_items.item.id}}"
          data: "{{$scopes.loop_items.item}}"
          archivedAt: "{{$system.now}}"

  delete_original:
    type: destroy
    config:
      collection: temp_records
      params:
        filter:
          $and:
            - id: { $eq: "{{$scopes.loop_items.item.id}}" }

  send_summary:
    type: request
    config:
      method: POST
      url: "{{$env.SLACK_WEBHOOK}}"
      contentType: application/json
      data:
        text: "Daily cleanup complete"
      timeout: 5000
```

## Open Questions

1. **Multi-workflow files**: Should we support multiple workflows in a single YAML file
   (using a `workflows:` array), or always one file per workflow? Current design: one per file.

2. **Workflow categories**: The API supports `categories` (many-to-many). Should the DSL
   include them? They are mainly organizational, not functional.

3. **Manual/Approval UI schemas**: These are complex Formily JSON objects generated by the UI.
   The $ref mechanism handles extraction, but round-trip fidelity of these schemas needs
   real-world testing. They may contain generated UIDs that need stabilization.

4. **Subflow references**: The `subflow` node references another workflow by `key`. During
   import, the referenced workflow must already exist. This implies a dependency ordering
   constraint for multi-workflow deploys.

5. **Event flow integration**: When a page action triggers a workflow (workflowTrigger action),
   the binding lives in the page's FlowModel, not in the workflow. This cross-reference needs
   coordination between page deploy and workflow deploy.

6. **Testing**: Should the deploy process auto-execute via `workflows:execute` with test data?
   Currently out of scope but could be a `--test` flag.
