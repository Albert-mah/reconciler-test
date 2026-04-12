# ACL DSL Design for NocoBase Reconciler

> Design doc for declarative role/permission export and import in the reconciler system.
> Status: DRAFT  |  Date: 2026-04-12

---

## 1. Background

The reconciler already handles **structure.yaml** (collections + pages) and **enhance.yaml** (popups + JS).
Permissions are the missing layer: who can see which pages and do what with which data.

The NocoBase ACL model has 7 layers (from the official skill docs):

1. **Role identity** -- name, title, default, snippets
2. **System role mode** -- default / allow-use-union / only-use-union (instance-global)
3. **System permissions** -- snippets like `ui.*`, `pm`, `pm.*`, `app`
4. **Route permissions** -- which desktop/mobile pages a role can see
5. **Global table strategy** -- broad data-source-level actions (e.g. `view`, `create`, `update:own`)
6. **Independent collection permissions** -- per-collection action overrides with `usingActionsConfig: true`
7. **Row scopes + field permissions** -- per-action field lists and scope filters

---

## 2. Proposed YAML Format: `acl.yaml`

A single file per module, lives alongside `structure.yaml`.

### 2.1 Minimal example

```yaml
# acl.yaml -- CRM permissions

scopes:
  own_customers:
    collection: nb_crm_customers
    title: Own customers
    filter:
      $and:
        - owner_id: { $eq: "{{$user.id}}" }

  own_contacts:
    collection: nb_crm_contacts
    title: Own contacts
    filter:
      $or:
        - owner_id: { $eq: "{{$user.id}}" }
        - customer.owner_id: { $eq: "{{$user.id}}" }

roles:
  sales_rep:
    title: Sales Representative
    snippets: ["!ui.*", "!pm", "!pm.*"]

    strategy:
      actions: [view, create, update:own]

    pages:
      - Main/**          # grant the whole group + children
      - "!Main/Analytics" # exclude Analytics page

    collections:
      nb_crm_customers:
        create: { scope: all }
        view:   { scope: own_customers }
        update: { scope: own_customers }
        destroy: { scope: own_customers }
        export: { scope: own_customers }

      nb_crm_contacts:
        create: { scope: all }
        view:   { scope: own_contacts }
        update:
          scope: own_contacts
          fields: [name, email, phone, notes]  # restrict editable fields
        destroy: { scope: own_contacts }

      nb_crm_leads:
        view: {}   # empty = use all fields, all scope
        create: {}
        update:
          scope: own
          fields: [name, source, status, industry, notes, next_step]

  sales_manager:
    title: Sales Manager
    snippets: ["!ui.*", "!pm", "!pm.*"]

    strategy:
      actions: [view, create, update, destroy, export, importXlsx]

    pages:
      - Main/**
      - Other/Stage Settings

    collections:
      nb_crm_customers:
        view:   {}
        create: {}
        update: {}
        destroy: {}
        export: {}
        importXlsx: {}

      nb_crm_opportunities:
        view:   {}
        create: {}
        update: {}
        destroy: {}
        export:
          fields: [name, stage, amount, close_date, owner, customer]

  viewer:
    title: Read-only Analyst
    default: false
    snippets: ["!ui.*", "!pm", "!pm.*"]

    strategy:
      actions: [view]

    pages:
      - Main/Analytics
      - Main/Overview
```

### 2.2 Full schema reference

