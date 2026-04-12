/**
 * ACL exporter — reads roles and permissions from NocoBase API, writes YAML.
 *
 * Export algorithm (from docs/acl-dsl-design.md §3.1):
 *   1. Fetch all roles, filter out root/anonymous.
 *   2. For each role, fetch data-source strategy, route permissions, collection list.
 *   3. For collections where usingConfig == "resourceAction", fetch independent permissions.
 *   4. Fetch all scopes, build scopeId -> key reverse map.
 *   5. Fetch route tree, build routeId -> "Group/Page" path map.
 *   6. Emit YAML.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { NocoBaseClient } from '../client';
import { dumpYaml } from '../utils/yaml';
import type {
  AclSpec,
  RoleSpec,
  ScopeSpec,
  CollectionPermissions,
  ActionPermissionSpec,
  AclActionName,
  ApiRole,
  ApiDataSourceRole,
  ApiScope,
  ApiCollectionConfig,
  ApiResource,
  ApiRouteNode,
} from './types';

/** Roles to skip during export (system roles). */
const SKIP_ROLES = new Set(['root']);

/** Built-in scope keys that don't need to be declared in scopes:. */
const BUILTIN_SCOPE_KEYS = new Set(['all', 'own']);

type LogFn = (msg: string) => void;

export interface ExportAclOptions {
  /** Output directory. Files will be written to <outDir>/acl/. */
  outDir: string;
  /** Only export these role names. If empty/undefined, export all. */
  roles?: string[];
  /** Data source key (default: "main"). */
  dataSourceKey?: string;
}

/**
 * Export ACL to YAML files.
 *
 * Output:
 *   <outDir>/acl.yaml  — single consolidated file
 */
export async function exportAcl(
  nb: NocoBaseClient,
  opts: ExportAclOptions,
  log: LogFn = console.log,
): Promise<AclSpec> {
  const ds = opts.dataSourceKey ?? 'main';

  // ── Step 1: Fetch all roles ──
  log('  Fetching roles...');
  const allRoles = await fetchRoles(nb);
  let roles = allRoles.filter(r => !SKIP_ROLES.has(r.name) && !r.hidden);
  if (opts.roles?.length) {
    const wanted = new Set(opts.roles);
    roles = roles.filter(r => wanted.has(r.name));
  }
  log(`  Found ${roles.length} roles (of ${allRoles.length} total)`);

  // ── Step 2: Fetch all scopes ──
  log('  Fetching scopes...');
  const allScopes = await fetchScopes(nb, ds);
  const scopeById = new Map<string | number, ApiScope>();
  for (const s of allScopes) {
    scopeById.set(s.id, s);
  }
  log(`  Found ${allScopes.length} scopes`);

  // ── Step 3: Fetch route tree → build path map ──
  log('  Fetching route tree...');
  const routeTree = await fetchRouteTree(nb);
  const routeIdToPath = buildRoutePathMap(routeTree);
  log(`  ${routeIdToPath.size} routes mapped`);

  // ── Step 4: For each role, fetch strategy + collections + routes ──
  const aclSpec: AclSpec = { scopes: {}, roles: {} };
  const referencedScopeIds = new Set<string | number>();

  for (const role of roles) {
    log(`  Exporting role: ${role.name}`);

    // 4a. Data-source strategy
    const dsRole = await fetchDataSourceRole(nb, role.name, ds);

    // 4b. Collection config (which are "strategy" vs "resourceAction")
    const collConfigs = await fetchCollectionConfigs(nb, role.name, ds);
    const resourceActionColls = collConfigs.filter(c => c.usingConfig === 'resourceAction');

    // 4c. Independent permissions for resourceAction collections
    const collPerms: Record<string, CollectionPermissions> = {};
    for (const coll of resourceActionColls) {
      const resource = await fetchResourceDetail(nb, role.name, coll.name, ds);
      if (!resource?.actions?.length) continue;
      const perms = convertActions(resource.actions, scopeById);
      if (Object.keys(perms.permissions).length) {
        collPerms[coll.name] = perms.permissions;
        for (const sid of perms.scopeIds) referencedScopeIds.add(sid);
      }
    }

    // 4d. Route permissions
    const grantedRouteIds = await fetchRoleRoutes(nb, role.name);
    const pagePatterns = resolveRoutePatterns(grantedRouteIds, routeIdToPath, routeTree);

    // Build role spec
    const roleSpec: RoleSpec = { title: role.title };
    if (role.description) roleSpec.description = role.description;
    if (role.default) roleSpec.default = true;
    if (role.snippets?.length) roleSpec.snippets = role.snippets;
    if (role.allowConfigure != null) roleSpec.allowConfigure = role.allowConfigure;
    if (role.allowNewMenu) roleSpec.allowNewMenu = true;

    if (dsRole?.strategy?.actions?.length) {
      roleSpec.strategy = { actions: dsRole.strategy.actions };
    }

    if (pagePatterns.length) {
      roleSpec.pages = pagePatterns;
    }

    if (Object.keys(collPerms).length) {
      roleSpec.collections = collPerms;
    }

    aclSpec.roles[role.name] = roleSpec;
  }

  // ── Step 5: Emit referenced custom scopes ──
  for (const sid of referencedScopeIds) {
    const scope = scopeById.get(sid);
    if (!scope) continue;
    if (BUILTIN_SCOPE_KEYS.has(scope.key)) continue;
    aclSpec.scopes![scope.key] = {
      collection: scope.resourceName || '',
      title: scope.name || scope.key,
      filter: scope.scope,
    };
  }

  // Remove empty scopes key
  if (!Object.keys(aclSpec.scopes!).length) {
    delete aclSpec.scopes;
  }

  // ── Step 6: Write YAML ──
  const outDir = path.resolve(opts.outDir);
  fs.mkdirSync(outDir, { recursive: true });
  const yamlContent = dumpYaml(aclSpec);
  fs.writeFileSync(path.join(outDir, 'acl.yaml'), yamlContent, 'utf8');
  log(`  Written acl.yaml to ${outDir}`);

  return aclSpec;
}

