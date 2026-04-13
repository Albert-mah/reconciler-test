/**
 * Single source of truth for block type <-> model name mapping.
 *
 * Used by:
 *   - surface-deployer.ts (BLOCK_TYPES: type → model)
 *   - block-exporter.ts should also use MODEL_TO_TYPE (model → type)
 *     TODO: update block-exporter.ts to import MODEL_TO_TYPE (src/export/ handled by another agent)
 */

/** Block type shorthand → FlowModel class name. */
export const BLOCK_TYPES: Record<string, string> = {
  table: 'TableBlockModel',
  filterForm: 'FilterFormBlockModel',
  createForm: 'CreateFormModel',
  editForm: 'EditFormModel',
  details: 'DetailsBlockModel',
  list: 'ListBlockModel',
  gridCard: 'GridCardBlockModel',
  jsBlock: 'JSBlockModel',
  chart: 'ChartBlockModel',
  markdown: 'MarkdownBlockModel',
  iframe: 'IframeBlockModel',
  comments: 'CommentsBlockModel',
  recordHistory: 'RecordHistoryBlockModel',
  mailMessages: 'MailMessagesBlockModel',
  reference: 'ReferenceBlockModel',
};

/** FlowModel class name → block type shorthand (reverse of BLOCK_TYPES). */
export const MODEL_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(BLOCK_TYPES).map(([k, v]) => [v, k]),
);

/**
 * Action type shorthand → FlowModel class name.
 *
 * Complete map covering both compose-supported and non-compose (legacy save_model) actions.
 * The NON_COMPOSE subset is the group that must be created via individual save_model calls
 * (not supported by the compose API).
 */
export const ACTION_TYPES: Record<string, string> = {
  // Compose-supported actions
  filter: 'FilterActionModel',
  refresh: 'RefreshActionModel',
  addNew: 'AddNewActionModel',
  delete: 'DeleteActionModel',
  bulkDelete: 'BulkDeleteActionModel',
  submit: 'SubmitActionModel',
  reset: 'ResetActionModel',
  edit: 'EditActionModel',
  view: 'ViewActionModel',
  // Non-compose (legacy save_model) actions
  duplicate: 'DuplicateActionModel',
  export: 'ExportActionModel',
  import: 'ImportActionModel',
  link: 'LinkActionModel',
  workflowTrigger: 'CollectionTriggerWorkflowActionModel',
  ai: 'AIEmployeeButtonModel',
  expandCollapse: 'ExpandCollapseActionModel',
  popup: 'PopupCollectionActionModel',
  updateRecord: 'UpdateRecordActionModel',
  addChild: 'AddChildActionModel',
  historyExpand: 'RecordHistoryExpandActionModel',
  historyCollapse: 'RecordHistoryCollapseActionModel',
};

/**
 * FlowModel class name → action type shorthand (reverse of ACTION_TYPES).
 *
 * Note: some model names map to the same type (e.g. SubmitActionModel,
 * FormSubmitActionModel, FilterFormSubmitActionModel all → 'submit').
 * This reverse map only contains the canonical entry from ACTION_TYPES.
 * The exporter's ACTION_TYPE_MAP has additional aliases; those are kept
 * in block-exporter.ts until that module migrates to this shared map.
 */
export const ACTION_MODEL_TO_TYPE: Record<string, string> = Object.fromEntries(
  Object.entries(ACTION_TYPES).map(([k, v]) => [v, k]),
);