```yaml
# ---------- Top-level keys ----------

scopes:              # Named scope definitions (optional)
  <scope_key>:       # Arbitrary key, referenced by roles
    collection: str  # resourceName in NocoBase
    title: str       # Human-readable name
    filter: object   # NocoBase filter format (MUST wrap with $and/$or)

roles:               # Role definitions (required)
  <role_name>:       # maps to roles.name (e.g. "sales_rep")
    title: str       # maps to roles.title
    description: str # optional
    default: bool    # auto-assign to new users (default: false)
    snippets: list   # system permission snippets
                     # common: ["ui.*", "pm", "pm.*", "app"]
                     # deny prefix: "!" (e.g. "!ui.*")
    allowConfigure: bool   # optional (default: null)
    allowNewMenu: bool     # optional (default: false)

    # ---------- Global table strategy ----------
    strategy:
      actions: list  # e.g. [view, create, update, destroy, export, importXlsx]
                     # supports :own suffix: [view:own, update:own]

    # ---------- Route (page) visibility ----------
    pages: list      # patterns referencing page titles from structure.yaml
                     # "GroupTitle/PageTitle" -- exact page
                     # "GroupTitle/**"        -- group + all children
                     # "!GroupTitle/PageTitle" -- exclude
                     # "*"                    -- all pages (for admin-like roles)

    # ---------- Per-collection overrides ----------
    collections:     # only collections that need independent permissions
      <collection_name>:
        # Each action key is one of:
        #   create, view, update, destroy, export, importXlsx
        <action_name>:
          scope: str   # optional. Values:
                       #   "all"   -- built-in, no row restriction
                       #   "own"   -- built-in, createdById = current user
                       #   <key>   -- reference to scopes.<key> above
                       # omitted  -- no scope (= all rows)
          fields: list # optional. field names this action can access
                       #   omitted or empty [] = no field restriction
                       #   non-empty = whitelist of allowed fields
```

### 2.3 Design decisions

**Why a flat `<action>: {scope, fields}` map instead of an actions array?**
The NocoBase API stores actions as an array with `name`, `fields`, `scopeId`. But for human/AI authoring, a map keyed by action name is more readable and prevents duplicate action entries.

**Why `scope: own_customers` (string ref) instead of inline filter?**
Scopes are reusable across roles and collections. String references make the YAML DRY and prevent copy-paste errors. Built-in scopes `all` and `own` are always available without being declared in `scopes:`.

**Why glob-like page patterns instead of route IDs?**
Route IDs are numeric and meaningless. Page titles come from `structure.yaml` and are what the AI already knows. The reconciler resolves titles to route IDs at deploy time.

**Why `fields: []` (empty) means "no restriction"?**
This matches NocoBase's own API behavior where `fields: []` on `dataSourcesRolesResourcesActions` means "no field restrictions" (full access).

**When `collections:` is omitted entirely**
The role falls back to the global `strategy` for all collections. This is the correct choice when no collection needs special treatment.

**When a collection is listed but an action is missing**
The collection gets `usingActionsConfig: true`, and only the listed actions are allowed. Unlisted actions are denied for that collection.

---

## 3. API Endpoints for Export/Import

### 3.1 Export (read current state)

To fully export a role's ACL config, the reconciler must call these endpoints in sequence:

| Step | Endpoint | Purpose |
|------|----------|---------|
| 1 | `GET roles:list?paginate=false` | All role definitions (name, title, snippets, strategy, etc.) |
| 2 | `GET dataSources/main/roles:get?filterByTk=<roleName>` | Data-source-level strategy for each role |
| 3 | `GET dataSources/main/rolesResourcesScopes:list?paginate=false` | All scopes (built-in + custom) |
| 4 | `GET roles/<roleName>/dataSourcesCollections:list?filter[dataSourceKey]=main&pageSize=200` | Per-collection config mode (strategy vs resourceAction) |
| 5 | `GET roles/<roleName>/dataSourceResources:get?filter[dataSourceKey]=main&filter[name]=<coll>&appends[]=actions&appends[]=actions.scope` | Independent permission detail (actions + fields + scopes) |
| 6 | `GET roles/<roleName>/desktopRoutes:list?paginate=false` | Granted route IDs |
| 7 | `GET desktopRoutes:list?tree=true&paginate=false` | Full route tree (to resolve IDs to titles) |

**Export algorithm:**
1. Fetch all roles and filter out `root` and `anonymous`.
2. For each role, fetch data-source strategy, route permissions, and collection list.
3. For collections where `usingConfig == "resourceAction"`, fetch independent permissions.
4. Fetch all scopes, build a `scopeId -> key` reverse map.
5. Fetch the route tree, build `routeId -> "Group/Page"` path map.
6. Emit YAML using the schema above.

### 3.2 Import (apply desired state)

Import is a reconciliation pass: compare desired state (acl.yaml) with current state, then apply changes.

