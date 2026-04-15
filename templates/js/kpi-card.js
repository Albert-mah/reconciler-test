/**
 * KPI Card — single metric with SQL query
 *
 * @type JSBlockModel
 * @template kpi-card
 * @collection {{COLLECTION}}
 *
 * === Parameters ===
 * LABEL     : display title (e.g. "Total Products")
 * COLOR     : accent color (e.g. "#3b82f6")
 * SQL       : query returning single row with `value` column
 * PREFIX    : value prefix (e.g. "$", "", "x")
 */

// ─── CONFIG: modify here ─────────────────────────────────────
const LABEL = '{{LABEL||Total}}';
const COLOR = '{{COLOR||#3b82f6}}';
const SQL = `{{SQL||SELECT count(*) AS value FROM {{COLLECTION}}}}`;
const PREFIX = '{{PREFIX||}}';
// ─── END CONFIG ──────────────────────────────────────────────

const { useState, useEffect } = ctx.React;
const h = ctx.React.createElement;

const KpiCard = () => {
  const [value, setValue] = useState('...');

  useEffect(() => {
    (async () => {
      try {
        const rows = await ctx.sql(SQL);
        setValue(rows?.[0]?.value ?? '-');
      } catch {
        setValue('ERR');
      }
    })();
  }, []);

  return h('div', {
    style: {
      padding: '20px 24px',
      borderRadius: '12px',
      background: `linear-gradient(135deg, ${COLOR}15, ${COLOR}08)`,
      borderLeft: `4px solid ${COLOR}`,
    }
  },
    h('div', { style: { fontSize: '13px', color: '#666', marginBottom: '8px' } }, LABEL),
    h('div', { style: { fontSize: '28px', fontWeight: '700', color: COLOR } }, PREFIX + String(value)),
  );
};

ctx.render(h(KpiCard, null));
