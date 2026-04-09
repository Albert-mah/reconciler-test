/**
 * Milestone Completion Progress Bar — div-based bar with percentage
 * @type JSColumnModel
 */
const h = ctx.React.createElement;
const r = ctx.record;
const pct = Math.min(Number(r.completion_pct) || 0, 100);
const color = pct >= 100 ? '#52c41a' : pct >= 50 ? '#1677ff' : pct >= 25 ? '#fa8c16' : '#ff4d4f';

ctx.render(h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 120 } },
  h('div', { style: { flex: 1, height: 6, background: '#f0f0f0', borderRadius: 3, overflow: 'hidden' } },
    h('div', { style: { width: `${pct}%`, height: '100%', background: color, borderRadius: 3 } })
  ),
  h('span', { style: { fontSize: 12, color, fontWeight: 600, minWidth: 36 } }, `${pct}%`)
));
