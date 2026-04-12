/**
 * Deploy V2 templates — create content + register flowModelTemplates.
 *
 * Flow:
 *   1. Read templates/_index.yaml
 *   2. For each template:
 *      a. Check if exists by name → reuse
 *      b. Create template content (compose blocks into a fresh target)
 *      c. Register via flowModelTemplates:create with targetUid
 *   3. Return oldUid → newUid mapping
 *   4. Page deployer uses mapping for popupSettings.popupTemplateUid
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

export type TemplateUidMap = Map<string, string>; // oldUid → newUid

/**
 * Deploy all templates. Returns uid mapping (old → new).
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

  // Fetch existing templates to avoid duplicates
  const existingResp = await nb.http.get(`${nb.baseUrl}/api/flowModelTemplates:list`, {
    params: { paginate: false },
  });
  const existing = (existingResp.data?.data || []) as { uid: string; name: string; targetUid: string }[];
  const existingByName = new Map(existing.map(t => [t.name, { uid: t.uid, targetUid: t.targetUid }]));

  const uidMap: TemplateUidMap = new Map();
  let created = 0;
  let reused = 0;

  for (const tpl of index) {
    // Check if template already exists (by name)
    const existingEntry = existingByName.get(tpl.name);
    if (existingEntry) {
      uidMap.set(tpl.uid, existingEntry.uid);
      // Also map targetUid
      if (tpl.targetUid && existingEntry.targetUid) {
        uidMap.set(tpl.targetUid, existingEntry.targetUid);
      }
      reused++;
      continue;
    }

    // Read template spec for content
    const tplFile = path.join(tplDir, tpl.file);
    if (!fs.existsSync(tplFile)) continue;
    const tplSpec = loadYaml<Record<string, unknown>>(tplFile);
    const content = tplSpec.content as Record<string, unknown>;
    const collName = (tpl.collection || tplSpec.collectionName) as string || '';

    try {
      let newTargetUid: string | undefined;

      if (tpl.type === 'popup' && content) {
        // Popup template: create a field-like node, compose blocks into its ChildPage
        newTargetUid = await createPopupTemplateContent(nb, content, collName);
      } else if (tpl.type === 'block' && content) {
        // Block template: compose a single block
        newTargetUid = await createBlockTemplateContent(nb, content, collName);
      }

      if (!newTargetUid) {
        log(`  ! template ${tpl.name}: failed to create content`);
        continue;
      }

      // Register template
      const resp = await nb.http.post(`${nb.baseUrl}/api/flowModelTemplates:create`, {
        values: {
          uid: generateUid(),
          name: tpl.name,
          type: tpl.type,
          collectionName: collName,
          dataSourceKey: (tplSpec.dataSourceKey as string) || 'main',
          targetUid: newTargetUid,
        },
      });

      const newTplUid = resp.data?.data?.uid;
      if (newTplUid) {
        uidMap.set(tpl.uid, newTplUid);
        if (tpl.targetUid) uidMap.set(tpl.targetUid, newTargetUid);
        created++;
      }
    } catch (e) {
      log(`  ! template ${tpl.name}: ${e instanceof Error ? e.message.slice(0, 80) : e}`);
    }
  }

  if (created || reused) {
    log(`  templates: ${created} created, ${reused} reused`);
  }

  return uidMap;
}

/**
 * Create popup template content: a DisplayTextFieldModel with ChildPage containing blocks.
 */
async function createPopupTemplateContent(
  nb: NocoBaseClient,
  content: Record<string, unknown>,
  collName: string,
): Promise<string | undefined> {
  // Create a host node (DisplayTextFieldModel) that will hold the ChildPage
  const hostUid = generateUid();
  await nb.models.save({
    uid: hostUid,
    use: 'DisplayTextFieldModel',
    stepParams: {},
    flowRegistry: {},
  });

  // Compose blocks into the host (creates ChildPage automatically)
  const tabs = content.tabs as Record<string, unknown>[];
  const blocks = content.blocks as Record<string, unknown>[];

  if (tabs?.length) {
    // Multi-tab: compose first tab, then addPopupTab for rest
    const firstBlocks = (tabs[0].blocks || []) as Record<string, unknown>[];
    const composeBlocks = firstBlocks
      .map(b => toComposeBlock(b as any, collName))
      .filter(Boolean) as Record<string, unknown>[];

    if (composeBlocks.length) {
      try {
        await nb.surfaces.compose(hostUid, composeBlocks, 'replace');
      } catch { /* skip */ }
    }

    // Additional tabs
    for (let i = 1; i < tabs.length; i++) {
      try {
        // Read ChildPage to add tab
        const d = await nb.get({ uid: hostUid });
        const page = d.tree.subModels?.page as unknown as Record<string, unknown>;
        if (page?.uid) {
          const tabResult = await nb.surfaces.addPopupTab(page.uid as string, (tabs[i].title as string) || `Tab${i}`);
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
      } catch { /* skip */ }
    }
  } else if (blocks?.length) {
    // Single tab
    const composeBlocks = blocks
      .map(b => toComposeBlock(b as any, collName))
      .filter(Boolean) as Record<string, unknown>[];
    if (composeBlocks.length) {
      try {
        await nb.surfaces.compose(hostUid, composeBlocks, 'replace');
      } catch { /* skip */ }
    }
  }

  return hostUid;
}

/**
 * Create block template content: a single block node.
 */
async function createBlockTemplateContent(
  nb: NocoBaseClient,
  content: Record<string, unknown>,
  collName: string,
): Promise<string | undefined> {
  // For block templates, the targetUid is the actual block model
  // Create via compose on a temporary host, then return the block UID
  const hostUid = generateUid();

  const composeBlock = toComposeBlock(content as any, collName);
  if (!composeBlock) return undefined;

  try {
    // Create a temporary grid to compose into
    await nb.models.save({
      uid: hostUid,
      use: 'BlockGridModel',
      stepParams: {},
      flowRegistry: {},
    });

    const result = await nb.surfaces.compose(hostUid, [composeBlock], 'replace');
    return result.blocks?.[0]?.uid || hostUid;
  } catch {
    return hostUid;
  }
}

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
