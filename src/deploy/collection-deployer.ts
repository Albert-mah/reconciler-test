/**
 * Create/update collections and fields using collections:apply API.
 *
 * collections:apply is a high-level upsert API that:
 * - Creates collection if new, updates if exists
 * - Handles fields in one call (auto-derives type, uiSchema from interface)
 * - Validates field definitions server-side
 */
import type { NocoBaseClient } from '../client';
import type { CollectionDef, FieldDef } from '../types/spec';

/**
 * Convert our DSL FieldDef to collections:apply field format.
 *
 * collections:apply accepts compact fields: { name, interface, title, target, foreignKey, enum }
 * Server auto-derives: type, uiSchema, component, etc.
 */
function toApplyField(fd: FieldDef): Record<string, unknown> {
  const field: Record<string, unknown> = {
    name: fd.name,
    interface: fd.interface,
    title: fd.title,
  };

  // Relation fields
  if (fd.target) field.target = fd.target;
  if (fd.foreignKey) field.foreignKey = fd.foreignKey;
  if (fd.targetField) field.targetKey = fd.targetField;

  // Required
  if (fd.required) field.required = true;

  // Default value
  if (fd.default !== undefined) field.defaultValue = fd.default;

  // Select/enum options
  if (fd.options) {
    field.enum = fd.options.map(o =>
      typeof o === 'string' ? { value: o, label: o } : o,
    );
  }

  // Description
  if (fd.description) field.description = fd.description;

  return field;
}

/**
 * Ensure a collection exists with all specified fields.
 * Uses collections:apply for idempotent upsert.
 */
export async function ensureCollection(
  nb: NocoBaseClient,
  name: string,
  def: CollectionDef,
  log: (msg: string) => void = console.log,
): Promise<void> {
  const fields = def.fields.map(toApplyField);

  try {
    await nb.collections.apply({
      name,
      title: def.title,
      fields,
    });
    log(`  = collection: ${name}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Fallback: if apply fails (404=older NocoBase, 500=upsert issue), use legacy
    if (msg.includes('404') || msg.includes('500') || msg.includes('Not Found')) {
      await ensureCollectionLegacy(nb, name, def, log);
    } else {
      log(`  ! collection ${name}: ${msg}`);
    }
  }
}

/**
 * Legacy fallback: create collection + fields individually.
 */
async function ensureCollectionLegacy(
  nb: NocoBaseClient,
  name: string,
  def: CollectionDef,
  log: (msg: string) => void,
): Promise<void> {
  const exists = await nb.collections.exists(name);
  if (exists) {
    log(`  = collection: ${name}`);
  } else {
    await nb.collections.create(name, def.title);
    log(`  + collection: ${name}`);
  }

  for (const fd of def.fields) {
    try {
      const meta = await nb.collections.fieldMeta(name);
      if (fd.name in meta) continue;
      await nb.collections.createField(name, fd);
      log(`    + ${name}.${fd.name}`);
    } catch (e) {
      log(`    ! ${name}.${fd.name}: ${e instanceof Error ? e.message : e}`);
    }
  }
  nb.collections.clearCache();
}

/**
 * Ensure all collections from structure.yaml exist.
 */
export async function ensureAllCollections(
  nb: NocoBaseClient,
  collections: Record<string, CollectionDef>,
  log: (msg: string) => void = console.log,
): Promise<void> {
  for (const [name, def] of Object.entries(collections)) {
    await ensureCollection(nb, name, def, log);
  }
}
