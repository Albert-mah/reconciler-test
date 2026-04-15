/**
 * Configure filterForm — connect filter fields to target table/reference blocks.
 *
 * Sets filterFormItemSettings on each field + filterManager on page-level grid.
 *
 * ⚠️ PITFALL: filterManager must be set on PAGE-LEVEL BlockGridModel,
 *    not the filterForm's own grid. See src/PITFALLS.md.
 */
import type { NocoBaseClient } from '../../client';
import type { BlockSpec } from '../../types/spec';
import type { BlockState } from '../../types/state';
import type { LogFn } from './types';

interface FilterFieldMeta {
  name: string;
  title?: string;
  interface?: string;
  type?: string;
  target?: string;
  targetKey?: string;
  uiSchema?: Record<string, unknown>;
  filterable?: unknown;
  [key: string]: unknown;
}

interface NormalizedFilterFieldSpec {
  fieldPath: string;
  label: string;
  filterPaths?: string[];
}

function normalizeFilterFieldSpec(raw: string | Record<string, unknown>): NormalizedFilterFieldSpec | null {
  if (typeof raw === 'string') {
    return { fieldPath: raw, label: '' };
  }

  const fieldPath = (raw.field as string) || (raw.fieldPath as string) || '';
  if (!fieldPath) return null;

  const filterPaths = Array.isArray(raw.filterPaths)
    ? raw.filterPaths.filter((path): path is string => typeof path === 'string' && !!path)
    : undefined;

  return {
    fieldPath,
    label: (raw.label as string) || '',
    filterPaths,
  };
}

function buildFilterFieldMeta(
  fieldPath: string,
  label: string,
  meta?: FilterFieldMeta,
): Record<string, unknown> {
  const fallbackTitle = label
    || meta?.title
    || ((meta?.uiSchema as Record<string, unknown> | undefined)?.title as string)
    || fieldPath;

  if (!meta) {
    return {
      name: fieldPath,
      title: fallbackTitle,
      interface: 'input',
      type: 'string',
    };
  }

  return {
    name: meta.name || fieldPath,
    title: meta.title || fallbackTitle,
    interface: meta.interface || 'input',
    type: meta.type || 'string',
    target: meta.target,
    targetKey: meta.targetKey,
    uiSchema: meta.uiSchema,
    filterable: meta.filterable,
  };
}

