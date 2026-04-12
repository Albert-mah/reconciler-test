/**
 * ACL deployer — reads YAML and applies roles/permissions to NocoBase.
 *
 * Import algorithm (from docs/acl-dsl-design.md §3.2):
 *   1. Resolve page title patterns to route IDs.
 *   2. Create/update roles (title, snippets, default, etc.).
 *   3. For each role, set data-source strategy.
 *   4. Create custom scopes, build key -> scopeId map.
 *   5. For each collection override, set usingActionsConfig + actions.
 *   6. Resolve page patterns, set route permissions.
 *
 * Idempotent — running twice produces the same result.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { NocoBaseClient } from '../client';
import { loadYaml } from '../utils/yaml';
import type {
  AclSpec,
  RoleSpec,
  ScopeSpec,
  CollectionPermissions,
  ActionPermissionSpec,
  AclActionName,
  ApiRole,
  ApiScope,
  ApiRouteNode,
} from './types';

/** Built-in roles that can be updated but not created or deleted. */
const BUILTIN_ROLES = new Set(['root', 'admin', 'member']);

type LogFn = (msg: string) => void;

export interface DeployAclOptions {
  /** Data source key (default: "main"). */
  dataSourceKey?: string;
  /** If true, only log what would change without making API calls. */
  dryRun?: boolean;
}

/**
 * Deploy ACL from a project directory.
 * Looks for `acl.yaml` in projectDir.
 */
export async function deployAcl(
  nb: NocoBaseClient,
  projectDir: string,
  log: LogFn = console.log,
  opts: DeployAclOptions = {},
): Promise<void> {
  const aclFile = path.join(path.resolve(projectDir), 'acl.yaml');
  if (!fs.existsSync(aclFile)) {
    log('  No acl.yaml found, skipping ACL deploy');
    return;
  }

  const spec = loadYaml<AclSpec>(aclFile);
  await deployAclSpec(nb, spec, log, opts);
}

/**
 * Deploy an ACL spec object to NocoBase.
 */