| Step | Endpoint | Method | Purpose |
|------|----------|--------|---------|
| 1 | `roles:create` | POST | Create roles that don't exist |
| 2 | `roles:update?filterByTk=<name>` | POST | Update role metadata (title, snippets, allowConfigure, etc.) |
| 3 | `dataSources/main/roles:update?filterByTk=<roleName>` | POST | Set global strategy for data source |
| 4 | `dataSources/main/rolesResourcesScopes:create` | POST | Create custom scopes that don't exist |
| 5 | `roles/<roleName>/dataSourceResources:update?filter[dataSourceKey]=main&filter[name]=<coll>` | POST | Set independent permissions (usingActionsConfig + actions w/ fields + scopeId) |
| 6 | `roles/<roleName>/desktopRoutes:set` | POST | Set route permissions (array of route IDs) |

**Import algorithm:**
1. Resolve page title patterns to route IDs using the route tree.
2. Create/update roles (title, snippets, default, allowConfigure, allowNewMenu).
3. For each role, set data-source strategy via `dataSources/main/roles:update`.
4. Fetch existing scopes; create any new custom scopes. Build `key -> scopeId` map.
5. For each collection override:
   - Set `usingActionsConfig: true`
   - Build actions array with resolved scopeId and field lists
   - POST to `dataSourceResources:update`
6. Resolve page patterns and POST to `roles/<name>/desktopRoutes:set`.

**Scope resolution rules:**
- `scope: all` -> use built-in scope with `key: "all"` (look up its numeric ID)
- `scope: own` -> use built-in scope with `key: "own"` (look up its numeric ID)
- `scope: <custom_key>` -> look up in the `scopes:` section of acl.yaml, create if needed, use its ID
- scope omitted -> `scopeId: null` (no scope = all rows)

**Field resolution rules:**
- `fields: [a, b, c]` -> pass as-is to the API
- `fields` omitted or `fields: []` -> pass `[]` (no restriction)

---

## 4. Page Visibility Integration

### 4.1 How it works with structure.yaml

The `pages:` section in acl.yaml references the same page/group titles as structure.yaml:

```yaml
# structure.yaml                     # acl.yaml
module: Main                          pages:
pages:                                  - Main/**          # whole group
  - page: Overview                      - "!Main/Analytics" # exclude one
  - page: Customers
  - page: Analytics
```

At deploy time, the reconciler already knows the route IDs from state.yaml.
The ACL deployer does:
1. Parse page patterns from acl.yaml
2. Load route tree (from state.yaml or API)
3. Match patterns against `"GroupTitle/PageTitle"` paths
4. Collect matching route IDs (include children for `/**` patterns)
5. Apply exclusions (patterns starting with `!`)
6. Call `roles/<name>/desktopRoutes:set` with the final ID list

### 4.2 Pattern matching rules

| Pattern | Matches |
|---------|---------|
| `Main/Customers` | Exactly the "Customers" page under "Main" group |
| `Main/**` | The "Main" group and ALL its children (pages + sub-groups) |
| `Other/*` | Direct children of "Other" group only (not nested) |
| `*` | ALL routes (admin-like access) |
| `!Main/Analytics` | Exclude "Analytics" (used after an include pattern) |

Processing order: includes first, then exclusions remove from the set.

### 4.3 Default behavior

- If `pages:` is omitted -> role gets NO page access (safe default)
- If `pages: ["*"]` -> role gets ALL pages (admin-like)

---

## 5. Full CRM Example

This example shows how the three layers work together.

### structure.yaml (already exists)
```yaml
module: Main
icon: dashboardoutlined
pages:
  - page: Overview
  - page: Leads
    coll: nb_crm_leads
  - page: Customers
    coll: nb_crm_customers
  - page: Opportunities
    coll: nb_crm_opportunities
  - page: Orders
    coll: nb_crm_orders
  - page: Analytics
```

