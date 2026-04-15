/**
 * Progress Bar Column — visual percentage indicator
 *
 * @type JSColumnModel
 * @template progress-bar
 * @collection {{COLLECTION}}
 *
 * === Parameters ===
 * VALUE_FIELD : field with current value (e.g. "completed_qty")
 * TOTAL_FIELD : field with total value (e.g. "total_qty"), or a number
 * COLORS     : [danger, warning, success] thresholds at 30%/70%
 */

// ─── CONFIG: modify here ─────────────────────────────────────
const VALUE_FIELD = '{{VALUE_FIELD||completed}}';
const TOTAL_FIELD = '{{TOTAL_FIELD||total}}';
const COLORS = ['#ff4d4f', '#faad14', '#52c41a'];
// ─── END CONFIG ──────────────────────────────────────────────

const h = ctx.React.createElement;
const r = ctx.record;
const val = Number(r?.[VALUE_FIELD]) || 0;
const total = Number(r?.[TOTAL_FIELD]) || 1;
const pct = Math.min(Math.round((val / total) * 100), 100);
const color = pct < 30 ? COLORS[0] : pct < 70 ? COLORS[1] : COLORS[2];

ctx.render(h('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
  h('div', { style: { flex: 1, height: '8px', borderRadius: '4px', background: '#f0f0f0' } },
    h('div', { style: { width: pct + '%', height: '100%', borderRadius: '4px', background: color, transition: 'width 0.3s' } })
  ),
  h('span', { style: { fontSize: '12px', color: '#666', minWidth: '36px' } }, pct + '%'),
));
