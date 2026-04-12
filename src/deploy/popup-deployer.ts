/**
 * Deploy popups — simple, tabbed, and nested.
 *
 * ⚠️ PITFALLS:
 * - compose target for popup tab: use ChildPage TAB uid (not field/action uid)
 * - hasContent check: compare live blockCount vs spec blockCount (not just >0)
 * - popupSettings.uid must point to field itself (NocoBase resolves field → page)
 * - See src/PITFALLS.md for complete list.
 */
import type { NocoBaseClient } from '../client';
import type { PopupSpec, BlockSpec } from '../types/spec';
import type { BlockState } from '../types/state';
import { deploySurface } from './surface-deployer';

/**
 * Deploy a single popup onto a target (action, field column, etc.).
 */
export async function deployPopup(
  nb: NocoBaseClient,
  targetUid: string,
  targetRef: string,
  popupSpec: PopupSpec,
  modDir: string,
  force = false,
  popupPath = '',
  log: (msg: string) => void = console.log,
): Promise<void> {
  const mode = popupSpec.mode || 'drawer';
  const coll = popupSpec.coll || '';
  const tabsSpec = popupSpec.tabs;

  // Check if popup already has content
  try {
    const data = await nb.get({ uid: targetUid });
    const tree = data.tree;
    const popupPage = tree.subModels?.page;
    if (popupPage && !Array.isArray(popupPage)) {
      const tabs = (popupPage as unknown as unknown as Record<string, unknown>).subModels as Record<string, unknown>;
      const tabList = tabs?.tabs;
      const tabArr = Array.isArray(tabList) ? tabList : tabList ? [tabList] : [];
      // Check if popup has ENOUGH content (matches spec tab/block count)
      const specTabCount = tabsSpec ? tabsSpec.length : 1;
      const specBlockCount = tabsSpec
        ? tabsSpec.reduce((n, t) => n + ((t.blocks || []).length), 0)
        : (popupSpec.blocks || []).length;

      let liveBlockCount = 0;
      for (const t of tabArr) {
        const g = (t as unknown as Record<string, unknown>).subModels as Record<string, unknown>;
        const gridObj = g?.grid as Record<string, unknown>;
        const items = gridObj?.subModels as Record<string, unknown>;
        const itemArr = items?.items;
        if (Array.isArray(itemArr)) liveBlockCount += itemArr.length;
      }

      // Content is sufficient if live has at least as many tabs and blocks as spec
      const hasContent = tabArr.length >= specTabCount && liveBlockCount >= specBlockCount && liveBlockCount > 0;
      if (hasContent) {
        if (force) {
          log(`  ~ popup [${targetRef}] (update in-place)`);
        } else {
          log(`  = popup [${targetRef}] (exists, skip)`);
        }
        return;
      }
    }
  } catch { /* popup check best-effort */ }

  // Set click-to-open settings
  await nb.updateModel(targetUid, {
    popupSettings: {
      openView: {
        collectionName: coll,
        dataSourceKey: 'main',
        mode,
        size: 'large',
        pageModelClass: 'ChildPageModel',
        uid: targetUid,
      },
    },
    displayFieldSettings: {
      clickToOpen: { clickToOpen: true },
    },
  });

  if (tabsSpec) {
    await deployTabbedPopup(nb, targetUid, targetRef, tabsSpec, coll, modDir, force, popupPath, log);
  } else {
    const blocks = popupSpec.blocks || [];
    if (blocks.length) {
      await deploySimplePopup(nb, targetUid, targetRef, popupSpec, coll, modDir, log);
    }
  }
}

async function deploySimplePopup(
  nb: NocoBaseClient,
  targetUid: string,
  targetRef: string,
  popupSpec: PopupSpec,
  coll: string,
  modDir: string,
  log: (msg: string) => void,
): Promise<void> {
  const spec = {
    coll,
    blocks: popupSpec.blocks || [],
  };
  const blocksState = await deploySurface(nb, targetUid, spec as any, modDir, false, {}, log);
  log(`  + popup [${targetRef}]: ${Object.keys(blocksState).length} blocks`);
}

async function deployTabbedPopup(
  nb: NocoBaseClient,
  targetUid: string,
  targetRef: string,
  tabsSpec: NonNullable<PopupSpec['tabs']>,
  coll: string,
  modDir: string,
  force: boolean,
  popupPath: string,
  log: (msg: string) => void,
): Promise<void> {
  log(`  + popup [${targetRef}]: ${tabsSpec.length} tabs`);

  // Read ChildPage to get existing popup tabs
  let existingTabs: { uid: string }[] = [];
  let popupPageUid = '';
  try {
    const data = await nb.get({ uid: targetUid });
    const pp = data.tree.subModels?.page;
    if (pp && !Array.isArray(pp)) {
      popupPageUid = (pp as unknown as Record<string, unknown>).uid as string || '';
      const subs = (pp as unknown as Record<string, unknown>).subModels as Record<string, unknown>;
      const tl = subs?.tabs;
      existingTabs = (Array.isArray(tl) ? tl : tl ? [tl] : []) as { uid: string }[];
    }
  } catch { /* skip */ }

  // Deploy each tab — use popup tab UIDs (not field/action UIDs)
  for (let i = 0; i < tabsSpec.length; i++) {
    const tabSpec = tabsSpec[i];
    const tabTitle = tabSpec.title || `Tab${i}`;
    let tabUid: string;

    if (i < existingTabs.length) {
      // Use existing tab UID
      tabUid = existingTabs[i].uid;
    } else {
      // Create new popup tab
      try {
        const result = await nb.surfaces.addPopupTab(popupPageUid, tabTitle);
        const r = result as Record<string, unknown>;
        tabUid = (r.popupTabUid || r.tabSchemaUid || r.tabUid || r.uid || '') as string;
      } catch (e) {
        log(`    ! tab '${tabTitle}': ${e instanceof Error ? e.message : e}`);
        continue;
      }
    }

    const tabBlocks = await deploySurface(nb, tabUid, { ...tabSpec, coll } as any, modDir, false, {}, log);
    log(`    tab '${tabTitle}': ${Object.keys(tabBlocks).length} blocks`);
  }
}