// ── API fetch helpers ──

async function fetchRoles(nb: NocoBaseClient): Promise<ApiRole[]> {
  const resp = await nb.http.get(`${nb.baseUrl}/api/roles:list`, {
    params: { paginate: 'false' },
  });
  return (resp.data.data || []) as ApiRole[];
}

async function fetchDataSourceRole(
  nb: NocoBaseClient,
  roleName: string,
  ds: string,
): Promise<ApiDataSourceRole | null> {
  try {
    const resp = await nb.http.get(`${nb.baseUrl}/api/dataSources/${ds}/roles:get`, {
      params: { filterByTk: roleName },
    });
    return resp.data.data as ApiDataSourceRole;
  } catch {
    return null;
  }
}

async function fetchScopes(nb: NocoBaseClient, ds: string): Promise<ApiScope[]> {
  const resp = await nb.http.get(`${nb.baseUrl}/api/dataSources/${ds}/rolesResourcesScopes:list`, {
    params: { paginate: 'false' },
  });
  return (resp.data.data || []) as ApiScope[];
}

async function fetchCollectionConfigs(
  nb: NocoBaseClient,
  roleName: string,
  ds: string,
): Promise<ApiCollectionConfig[]> {
  const resp = await nb.http.get(
    `${nb.baseUrl}/api/roles/${roleName}/dataSourcesCollections:list`,
    {
      params: {
        'filter[dataSourceKey]': ds,
        pageSize: 200,
      },
    },
  );
  const body = resp.data.data;
  // API returns { rows, count } or a flat array depending on endpoint
  const rows = Array.isArray(body) ? body : (body?.rows || []);
  return rows as ApiCollectionConfig[];
}

async function fetchResourceDetail(
  nb: NocoBaseClient,
  roleName: string,
  collName: string,
  ds: string,
): Promise<ApiResource | null> {
  try {
    const resp = await nb.http.get(
      `${nb.baseUrl}/api/roles/${roleName}/dataSourceResources:get`,
      {
        params: {
          'filter[dataSourceKey]': ds,
          'filter[name]': collName,
          'appends[]': ['actions', 'actions.scope'],
        },
      },
    );
    return resp.data.data as ApiResource;
  } catch {
    return null;
  }
}

async function fetchRoleRoutes(nb: NocoBaseClient, roleName: string): Promise<Set<number>> {
  try {
    const resp = await nb.http.get(
      `${nb.baseUrl}/api/roles/${roleName}/desktopRoutes:list`,
      { params: { paginate: 'false' } },
    );
    const data = (resp.data.data || []) as { id: number }[];
    return new Set(data.map(r => r.id));
  } catch {
    return new Set();
  }
}

async function fetchRouteTree(nb: NocoBaseClient): Promise<ApiRouteNode[]> {
  const resp = await nb.http.get(`${nb.baseUrl}/api/desktopRoutes:list`, {
    params: { paginate: 'false', tree: 'true' },
  });
  return (resp.data.data || []) as ApiRouteNode[];
}

// ── Conversion helpers ──

/**
 * Build a map from route ID to human-readable path like "Main/Customers".
 */
