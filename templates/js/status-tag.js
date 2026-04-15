/**
 * Status Tag Column — colored tag based on field value
 *
 * @type JSColumnModel
 * @template status-tag
 * @collection {{COLLECTION}}
 *
 * === Parameters ===
 * FIELD     : record field name to display (e.g. "status")
 * COLOR_MAP : value → color mapping (JSON object)
 */

// ─── CONFIG: modify here ─────────────────────────────────────
const FIELD = '{{FIELD||status}}';
const COLOR_MAP = {{COLOR_MAP||{
  active: '#52c41a',
  inactive: '#d9d9d9',
  pending: '#faad14',
  completed: '#1677ff',
  cancelled: '#ff4d4f',
}}};
// ─── END CONFIG ──────────────────────────────────────────────

const { Tag } = ctx.antd;
const value = String(ctx.record?.[FIELD] || '');
const color = COLOR_MAP[value.toLowerCase()] || '#d9d9d9';

ctx.render(ctx.React.createElement(Tag, { color }, value || '-'));