export async function deployAclSpec(
  nb: NocoBaseClient,
  spec: AclSpec,
  log: LogFn = console.log,
  opts: DeployAclOptions = {},
): Promise<void> {
  const ds = opts.dataSourceKey ?? 'main';
  const dryRun = opts.dryRun ?? false;
  const prefix = dryRun ? '  [dry-run]' : ' ';

  // ── Step 0: Validate ──
  validateSpec(spec);
  log('  ACL spec validated');

  // ── Step 1: Fetch current state ──
  log('  Fetching current roles...');
  const existingRoles = await fetchRoles(nb);
  const existingRoleNames = new Set(existingRoles.map(r => r.name));

  log('  Fetching scopes...');
  const existingScopes = await fetchScopes(nb, ds);
  const scopeByKey = new Map<string, ApiScope>();
  for (const s of existingScopes) {
    scopeByKey.set(s.key, s);
  }

  log('  Fetching route tree...');
  const routeTree = await fetchRouteTree(nb);
  const routePathToIds = buildRoutePatternResolver(routeTree);

  // ── Step 2: Create custom scopes ──
  const scopeKeyToId = new Map<string, string | number>();
  // Pre-populate with existing scopes
  for (const s of existingScopes) {
    scopeKeyToId.set(s.key, s.id);
  }

  if (spec.scopes) {
    for (const [key, scopeDef] of Object.entries(spec.scopes)) {
      if (scopeByKey.has(key)) {
        // Update existing scope if filter changed
        const existing = scopeByKey.get(key)!;
        const changed = JSON.stringify(existing.scope) !== JSON.stringify(scopeDef.filter)
          || existing.name !== scopeDef.title
          || existing.resourceName !== scopeDef.collection;

        if (changed && !dryRun) {
          await nb.http.post(
            `${nb.baseUrl}/api/dataSources/${ds}/rolesResourcesScopes:update`,
            {
              key,
              name: scopeDef.title,
              resourceName: scopeDef.collection,
              scope: scopeDef.filter,
            },
            { params: { filterByTk: existing.id } },
          );
        }
        log(`${prefix} Scope '${key}': ${changed ? 'updated' : 'unchanged'}`);
        scopeKeyToId.set(key, existing.id);
      } else {
        // Create new scope
        if (!dryRun) {
          const resp = await nb.http.post(
            `${nb.baseUrl}/api/dataSources/${ds}/rolesResourcesScopes:create`,
            {
              key,
              name: scopeDef.title,
              resourceName: scopeDef.collection,
              scope: scopeDef.filter,
            },
          );
          const created = resp.data.data;
          if (created?.id) {
            scopeKeyToId.set(key, created.id);
          }
        }
        log(`${prefix} Scope '${key}': created`);
      }
    }
  }

  // ── Step 3: Create/update roles ──
  for (const [roleName, roleSpec] of Object.entries(spec.roles)) {
    if (existingRoleNames.has(roleName)) {
      // Update existing role
      if (!dryRun) {
        await nb.http.post(
          `${nb.baseUrl}/api/roles:update`,
          buildRolePayload(roleSpec),
          { params: { filterByTk: roleName } },
        );
      }
      log(`${prefix} Role '${roleName}': updated`);
    } else if (BUILTIN_ROLES.has(roleName)) {
      log(`${prefix} Role '${roleName}': built-in, skip create`);
    } else {
      // Create new role
      if (!dryRun) {
        await nb.http.post(
          `${nb.baseUrl}/api/roles:create`,
          { name: roleName, ...buildRolePayload(roleSpec) },
        );
      }
      log(`${prefix} Role '${roleName}': created`);
    }

    // ── Step 4: Set data-source strategy ──
    if (roleSpec.strategy) {
      if (!dryRun) {
        await nb.http.post(
          `${nb.baseUrl}/api/dataSources/${ds}/roles:update`,
          { strategy: { actions: roleSpec.strategy.actions } },
          { params: { filterByTk: roleName } },
        );
      }
      log(`${prefix} Role '${roleName}' strategy: [${roleSpec.strategy.actions.join(', ')}]`);
    }

    // ── Step 5: Set per-collection permissions ──
    if (roleSpec.collections) {
      for (const [collName, collPerms] of Object.entries(roleSpec.collections)) {
        const actions = buildActionsPayload(collPerms, scopeKeyToId);
        if (!dryRun) {
          // Try update first; if 404, create
          try {
            await nb.http.post(
              `${nb.baseUrl}/api/roles/${roleName}/dataSourceResources:update`,
              { usingActionsConfig: true, actions },
              {
                params: {
                  'filter[dataSourceKey]': ds,
                  'filter[name]': collName,
                },
              },
            );
          } catch (err: unknown) {
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 404 || status === 500) {
              // Resource doesn't exist yet, create it
              await nb.http.post(
                `${nb.baseUrl}/api/roles/${roleName}/dataSourceResources:create`,
                {
                  dataSourceKey: ds,
                  name: collName,
                  usingActionsConfig: true,
                  actions,
                },
              );
            } else {
              throw err;
            }
          }
        }
        log(`${prefix} Role '${roleName}' → ${collName}: ${actions.length} actions`);
      }
    }

    // ── Step 6: Set route permissions ──
    if (roleSpec.pages) {
      const routeIds = resolvePagePatterns(roleSpec.pages, routePathToIds, routeTree);
      if (!dryRun && routeIds.length) {
        await nb.http.post(
          `${nb.baseUrl}/api/roles/${roleName}/desktopRoutes:set`,
          { values: routeIds },
        );
      }
      log(`${prefix} Role '${roleName}' routes: ${routeIds.length} pages`);
    }
  }

  log('  ACL deploy complete');
}

// ── Validation ──