### acl.yaml (new)
```yaml
scopes:
  owner_customers:
    collection: nb_crm_customers
    title: Own customers
    filter:
      $and:
        - owner_id: { $eq: "{{$user.id}}" }

  owner_leads:
    collection: nb_crm_leads
    title: Own leads
    filter:
      $and:
        - owner_id: { $eq: "{{$user.id}}" }

  owner_opportunities:
    collection: nb_crm_opportunities
    title: Own opportunities
    filter:
      $and:
        - owner_id: { $eq: "{{$user.id}}" }

  owner_contacts:
    collection: nb_crm_contacts
    title: Own contacts
    filter:
      $or:
        - owner_id: { $eq: "{{$user.id}}" }
        - customer.owner_id: { $eq: "{{$user.id}}" }

roles:
  sales_rep:
    title: Sales Representative
    snippets: ["!ui.*", "!pm", "!pm.*"]
    allowNewMenu: false

    strategy:
      actions: [view, create, update:own]

    pages:
      - Main/Overview
      - Main/Leads
      - Main/Customers
      - Main/Opportunities
      - Main/Orders

    collections:
      nb_crm_leads:
        create: {}
        view:   { scope: owner_leads }
        update:
          scope: owner_leads
          fields: [name, source, status, industry, notes, score, next_step]
        destroy: { scope: owner_leads }

      nb_crm_customers:
        create: {}
        view:   { scope: owner_customers }
        update: { scope: owner_customers }
        destroy: { scope: owner_customers }

      nb_crm_opportunities:
        create: {}
        view:   { scope: owner_opportunities }
        update:
          scope: owner_opportunities
          fields: [name, stage, amount, close_date, probability, next_step, notes]
        destroy: { scope: owner_opportunities }

      nb_crm_contacts:
        create: {}
        view:   { scope: owner_contacts }
        update:
          scope: owner_contacts
          fields: [name, email, phone, title, department, notes]

  sales_manager:
    title: Sales Manager
    snippets: ["!ui.*", "!pm", "!pm.*"]
    allowNewMenu: false

    strategy:
      actions: [view, create, update, destroy, export]

    pages:
      - Main/**

    # No collections overrides -- all collections follow global strategy
    # Manager sees all records with full CRUD + export

  executive:
    title: Executive
    snippets: ["!ui.*", "!pm", "!pm.*"]

    strategy:
      actions: [view, export]

    pages:
      - Main/Overview
      - Main/Analytics

    # Read-only, no collection overrides needed

  support:
    title: Support Specialist
    snippets: ["!ui.*", "!pm", "!pm.*"]

    strategy:
      actions: [view]

    pages:
      - Main/Customers
      - Main/Orders
      - Other/Contacts

    collections:
      nb_crm_customers:
        view: {}
        # Support can view all customers (no scope) but cannot edit

      nb_crm_orders:
        view: {}
        update:
          scope: own
          fields: [status, support_notes, resolution]
        # Support can update only their own orders, and only status-related fields
```

---

## 6. Edge Cases & Validation

### 6.1 Validation rules the reconciler should enforce

1. **Scope references must resolve.** If `scope: owner_customers` is used, `scopes.owner_customers` must exist in the file (or be a built-in like `all`/`own`).
2. **Collection names must exist.** Cross-reference against collections from `structure.yaml` or the NocoBase API.
3. **Action names must be valid.** Only: `create`, `view`, `update`, `destroy`, `export`, `importXlsx`.
4. **Page patterns must resolve.** At least one route must match each include pattern.
5. **Scope filter format.** Custom scopes must have `$and` or `$or` at root level.
6. **Field names must exist on the collection.** Warn (not error) if a field in `fields:` is not found on the collection.
7. **Built-in roles are immutable.** `root`, `admin`, `member` cannot be created or deleted. They can be updated (strategy, pages, snippets).
8. **No duplicate scope keys.** Scope keys must be unique across the file.

### 6.2 Idempotency

The import must be idempotent:
- Running it twice with the same acl.yaml produces the same result.
- Scopes are matched by `key` field, not by numeric ID.
- Resources are matched by `roleName + dataSourceKey + name`.
- Route permissions are set as a complete list (not incremental add/remove).

### 6.3 Deletion handling

When a role in NocoBase is NOT present in acl.yaml:
- Default: **leave it alone** (no destructive changes)
- Optional `--prune` flag: delete roles not in the file (except built-in ones)

When a collection override is removed from acl.yaml:
- The reconciler should set `usingActionsConfig: false` for that collection, reverting it to global strategy.

---

## 7. Implementation Plan

### Phase 1: Export (read-only, no risk)
- New command: `reconciler acl export --output acl.yaml`
- Reads all roles, strategies, scopes, resources, routes from API
- Generates the YAML format above
- Useful for understanding current state and as a starting point for editing

