/**
 * Deploy dividers and markdown items declared in field_layout and fields.
 *
 * - Dividers: rows starting with "---" (with optional label)
 * - Markdown items: { type: 'markdown', key, content } in fields
 */
import type { NocoBaseClient } from '../../client';
import type { BlockSpec } from '../../types/spec';
import type { BlockState } from '../../types/state';
import type { LogFn } from './types';
import { generateUid } from '../../utils/uid';

export async function deployDividers(
  nb: NocoBaseClient,
  gridUid: string,
  bs: BlockSpec,
  blockState: BlockState,
  log: LogFn,
): Promise<void> {
  if (!gridUid) return;

  const fieldLayout = bs.field_layout || [];
  const fields = bs.fields || [];

  // Create MarkdownItemModel for { type: 'markdown' } fields
  for (const f of fields) {
    if (typeof f !== 'object') continue;
    const fObj = f as unknown as Record<string, unknown>;
    if (fObj.type !== 'markdown') continue;
    const mdKey = (fObj.key as string) || `md_${Math.random().toString(36).slice(2, 6)}`;
    const content = (fObj.content as string) || '';
    if (blockState.fields?.[mdKey]) continue; // already exists

    try {
      const newUid = generateUid();
      await nb.models.save({
        uid: newUid,
        use: 'MarkdownItemModel',
        parentId: gridUid,
        subKey: 'items',
        subType: 'array',
        sortIndex: 0,
        stepParams: {
          markdownBlockSettings: { editMarkdown: { content } },
        },
        flowRegistry: {},
      });
      if (!blockState.fields) blockState.fields = {};
      blockState.fields[mdKey] = { wrapper: newUid, field: '' };
      log(`      + markdown: ${mdKey}`);
    } catch (e) {
      log(`      ! markdown ${mdKey}: ${e instanceof Error ? e.message.slice(0, 60) : e}`);
    }
  }

  // Create dividers from field_layout "--- Label ---" rows
  // First, read existing dividers from live grid to avoid duplicates
  const existingDividerLabels = new Set<string>();
  try {
    const gridData = await nb.get({ uid: gridUid });
    const gridItems = gridData.tree.subModels?.items;
    const gridArr = (Array.isArray(gridItems) ? gridItems : []) as { use?: string; stepParams?: Record<string, unknown> }[];
    for (const gi of gridArr) {
      if (gi.use === 'DividerItemModel') {
        const divLabel = ((gi.stepParams?.markdownItemSetting as Record<string, unknown>)?.title as Record<string, unknown>)?.label as string || '';
        if (divLabel) existingDividerLabels.add(divLabel);
      }
    }
  } catch { /* skip */ }

  for (const row of fieldLayout) {
    if (typeof row === 'string' && row.startsWith('---')) {
      const label = row.replace(/^-+\s*/, '').replace(/\s*-+$/, '').trim();
      // Skip if divider with this label already exists
      if (label && existingDividerLabels.has(label)) continue;
      try {
        if (label) {
          await nb.models.addDivider(gridUid, label);
          log(`      + divider: ${label}`);
        } else {
          // Bare "---" divider (no label)
          const newUid = generateUid();
          await nb.models.save({
            uid: newUid,
            use: 'DividerItemModel',
            parentId: gridUid,
            subKey: 'items',
            subType: 'array',
            sortIndex: 0,
            stepParams: {},
            flowRegistry: {},
          });
          log(`      + divider (bare)`);
        }
      } catch (e) {
        log(`      ! divider: ${e instanceof Error ? e.message.slice(0, 60) : e}`);
      }
    }
  }
}
