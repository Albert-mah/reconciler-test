/**
 * Deploy popups — simple, tabbed, and nested.
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
      const tabs = (popupPage as unknown as Record<string, unknown>).subModels as Record<string, unknown>;
      const tabList = tabs?.tabs;
      const tabArr = Array.isArray(tabList) ? tabList : tabList ? [tabList] : [];
      let hasContent = false;
      for (const t of tabArr) {
        const g = (t as unknown as Record<string, unknown>).subModels as Record<string, unknown>;
        const gridObj = g?.grid as Record<string, unknown>;
        const items = gridObj?.subModels as Record<string, unknown>;
        const itemArr = items?.items;
        if (Array.isArray(itemArr) && itemArr.length) {
          hasContent = true;
          break;
        }
      }
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

  // Tab 0: compose on target directly
  const firstTab = tabsSpec[0];
  const firstBlocks = await deploySurface(nb, targetUid, { ...firstTab, coll } as any, modDir, false, {}, log);
  log(`    tab '${firstTab.title || 'Tab0'}': ${Object.keys(firstBlocks).length} blocks`);

  // Read popup to get remaining tabs
  let existingTabs: Record<string, unknown>[] = [];
  let popupPage: Record<string, unknown> | undefined;
  try {
    const data = await nb.get({ uid: targetUid });
    const pp = data.tree.subModels?.page;
    if (pp && !Array.isArray(pp)) {
      popupPage = pp as unknown as Record<string, unknown>;
      const subs = popupPage.subModels as Record<string, unknown>;
      const tl = subs?.tabs;
      existingTabs = Array.isArray(tl) ? tl as Record<string, unknown>[] : tl ? [tl as Record<string, unknown>] : [];
    }
  } catch { /* skip */ }

  // Remaining tabs
  for (let i = 1; i < tabsSpec.length; i++) {
    const tabSpec = tabsSpec[i];
    const tabTitle = tabSpec.title || `Tab${i}`;
    let tabUid: string;

    if (i < existingTabs.length) {
      tabUid = existingTabs[i].uid as string;
    } else {
      try {
        const ppUid = (popupPage?.uid as string) || '';
        const result = await nb.surfaces.addPopupTab(ppUid, tabTitle);
        tabUid = (result as Record<string, unknown>).popupTabUid as string
          || (result as Record<string, unknown>).tabUid as string
          || (result as Record<string, unknown>).uid as string
          || '';
      } catch (e) {
        log(`    ! tab '${tabTitle}': ${e instanceof Error ? e.message : e}`);
        continue;
      }
    }

    const tabBlocks = await deploySurface(nb, tabUid, { ...tabSpec, coll } as any, modDir, false, {}, log);
    log(`    tab '${tabTitle}': ${Object.keys(tabBlocks).length} blocks`);
  }
}