### Phase 2: Import (apply changes)
- New command: `reconciler acl deploy acl.yaml`
- Validates the YAML
- Reconciles against current state
- Applies changes via API
- Reports what changed (created/updated/skipped)

### Phase 3: Integration with structure deploy
- When running `reconciler deploy`, if `acl.yaml` exists alongside `structure.yaml`, apply ACL after pages are deployed
- This ensures route IDs are available for page permission resolution

### File layout
```
exports/crm/
  structure.yaml    # collections + pages
  state.yaml        # UID registry (auto-generated)
  enhance.yaml      # popups + JS
  acl.yaml          # permissions (new)
```

---

## 8. API Reference Summary

### Read endpoints

| Resource | Endpoint | Key params |
|----------|----------|------------|
| All roles | `GET roles:list?paginate=false` | |
| Role detail | `GET roles:get?filterByTk=<name>` | |
| DS strategy | `GET dataSources/main/roles:get?filterByTk=<roleName>` | |
| All scopes | `GET dataSources/main/rolesResourcesScopes:list?paginate=false` | |
| Collection list | `GET roles/<name>/dataSourcesCollections:list?filter[dataSourceKey]=main&pageSize=200` | |
| Resource detail | `GET roles/<name>/dataSourceResources:get?filter[dataSourceKey]=main&filter[name]=<coll>&appends[]=actions&appends[]=actions.scope` | |
| Route permissions | `GET roles/<name>/desktopRoutes:list?paginate=false` | Returns granted route records |
| Route tree | `GET desktopRoutes:list?tree=true&paginate=false` | Full tree with IDs and titles |
| Available actions | `GET availableActions:list` | Action metadata (name, allowConfigureFields) |

### Write endpoints

| Resource | Endpoint | Body |
|----------|----------|------|
| Create role | `POST roles:create` | `{name, title, snippets, strategy, default, ...}` |
| Update role | `POST roles:update?filterByTk=<name>` | `{title, snippets, strategy, ...}` |
| Set DS strategy | `POST dataSources/main/roles:update?filterByTk=<name>` | `{strategy: {actions: [...]}}` |
| Create scope | `POST dataSources/main/rolesResourcesScopes:create` | `{key, name, resourceName, scope}` |
| Set resource perms | `POST roles/<name>/dataSourceResources:update?filter[dataSourceKey]=main&filter[name]=<coll>` | `{usingActionsConfig: true, actions: [{name, fields, scopeId}, ...]}` |
| Create resource perms | `POST roles/<name>/dataSourceResources:create` | `{dataSourceKey: "main", name: "<coll>", usingActionsConfig: true, actions: [...]}` |
| Set route perms | `POST roles/<name>/desktopRoutes:set` | `{values: [routeId1, routeId2, ...]}` |

### Key data model (DB collections)

| Collection | Purpose | Key fields |
|------------|---------|------------|
| `roles` | Role definitions | name (PK), title, strategy, snippets, default, hidden |
| `dataSourcesRoles` | Per-data-source strategy | roleName, dataSourceKey, strategy |
| `dataSourcesRolesResources` | Per-collection overrides | roleName, dataSourceKey, name, usingActionsConfig |
| `dataSourcesRolesResourcesActions` | Action configs | name, fields[], scopeId, rolesResourceId |
| `dataSourcesRolesResourcesScopes` | Scope definitions | key, name, resourceName, scope, dataSourceKey |
| `desktopRoutes` | Page routes | id, title, type, parentId |

---

## 9. Open Questions

1. **Mobile routes.** The same pattern could support `roles.mobileRoutes:set`, but mobile pages may have a different structure. Defer to Phase 2+.

2. **Multi-data-source.** Currently hardcoded to `main`. If the reconciler needs to support external data sources, the YAML format would need a `dataSource:` wrapper.

3. **Scope deduplication.** If two modules define the same scope key with different filters, which wins? Proposal: first-write-wins with a warning.

4. **User-role assignments.** The YAML defines roles and their permissions, but not which users have which roles. User-role mapping is an operational concern, not a code concern. Keep it out of acl.yaml.

5. **The `dataSources/main/roles:update` endpoint can also accept `resources` array.** This is a bulk-write shortcut that destroys and recreates all resources for the role. Safer to use per-resource endpoints for incremental reconciliation.
