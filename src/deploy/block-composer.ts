/**
 * Convert YAML block spec → compose API format.
 *
 * Pure function — no API calls. Used by surface-deployer before compose.
 */
import type { BlockSpec, FieldSpec, LayoutRow } from '../types/spec';

const COMPOSE_TYPES = new Set([
  'table', 'filterForm', 'createForm', 'editForm', 'details',
  'list', 'gridCard', 'jsBlock', 'chart', 'markdown', 'iframe',
]);

const LEGACY_TYPES = new Set(['comments', 'recordHistory', 'reference']);

const COMPOSE_ACTIONS = new Set([
  'filter', 'refresh', 'addNew', 'delete', 'bulkDelete',
  'submit', 'reset', 'edit', 'view',
]);

const SYSTEM_FIELDS = new Set([
  'id', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy', 'createdById', 'updatedById',
]);

const LAYOUT_KEYS = new Set(['col', 'size']);

export { COMPOSE_TYPES, LEGACY_TYPES, COMPOSE_ACTIONS };

/**
 * Convert a block spec to compose API block format.
 * Returns null if the block type is not supported by compose.
 */
export function toComposeBlock(
  bs: BlockSpec,
  defaultColl: string,
): Record<string, unknown> | null {
  const btype = bs.type;
  const key = bs.key || btype;

  if (!COMPOSE_TYPES.has(btype)) return null;

  const resBinding = bs.resource_binding || {};
  const block: Record<string, unknown> = { key, type: btype };

  // ── Resource ──
  const blockColl = bs.coll || defaultColl;

  if (bs.resource) {
    const resource = { ...bs.resource };
    // Ensure dataSourceKey is always present
    if (resource.collectionName && !resource.dataSourceKey) {
      resource.dataSourceKey = 'main';
    }
    block.resource = resource;
  } else if (resBinding.associationName) {
    const resource: Record<string, unknown> = {
      collectionName: blockColl,
      dataSourceKey: 'main',
      associationName: resBinding.associationName,
    };
    if (resBinding.sourceId) resource.sourceId = resBinding.sourceId;
    block.resource = resource;
  } else if (resBinding.filterByTk) {
    // Popup context: compose needs collectionName + "currentRecord" binding
    block.resource = blockColl
      ? { collectionName: blockColl, dataSourceKey: 'main', binding: 'currentRecord' }
      : { binding: 'currentRecord' };
  } else if (blockColl && !['jsBlock', 'chart', 'markdown'].includes(btype)) {
    block.resource = { collectionName: blockColl, dataSourceKey: 'main' };
  }

  // ── Fields ──
  const includeFields = ['table', 'createForm', 'editForm', 'details'].includes(btype)
    || (btype === 'filterForm' && !!blockColl);

  const layoutRows = (bs.field_layout || []).filter((r): r is LayoutRow => Array.isArray(r));
  const allFields = collectFields(bs.fields || [], layoutRows);

  if (allFields.size > 0 && includeFields) {
    block.fields = [...allFields].map(fp => ({ fieldPath: fp }));
  }

  // ── Actions ──
  const actions = (bs.actions || []).filter(a => {
    const t = typeof a === 'string' ? a : (a as Record<string, unknown>).type as string;
    return COMPOSE_ACTIONS.has(t);
  });
  const recordActions = (bs.recordActions || []).filter(a => {
    const t = typeof a === 'string' ? a : (a as Record<string, unknown>).type as string;
    return COMPOSE_ACTIONS.has(t);
  });

  // Details blocks: edit/view must be in recordActions (compose API requirement)
  if (btype === 'details') {
    const moveToRecord = ['edit', 'view'];
    const toMove = actions.filter(a => {
      const t = typeof a === 'string' ? a : (a as Record<string, unknown>).type as string;
      return moveToRecord.includes(t);
    });
    const remaining = actions.filter(a => !toMove.includes(a));
    if (toMove.length) recordActions.push(...toMove);
    if (remaining.length > 0) {
      block.actions = remaining.map(a => typeof a === 'string' ? { type: a } : a);
    }
  } else if (actions.length > 0) {
    block.actions = actions.map(a => typeof a === 'string' ? { type: a } : a);
  }
  if (recordActions.length > 0) {
    block.recordActions = recordActions.map(a => typeof a === 'string' ? { type: a } : a);
  }

  return block;
}

/**
 * Collect all field paths from fields list + field_layout.
 * Excludes system fields and layout directives.
 */
function collectFields(fields: FieldSpec[], fieldLayout: LayoutRow[]): Set<string> {
  const result = new Set<string>();

  // From fields list
  for (const f of fields) {
    const fp = typeof f === 'string' ? f : (f.field || f.fieldPath || '');
    if (fp && !fp.startsWith('[') && !SYSTEM_FIELDS.has(fp)) {
      result.add(fp);
    }
  }

  // From field_layout (may reference fields not in fields list)
  for (const row of fieldLayout) {
    if (!Array.isArray(row)) continue;
    for (const item of row) {
      if (typeof item === 'string' && !item.startsWith('[') && !item.startsWith('---')) {
        if (!SYSTEM_FIELDS.has(item)) result.add(item);
      } else if (item && typeof item === 'object') {
        for (const k of Object.keys(item)) {
          if (!LAYOUT_KEYS.has(k) && !k.startsWith('[') && !k.startsWith('---')) {
            if (!SYSTEM_FIELDS.has(k)) result.add(k);
          }
        }
      }
    }
  }

  return result;
}