function buildRoutePathMap(routes: ApiRouteNode[]): Map<number, string> {
  const result = new Map<number, string>();

  function walk(nodes: ApiRouteNode[], prefix: string): void {
    for (const node of nodes) {
      if (node.type === 'tabs') continue;
      const pathPart = node.title || String(node.id);
      const fullPath = prefix ? `${prefix}/${pathPart}` : pathPart;
      result.set(node.id, fullPath);
      if (node.children?.length) {
        walk(node.children, fullPath);
      }
    }
  }
  walk(routes, '');
  return result;
}

/**
 * Build a map from route path to all route IDs belonging to that group.
 * Used for compressing individual page grants into glob patterns.
 */
function buildGroupChildrenMap(
  routes: ApiRouteNode[],
  routeIdToPath: Map<number, string>,
): Map<string, Set<number>> {
  const groups = new Map<string, Set<number>>();

  function walk(nodes: ApiRouteNode[], parentPath: string): void {
    for (const node of nodes) {
      if (node.type === 'tabs') continue;
      const nodePath = routeIdToPath.get(node.id) || '';
      if (node.type === 'group' && node.children?.length) {
        // Collect all descendant IDs (excluding tabs)
        const ids = new Set<number>();
        ids.add(node.id);
        collectDescendantIds(node, ids);
        groups.set(nodePath, ids);
        walk(node.children, nodePath);
      }
    }
  }
  walk(routes, '');
  return groups;
}

function collectDescendantIds(node: ApiRouteNode, ids: Set<number>): void {
  for (const child of node.children || []) {
    if (child.type === 'tabs') continue;
    ids.add(child.id);
    collectDescendantIds(child, ids);
  }
}

/**
 * Given a set of granted route IDs, produce the most compact page patterns.
 *
 * Strategy:
 * - If all children of a group are granted, emit "Group/**" instead of listing each.
 * - Otherwise list individual pages.
 */
function resolveRoutePatterns(
  grantedIds: Set<number>,
  routeIdToPath: Map<number, string>,
  routeTree: ApiRouteNode[],
): string[] {
  if (!grantedIds.size) return [];

  const groupChildren = buildGroupChildrenMap(routeTree, routeIdToPath);
  const patterns: string[] = [];
  const consumed = new Set<number>();

  // Try to match whole groups first (sorted by longest path = most specific first)
  const sortedGroups = [...groupChildren.entries()].sort(
    (a, b) => b[0].split('/').length - a[0].split('/').length,
  );

  for (const [groupPath, memberIds] of sortedGroups) {
    // Check if all members are granted and not yet consumed
    const ungrantedMembers = [...memberIds].filter(id => !grantedIds.has(id) && !consumed.has(id));
    const grantedMembers = [...memberIds].filter(id => grantedIds.has(id) && !consumed.has(id));
    if (grantedMembers.length > 0 && ungrantedMembers.length === 0) {
      patterns.push(`${groupPath}/**`);
      for (const id of memberIds) consumed.add(id);
    }
  }

  // Remaining individually-granted routes
  for (const id of grantedIds) {
    if (consumed.has(id)) continue;
    const routePath = routeIdToPath.get(id);
    if (routePath) {
      patterns.push(routePath);
      consumed.add(id);
    }
  }

  return patterns.sort();
}

/**
 * Convert API action records to our DSL format.
 */
function convertActions(
  actions: { name: string; fields: string[]; scopeId?: number | string | null; scope?: ApiScope | null }[],
  scopeById: Map<string | number, ApiScope>,
): { permissions: CollectionPermissions; scopeIds: Set<string | number> } {
  const permissions: CollectionPermissions = {};
  const scopeIds = new Set<string | number>();

  for (const action of actions) {
    const actionName = action.name as AclActionName;
    const perm: ActionPermissionSpec = {};
    let hasContent = false;

    // Resolve scope
    if (action.scopeId != null) {
      const scope = action.scope || scopeById.get(action.scopeId);
      if (scope) {
        if (BUILTIN_SCOPE_KEYS.has(scope.key)) {
          perm.scope = scope.key;
        } else {
          perm.scope = scope.key;
          scopeIds.add(action.scopeId);
        }
        hasContent = true;
      }
    }

    // Resolve fields
    if (action.fields?.length) {
      perm.fields = action.fields;
      hasContent = true;
    }

    // Write as simplified form when possible
    if (hasContent) {
      permissions[actionName] = perm;
    } else {
      // Empty object = action allowed with no restrictions
      permissions[actionName] = {};
    }
  }

  return { permissions, scopeIds };
}
