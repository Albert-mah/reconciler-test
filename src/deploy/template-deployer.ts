/**
 * Deploy V2 templates from templates/ directory.
 *
 * For each template in _index.yaml:
 *   - If template already exists in NocoBase (by name + collection match) → reuse UID
 *   - If template is new → create via flowSurfaces:saveTemplate flow:
 *     a. Create a temporary hidden page
 *     b. Compose the template content block on that page
 *     c. Call saveTemplate with saveMode: 'duplicate'
 *     d. Delete the temporary page
 *     e. Record the new templateUid
 *
 * Returns uid mapping (old → new) for downstream page deployers.
 *
 * ⚠️ PITFALLS:
 * - Match templates by name + collectionName (not UID — UIDs differ between instances)
 * - Popup templates: host is a field-like node with ChildPage, not a page grid
 * - Block templates: compose on a temp page grid, then saveTemplate on the block UID
 * - Template deployer is idempotent (safe to run multiple times)
 * - Never modify existing template content — only create new ones
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { NocoBaseClient } from '../client';
import { loadYaml } from '../utils/yaml';
import { generateUid } from '../utils/uid';
import { toComposeBlock } from './block-composer';

interface TemplateIndex {
  uid: string;
  name: string;
  type: 'popup' | 'block';
  collection?: string;
  targetUid: string;
  file: string;
}

interface ExistingTemplate {
  uid: string;
  name: string;
  collectionName?: string;
  targetUid: string;
}

export type TemplateUidMap = Map<string, string>; // oldUid → newUid

/**
 * Deploy all templates. Returns uid mapping (old → new).
 *
 * Called before page deployment so that popupTemplateUid references
 * can be resolved in page specs.
 */
export async function deployTemplates(
  nb: NocoBaseClient,
  projectDir: string,
  log: (msg: string) => void = console.log,
): Promise<TemplateUidMap> {
  const tplDir = path.join(projectDir, 'templates');
  const indexFile = path.join(tplDir, '_index.yaml');
  if (!fs.existsSync(indexFile)) return new Map();

  const index = loadYaml<TemplateIndex[]>(indexFile);
  if (!index?.length) return new Map();

  log('\n  -- Templates --');

  // Fetch existing templates to avoid duplicates
  const existingResp = await nb.http.get(`${nb.baseUrl}/api/flowModelTemplates:list`, {
    params: { paginate: false },
  });
  const existing = (existingResp.data?.data || []) as ExistingTemplate[];

  // Build lookup: "name|collection" → existing entry
  const existingByKey = new Map<string, ExistingTemplate>();
  for (const t of existing) {
    const key = makeMatchKey(t.name, t.collectionName || '');
    existingByKey.set(key, t);
  }
  // Also keep name-only fallback for templates without collection
  const existingByName = new Map<string, ExistingTemplate>();
  for (const t of existing) {
    if (!existingByName.has(t.name)) {
      existingByName.set(t.name, t);
    }
  }

  const uidMap: TemplateUidMap = new Map();
  let created = 0;
  let reused = 0;
  let skipped = 0;

  for (const tpl of index) {
    // Read template spec for content + collection info
    const tplFile = path.join(tplDir, tpl.file);
    if (!fs.existsSync(tplFile)) {
      log(`  ! template ${tpl.name}: file not found (${tpl.file})`);
      skipped++;
      continue;
    }
    const tplSpec = loadYaml<Record<string, unknown>>(tplFile);
    const collName = (tpl.collection || tplSpec.collectionName) as string || '';

    // Check if template already exists (by name + collection)
    const matchKey = makeMatchKey(tpl.name, collName);
    const existingEntry = existingByKey.get(matchKey) || existingByName.get(tpl.name);
    if (existingEntry) {
      uidMap.set(tpl.uid, existingEntry.uid);
      if (tpl.targetUid && existingEntry.targetUid) {
        uidMap.set(tpl.targetUid, existingEntry.targetUid);
      }
      reused++;
      continue;
    }

    // Template is new — create it
    const content = tplSpec.content as Record<string, unknown>;
    if (!content) {
      log(`  ! template ${tpl.name}: no content in spec`);
      skipped++;
      continue;
    }

    try {
      let result: { templateUid: string; targetUid: string } | undefined;

      if (tpl.type === 'block') {
        result = await createBlockTemplate(nb, tpl.name, content, collName, tplSpec, tplDir, log);
      } else if (tpl.type === 'popup') {
        result = await createPopupTemplate(nb, tpl.name, content, collName, tplSpec, tplDir, log);
      }

      if (!result) {
        log(`  ! template ${tpl.name}: failed to create`);
        skipped++;
        continue;
      }

      uidMap.set(tpl.uid, result.templateUid);
      if (tpl.targetUid) {
        uidMap.set(tpl.targetUid, result.targetUid);
      }
      log(`  + template "${tpl.name}" (${tpl.type}) → ${result.templateUid}`);
      created++;
    } catch (e) {
      log(`  ! template ${tpl.name}: ${e instanceof Error ? e.message.slice(0, 100) : e}`);
      skipped++;
    }
  }

  log(`  templates: ${created} created, ${reused} reused${skipped ? `, ${skipped} skipped` : ''}`);
  return uidMap;
}

