/**
 * Stats Filter Block — status distribution with clickable buttons
 *
 * @type JSItemModel
 * @template stats-filter
 * @collection {{COLLECTION}}
 *
 * === Parameters ===
 * COLLECTION  : data table name (e.g. nb_erp_products)
 * GROUP_FIELD : field to group by (default: status)
 * REPORT_UID  : unique ID for SQL registration
 */

// ─── CONFIG: modify here ─────────────────────────────────────
const CONFIG = {
  dataSourceKey: 'main',
  reportUid: '{{REPORT_UID||{{COLLECTION}}_stats}}',
  collection: '{{COLLECTION}}',
  groupField: '{{GROUP_FIELD||status}}',
  sql: `SELECT COALESCE({{GROUP_FIELD||status}}, 'N/A') AS label, count(*) AS cnt FROM {{COLLECTION}} GROUP BY {{GROUP_FIELD||status}} ORDER BY cnt DESC`,
  totalSql: `SELECT count(*) AS cnt FROM {{COLLECTION}}`,
};
// ─── END CONFIG ──────────────────────────────────────────────

const { useState, useEffect } = ctx.React;
const { Space, Button, Badge, Spin } = ctx.antd;
const T = ctx.themeToken || {};

function useStats() {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // Register SQL templates
      if (ctx.flowSettingsEnabled) {
        try {
          await ctx.sql.save({ uid: CONFIG.reportUid + '_total', sql: CONFIG.totalSql.trim(), dataSourceKey: CONFIG.dataSourceKey });
          await ctx.sql.save({ uid: CONFIG.reportUid + '_group', sql: CONFIG.sql.trim(), dataSourceKey: CONFIG.dataSourceKey });
        } catch (e) { console.error('SQL save error:', e); }
      }
      setLoading(true);
      try {
        const [totalRows, groupRows] = await Promise.all([
          ctx.sql.runById(CONFIG.reportUid + '_total', { type: 'selectRows', dataSourceKey: CONFIG.dataSourceKey }),
          ctx.sql.runById(CONFIG.reportUid + '_group', { type: 'selectRows', dataSourceKey: CONFIG.dataSourceKey }),
        ]);
        const items = [{ key: 'all', label: 'All', count: Number(totalRows?.[0]?.cnt) || 0 }];
        for (const row of (groupRows || [])) {
          items.push({ key: String(row.label), label: String(row.label), count: Number(row.cnt) || 0 });
        }
        setStats(items);
      } catch (e) {
        console.error('Stats query error:', e);
        setStats([{ key: 'all', label: 'All', count: '-' }]);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  return { stats, loading };
}

const StatsFilter = () => {
  const [active, setActive] = useState('all');
  const { stats, loading } = useStats();

  if (loading) return <Spin size="small" />;

  return (
    <Space wrap>
      {stats.map(b => (
        <Button
          key={b.key}
          type={active === b.key ? 'primary' : 'default'}
          size="small"
          onClick={() => setActive(b.key)}
        >
          {b.label} <Badge count={b.count} showZero style={{ marginLeft: 6, backgroundColor: active === b.key ? '#fff' : '#1677ff', color: active === b.key ? '#1677ff' : '#fff' }} />
        </Button>
      ))}
    </Space>
  );
};

ctx.render(<StatsFilter />);
