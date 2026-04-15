/**
 * Currency Column — formatted number with currency symbol
 *
 * @type JSColumnModel
 * @template currency
 * @collection {{COLLECTION}}
 *
 * === Parameters ===
 * FIELD    : record field name (e.g. "price", "total_amount")
 * SYMBOL   : currency symbol (e.g. "$", "¥", "EUR")
 * DECIMALS : decimal places (default: 2)
 */

// ─── CONFIG: modify here ─────────────────────────────────────
const FIELD = '{{FIELD||price}}';
const SYMBOL = '{{SYMBOL||$}}';
const DECIMALS = {{DECIMALS||2}};
// ─── END CONFIG ──────────────────────────────────────────────

const value = Number(ctx.record?.[FIELD]);
const formatted = isNaN(value) ? '-' : SYMBOL + value.toFixed(DECIMALS).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

ctx.render(ctx.React.createElement('span', {
  style: { fontVariantNumeric: 'tabular-nums' },
}, formatted));