// ── Block template creation ──

/**
 * Create a block template via saveTemplate flow:
 *   1. Create temporary hidden page
 *   2. Compose the block content on that page
 *   3. Call flowSurfaces:saveTemplate to snapshot the block as a template
 *   4. Delete the temporary page
 */
async function createBlockTemplate(
  nb: NocoBaseClient,
  name: string,
  content: Record<string, unknown>,
  collName: string,
  tplSpec: Record<string, unknown>,
  tplDir: string,
  log: (msg: string) => void,
): Promise<{ templateUid: string; targetUid: string } | undefined> {
  const composeBlock = toComposeBlock(content as any, collName);
  if (!composeBlock) {
    // Fallback: block type not supported by compose — use direct model creation
    return createBlockTemplateViaModel(nb, name, content, collName, tplSpec);
  }

  // 1. Create temporary page
  const tempPage = await createTempPage(nb);
  if (!tempPage) return undefined;

  try {
    // 2. Compose the block
    const result = await nb.surfaces.compose(tempPage.tabUid, [composeBlock], 'replace');
    const blockUid = result.blocks?.[0]?.uid;
    if (!blockUid) {
      log(`    . compose returned no block UID for "${name}"`);
      return undefined;
    }

    // 3. Save as template via flowSurfaces:saveTemplate
    const saveResult = await nb.surfaces.saveTemplate({
      target: { uid: blockUid },
      name,
      type: 'block',
      collectionName: collName,
      dataSourceKey: (tplSpec.dataSourceKey as string) || 'main',
      saveMode: 'duplicate',
    }) as Record<string, unknown>;

    const templateUid = (saveResult.uid || saveResult.templateUid) as string;
    const targetUid = (saveResult.targetUid) as string || blockUid;

    if (!templateUid) {
      // Fallback: saveTemplate didn't return expected format — register manually
      return registerTemplateManually(nb, name, 'block', collName, tplSpec, blockUid);
    }

    return { templateUid, targetUid };
  } finally {
    // 4. Clean up temporary page
    await deleteTempPage(nb, tempPage);
  }
}

// ── Popup template creation ──

/**
 * Create a popup template:
 *   1. Create a field-like host node (DisplayTextFieldModel)
 *   2. Compose blocks into its ChildPage (auto-created by compose)
 *   3. Register as popup template via flowModelTemplates:create
 *
 * Popup templates use a different structure than block templates:
 * the targetUid points to the field host node, which contains a ChildPage
 * with tabs/blocks inside.
 */
async function createPopupTemplate(
  nb: NocoBaseClient,
  name: string,
  content: Record<string, unknown>,
  collName: string,
  tplSpec: Record<string, unknown>,
  tplDir: string,
  log: (msg: string) => void,
): Promise<{ templateUid: string; targetUid: string } | undefined> {
  // Create a host node (DisplayTextFieldModel) that will hold the ChildPage
  const hostUid = generateUid();
  await nb.models.save({
    uid: hostUid,
    use: 'DisplayTextFieldModel',
    stepParams: {},
    flowRegistry: {},
  });

  const tabs = content.tabs as Record<string, unknown>[] | undefined;
  const blocks = content.blocks as Record<string, unknown>[] | undefined;

  if (tabs?.length) {
    // Multi-tab popup: compose first tab, then addPopupTab for additional tabs
    const firstBlocks = (tabs[0].blocks || []) as Record<string, unknown>[];
    const composeBlocks = firstBlocks
      .map(b => toComposeBlock(b as any, collName))
      .filter(Boolean) as Record<string, unknown>[];

    if (composeBlocks.length) {
      try {
        await nb.surfaces.compose(hostUid, composeBlocks, 'replace');
      } catch (e) {
        log(`    . popup compose first tab: ${e instanceof Error ? e.message.slice(0, 60) : e}`);
      }
    }

    // Additional tabs
    for (let i = 1; i < tabs.length; i++) {
      try {
        const d = await nb.get({ uid: hostUid });
        const page = d.tree.subModels?.page as unknown as Record<string, unknown>;
        if (page?.uid) {
          const tabResult = await nb.surfaces.addPopupTab(
            page.uid as string,
            (tabs[i].title as string) || `Tab${i}`,
          );
          const tabUid = (tabResult as Record<string, unknown>).popupTabUid as string
            || (tabResult as Record<string, unknown>).tabSchemaUid as string || '';
          if (tabUid) {
            const tabBlocks = ((tabs[i].blocks || []) as Record<string, unknown>[])
              .map(b => toComposeBlock(b as any, collName))
              .filter(Boolean) as Record<string, unknown>[];
            if (tabBlocks.length) {
              await nb.surfaces.compose(tabUid, tabBlocks, 'replace');
            }
          }
        }
      } catch (e) {
        log(`    . popup compose tab ${i}: ${e instanceof Error ? e.message.slice(0, 60) : e}`);
      }
    }
  } else if (blocks?.length) {
    // Single-tab popup
    const composeBlocks = blocks
      .map(b => toComposeBlock(b as any, collName))
      .filter(Boolean) as Record<string, unknown>[];
    if (composeBlocks.length) {
      try {
        await nb.surfaces.compose(hostUid, composeBlocks, 'replace');
      } catch (e) {
        log(`    . popup compose: ${e instanceof Error ? e.message.slice(0, 60) : e}`);
      }
    }
  }

  // Try saveTemplate first, fall back to manual registration
  try {
    const saveResult = await nb.surfaces.saveTemplate({
      target: { uid: hostUid },
      name,
      type: 'popup',
      collectionName: collName,
      dataSourceKey: (tplSpec.dataSourceKey as string) || 'main',
      saveMode: 'duplicate',
    }) as Record<string, unknown>;

    const templateUid = (saveResult.uid || saveResult.templateUid) as string;
    const targetUid = (saveResult.targetUid) as string || hostUid;

    if (templateUid) {
      return { templateUid, targetUid };
    }
  } catch {
    // saveTemplate not available or failed — fall back to manual registration
  }

  // Fallback: register manually via flowModelTemplates:create
  return registerTemplateManually(nb, name, 'popup', collName, tplSpec, hostUid);
}