function validateSpec(spec: AclSpec): void {
  if (!spec.roles || typeof spec.roles !== 'object') {
    throw new Error('acl.yaml: "roles" key is required');
  }

  const validActions: AclActionName[] = ['create', 'view', 'update', 'destroy', 'export', 'importXlsx'];
  const scopeKeys = new Set(Object.keys(spec.scopes || {}));
  const builtinScopes = new Set(['all', 'own']);

  for (const [roleName, roleSpec] of Object.entries(spec.roles)) {
    if (!roleSpec.title) {
      throw new Error(`acl.yaml: role '${roleName}' must have a title`);
    }

    if (roleSpec.collections) {
      for (const [collName, collPerms] of Object.entries(roleSpec.collections)) {
        for (const actionName of Object.keys(collPerms)) {
          if (!validActions.includes(actionName as AclActionName)) {
            throw new Error(
              `acl.yaml: role '${roleName}' collection '${collName}' has invalid action '${actionName}'`,
            );
          }
          const actionSpec = collPerms[actionName as AclActionName];
          if (actionSpec && typeof actionSpec === 'object' && 'scope' in actionSpec) {
            const scopeRef = (actionSpec as ActionPermissionSpec).scope;
            if (scopeRef && !builtinScopes.has(scopeRef) && !scopeKeys.has(scopeRef)) {
              throw new Error(
                `acl.yaml: role '${roleName}' collection '${collName}' action '${actionName}' ` +
                `references undefined scope '${scopeRef}'`,
              );
            }
          }
        }
      }
    }
  }
}

// ── Payload builders ──

function buildRolePayload(spec: RoleSpec): Record<string, unknown> {
  const payload: Record<string, unknown> = { title: spec.title };
  if (spec.description != null) payload.description = spec.description;
  if (spec.default != null) payload.default = spec.default;
  if (spec.snippets != null) payload.snippets = spec.snippets;
  if (spec.allowConfigure != null) payload.allowConfigure = spec.allowConfigure;
  if (spec.allowNewMenu != null) payload.allowNewMenu = spec.allowNewMenu;
  return payload;
}

function buildActionsPayload(
  collPerms: CollectionPermissions,
  scopeKeyToId: Map<string, string | number>,
): Record<string, unknown>[] {
  const actions: Record<string, unknown>[] = [];

  for (const [actionName, actionSpec] of Object.entries(collPerms)) {
    const action: Record<string, unknown> = { name: actionName };

    if (actionSpec && typeof actionSpec === 'object' && !Array.isArray(actionSpec)) {
      const spec = actionSpec as ActionPermissionSpec;

      // Resolve scope to scopeId
      if (spec.scope) {
        const scopeId = scopeKeyToId.get(spec.scope);
        if (scopeId != null) {
          action.scopeId = scopeId;
        }
      }

      // Fields
      if (spec.fields?.length) {
        action.fields = spec.fields;
      } else {
        action.fields = [];
      }
    } else {
      action.fields = [];
    }

    actions.push(action);
  }

  return actions;
}

// ── Route pattern resolution ──

interface RoutePathEntry {
  id: number;
  path: string;
  type: string;
  children: RoutePathEntry[];
}

function buildRoutePatternResolver(routes: ApiRouteNode[]): Map<string, RoutePathEntry> {
  const map = new Map<string, RoutePathEntry>();

  function walk(nodes: ApiRouteNode[], prefix: string): void {
    for (const node of nodes) {
      if (node.type === 'tabs') continue;
      const pathPart = node.title || String(node.id);
      const fullPath = prefix ? `${prefix}/${pathPart}` : pathPart;
      const entry: RoutePathEntry = {
        id: node.id,
        path: fullPath,
        type: node.type,
        children: [],
      };
      map.set(fullPath, entry);

      if (node.children?.length) {
        walk(node.children, fullPath);
        // Re-read children after recursion to populate entry.children
        for (const child of node.children) {
          if (child.type === 'tabs') continue;
          const childPath = `${fullPath}/${child.title || String(child.id)}`;
          const childEntry = map.get(childPath);
          if (childEntry) entry.children.push(childEntry);
        }
      }
    }
  }
  walk(routes, '');
  return map;
}