export async function configureFilter(
  nb: NocoBaseClient,
  bs: BlockSpec,
  blockUid: string,
  blockState: BlockState,
  coll: string,
  allBlocksState: Record<string, BlockState>,
  pageGridUid: string,
  log: LogFn,
): Promise<void> {
  // Find target table/reference UIDs
  const targetUids: string[] = [];
  for (const [, binfo] of Object.entries(allBlocksState)) {
    if ((binfo.type === 'table' || binfo.type === 'reference') && binfo.uid) {
      targetUids.push(binfo.uid);
    }
  }
  const defaultTarget = targetUids[0] || '';
  const fieldSpecs = (bs.fields || [])
    .map(f => typeof f === 'string' ? normalizeFilterFieldSpec(f) : normalizeFilterFieldSpec(f as unknown as Record<string, unknown>))
    .filter((f): f is NormalizedFilterFieldSpec => !!f);

  const collectionResp = await nb.http.get(`${nb.baseUrl}/api/collections:get`, {
    params: { filterByTk: coll, appends: ['fields'] },
  });
  const collectionData = (collectionResp.data?.data || {}) as Record<string, unknown>;
  const collectionFields = Array.isArray(collectionData.fields)
    ? (collectionData.fields as FilterFieldMeta[])
    : [];
  const fieldMetaByName = new Map(collectionFields.map(f => [f.name, f]));
  const targetFilterKeyCache = new Map<string, string>();

  const getAssociationFilterTargetKey = async (fieldMeta?: FilterFieldMeta): Promise<string> => {
    if (!fieldMeta?.target) {
      return fieldMeta?.targetKey || 'id';
    }
    if (targetFilterKeyCache.has(fieldMeta.target)) {
      return targetFilterKeyCache.get(fieldMeta.target) || 'id';
    }

    try {
      const resp = await nb.http.get(`${nb.baseUrl}/api/collections:get`, {
        params: { filterByTk: fieldMeta.target },
      });
      const rawKey = resp.data?.data?.filterTargetKey;
      const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;
      const normalizedKey = typeof key === 'string' && key ? key : fieldMeta.targetKey || 'id';
      targetFilterKeyCache.set(fieldMeta.target, normalizedKey);
      return normalizedKey;
    } catch {
      return fieldMeta.targetKey || 'id';
    }
  };

  // 1. Set label + defaultTargetUid on each FilterFormItem
  const fieldStates = blockState.fields || {};
  for (const f of fieldSpecs) {
    const fp = f.fieldPath;
    const label = f.label;
    const wrapperUid = fieldStates[fp]?.wrapper;
    if (!wrapperUid) continue;

    const settings: Record<string, unknown> = {};
    if (defaultTarget) {
      settings.init = {
        filterField: buildFilterFieldMeta(fp, label, fieldMetaByName.get(fp)),
        defaultTargetUid: defaultTarget,
      };
    }
    if (label) {
      settings.label = { label };
      settings.showLabel = { showLabel: true };
    }

    if (Object.keys(settings).length) {
      try {
        await nb.updateModel(wrapperUid, { filterFormItemSettings: settings });
        log(`      filter ${fp}: ${label || fp}`);
      } catch (e) {
        log(`      ! filter ${fp}: ${e instanceof Error ? e.message.slice(0, 60) : e}`);
      }
    }
  }

  // 2. Set filterManager on page-level BlockGridModel
  if (!pageGridUid) return;

  try {
    const data = await nb.get({ uid: blockUid });
    const grid = data.tree.subModels?.grid;
    const gridItems = (grid && !Array.isArray(grid))
      ? ((grid as unknown as Record<string, unknown>).subModels as Record<string, unknown>)?.items
      : [];
    const items = (Array.isArray(gridItems) ? gridItems : []) as Record<string, unknown>[];
    const liveFilterUidByFieldPath = new Map<string, string>();

    for (const item of items) {
      const fieldInit = ((item.stepParams as Record<string, unknown>)?.fieldSettings as Record<string, unknown>)
        ?.init as Record<string, unknown> | undefined;
      const itemFieldPath = fieldInit?.fieldPath as string | undefined;
      const itemUid = item.uid as string | undefined;
      if (itemFieldPath && itemUid) {
        liveFilterUidByFieldPath.set(itemFieldPath, itemUid);
      }
    }

    const currentFilterIds = new Set<string>();
    const fmEntries: Record<string, unknown>[] = [];

    for (const f of fieldSpecs) {
      const fp = f.fieldPath;
      const filterId = liveFilterUidByFieldPath.get(fp);
      if (!filterId) continue;
      currentFilterIds.add(filterId);

      const fieldMeta = fieldMetaByName.get(fp);
      const filterPaths = f.filterPaths?.length
        ? f.filterPaths
        : (fieldMeta?.target && !fp.includes('.'))
          ? [`${fp}.${await getAssociationFilterTargetKey(fieldMeta)}`]
          : [fp];

      for (const tid of targetUids) {
        fmEntries.push({
          filterId,
          targetId: tid,
          filterPaths,
        });
      }
      log(`      filter ${fp} → ${JSON.stringify(filterPaths)} (${targetUids.length} targets)`);
    }

    const pgResp = await nb.http.get(`${nb.baseUrl}/api/flowModels:get`, {
      params: { filterByTk: pageGridUid },
    });
    const pgData = pgResp.data?.data || {};
    const existingEntries = Array.isArray(pgData.filterManager)
      ? (pgData.filterManager as Record<string, unknown>[])
      : [];
    const preservedEntries = existingEntries.filter(entry => {
      const filterId = entry.filterId as string | undefined;
      return !filterId || !currentFilterIds.has(filterId);
    });
    const nextEntries = [...preservedEntries, ...fmEntries];

    if (!nextEntries.length && !currentFilterIds.size) {
      return;
    }

    await nb.http.post(`${nb.baseUrl}/api/flowModels:save`, {
      uid: pageGridUid,
      use: pgData.use || 'BlockGridModel',
      parentId: pgData.parentId || '',
      subKey: pgData.subKey || 'grid',
      subType: pgData.subType || 'object',
      sortIndex: pgData.sortIndex ?? 0,
      stepParams: pgData.stepParams || {},
      flowRegistry: pgData.flowRegistry || {},
      filterManager: nextEntries,
    });
  } catch (e) {
    log(`      ! filterManager: ${e instanceof Error ? e.message : e}`);
  }
}