// ── Fallback: direct model creation for unsupported block types ──

async function createBlockTemplateViaModel(
  nb: NocoBaseClient,
  name: string,
  content: Record<string, unknown>,
  collName: string,
  tplSpec: Record<string, unknown>,
): Promise<{ templateUid: string; targetUid: string } | undefined> {
  const hostUid = generateUid();

  const composeBlock = toComposeBlock(content as any, collName);
  if (!composeBlock) return undefined;

  // Create a temporary grid to compose into
  await nb.models.save({
    uid: hostUid,
    use: 'BlockGridModel',
    stepParams: {},
    flowRegistry: {},
  });

  const result = await nb.surfaces.compose(hostUid, [composeBlock], 'replace');
  const blockUid = result.blocks?.[0]?.uid || hostUid;

  return registerTemplateManually(nb, name, 'block', collName, tplSpec, blockUid);
}

// ── Manual template registration ──

async function registerTemplateManually(
  nb: NocoBaseClient,
  name: string,
  type: 'popup' | 'block',
  collName: string,
  tplSpec: Record<string, unknown>,
  targetUid: string,
): Promise<{ templateUid: string; targetUid: string } | undefined> {
  const newUid = generateUid();
  const resp = await nb.http.post(`${nb.baseUrl}/api/flowModelTemplates:create`, {
    values: {
      uid: newUid,
      name,
      type,
      collectionName: collName,
      dataSourceKey: (tplSpec.dataSourceKey as string) || 'main',
      targetUid,
    },
  });

  const createdUid = resp.data?.data?.uid as string;
  if (createdUid) {
    return { templateUid: createdUid, targetUid };
  }
  return undefined;
}

// ── Temp page lifecycle ──

interface TempPage {
  routeId: number;
  pageUid: string;
  tabUid: string;
  gridUid: string;
}

/**
 * Create a temporary hidden page for composing template content.
 * Returns page info needed for compose and cleanup.
 */
async function createTempPage(
  nb: NocoBaseClient,
): Promise<TempPage | undefined> {
  try {
    // Create a hidden menu item
    const menu = await nb.surfaces.createMenu({
      title: `_tpl_temp_${generateUid(6)}`,
      type: 'item',
      icon: 'fileoutlined',
    });

    // Create the page surface
    const page = await nb.surfaces.createPage(menu.routeId);

    return {
      routeId: menu.routeId,
      pageUid: page.pageUid,
      tabUid: page.tabSchemaUid,
      gridUid: page.gridUid,
    };
  } catch {
    return undefined;
  }
}

/**
 * Delete a temporary page and its route.
 */
async function deleteTempPage(
  nb: NocoBaseClient,
  tempPage: TempPage,
): Promise<void> {
  try {
    // Delete the route (cascades to page content)
    await nb.http.post(`${nb.baseUrl}/api/desktopRoutes:destroy`, {
      filterByTk: tempPage.routeId,
    });
  } catch {
    // Best-effort cleanup — don't fail the template deploy
    try {
      await nb.surfaces.destroyPage(tempPage.pageUid);
    } catch { /* ignore */ }
  }
}

// ── Matching helpers ──

/**
 * Build a match key from name + collection.
 * Templates are unique by name + collectionName.
 */
function makeMatchKey(name: string, collection: string): string {
  return `${name}|${collection || ''}`.toLowerCase();
}

// ── Template usage registration ──

/**
 * Register a template usage (field/block references a template).
 */
export async function registerTemplateUsage(
  nb: NocoBaseClient,
  templateUid: string,
  modelUid: string,
): Promise<void> {
  try {
    await nb.http.post(`${nb.baseUrl}/api/flowModelTemplateUsages:create`, {
      values: {
        uid: generateUid(),
        templateUid,
        modelUid,
      },
    });
  } catch { /* skip if already exists */ }
}