function collectAllIds(entry: RoutePathEntry): number[] {
  const ids = [entry.id];
  for (const child of entry.children) {
    ids.push(...collectAllIds(child));
  }
  return ids;
}

/**
 * Resolve page patterns to a list of route IDs.
 *
 * Pattern rules:
 * - "Group/Page" → exact match
 * - "Group/**"   → group + all descendants
 * - "Group/*"    → direct children only
 * - "*"          → all routes
 * - "!Group/Page" → exclude
 */
function resolvePagePatterns(
  patterns: string[],
  routePathMap: Map<string, RoutePathEntry>,
  routeTree: ApiRouteNode[],
): number[] {
  const included = new Set<number>();
  const excluded = new Set<number>();

  // Process includes first
  for (const pattern of patterns) {
    if (pattern.startsWith('!')) continue;

    if (pattern === '*') {
      // All routes
      for (const entry of routePathMap.values()) {
        included.add(entry.id);
      }
    } else if (pattern.endsWith('/**')) {
      // Group + all descendants
      const groupPath = pattern.slice(0, -3);
      const groupEntry = routePathMap.get(groupPath);
      if (groupEntry) {
        for (const id of collectAllIds(groupEntry)) {
          included.add(id);
        }
      }
    } else if (pattern.endsWith('/*')) {
      // Direct children only
      const groupPath = pattern.slice(0, -2);
      const groupEntry = routePathMap.get(groupPath);
      if (groupEntry) {
        included.add(groupEntry.id);
        for (const child of groupEntry.children) {
          included.add(child.id);
        }
      }
    } else {
      // Exact match
      const entry = routePathMap.get(pattern);
      if (entry) {
        included.add(entry.id);
        // Also include parent groups so the route is visible in navigation
        includeParentGroups(pattern, routePathMap, included);
      }
    }
  }

  // Process excludes
  for (const pattern of patterns) {
    if (!pattern.startsWith('!')) continue;
    const cleanPattern = pattern.slice(1);

    if (cleanPattern.endsWith('/**')) {
      const groupPath = cleanPattern.slice(0, -3);
      const entry = routePathMap.get(groupPath);
      if (entry) {
        for (const id of collectAllIds(entry)) {
          excluded.add(id);
        }
      }
    } else {
      const entry = routePathMap.get(cleanPattern);
      if (entry) {
        excluded.add(entry.id);
      }
    }
  }

  return [...included].filter(id => !excluded.has(id)).sort((a, b) => a - b);
}

/**
 * When granting an individual page, also include its parent group routes
 * so the page is visible in navigation.
 */
function includeParentGroups(
  pagePath: string,
  routePathMap: Map<string, RoutePathEntry>,
  included: Set<number>,
): void {
  const parts = pagePath.split('/');
  for (let i = 1; i < parts.length; i++) {
    const parentPath = parts.slice(0, i).join('/');
    const parentEntry = routePathMap.get(parentPath);
    if (parentEntry && parentEntry.type === 'group') {
      included.add(parentEntry.id);
    }
  }
}

// ── API fetch helpers (same as exporter, kept local to avoid circular deps) ──

async function fetchRoles(nb: NocoBaseClient): Promise<ApiRole[]> {
  const resp = await nb.http.get(`${nb.baseUrl}/api/roles:list`, {
    params: { paginate: 'false' },
  });
  return (resp.data.data || []) as ApiRole[];
}

async function fetchScopes(nb: NocoBaseClient, ds: string): Promise<ApiScope[]> {
  const resp = await nb.http.get(`${nb.baseUrl}/api/dataSources/${ds}/rolesResourcesScopes:list`, {
    params: { paginate: 'false' },
  });
  return (resp.data.data || []) as ApiScope[];
}

async function fetchRouteTree(nb: NocoBaseClient): Promise<ApiRouteNode[]> {
  const resp = await nb.http.get(`${nb.baseUrl}/api/desktopRoutes:list`, {
    params: { paginate: 'false', tree: 'true' },
  });
  return (resp.data.data || []) as ApiRouteNode[];
}
