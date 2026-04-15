/**
 * KPI Summary Cards Block
 *
 * @type JSBlockModel
 * @template kpi-card
 * @collection {{COLLECTION}}
 *
 * === Parameters ===
 * REPORT_UID : unique ID for SQL registration (e.g. "erp_products_kpi")
 * SQL        : query returning ONE row with named columns (each becomes a card)
 * CARDS      : array of { key, title, format } — key = SQL column, format = "number"|"currency"|"percent"
 */

// ─── CONFIG: modify here ─────────────────────────────────────
const CONFIG = {
  dataSourceKey: 'main',
  reportUid: '{{REPORT_UID}}',
  sql: `{{SQL}}`,
  cards: {{CARDS}},
  currencySymbol: '{{CURRENCY_SYMBOL||$}}',
};
// ─── END CONFIG ──────────────────────────────────────────────

const { useState, useEffect } = ctx.React;
const { Row, Col, Spin, Statistic, message } = ctx.antd;

// Theme
const algorithm = ctx.antdConfig?.theme?.algorithm;
const darkAlgo = ctx.antd.theme.darkAlgorithm;
const isDark = Array.isArray(algorithm)
  ? algorithm.some(fn => fn === darkAlgo)
  : algorithm === darkAlgo;
const T = ctx.themeToken || {};

const styles = {
  card: {
    background: T.colorBgContainer || '#fff',
    border: `1px solid ${T.colorBorderSecondary || '#f0f0f0'}`,
    borderRadius: 8,
    padding: '16px',
    height: '100%',
  },
};

// Data hook
function useKpiData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (ctx.flowSettingsEnabled && CONFIG.sql) {
        try {
          await ctx.sql.save({
            uid: CONFIG.reportUid,
            sql: CONFIG.sql.trim(),
            dataSourceKey: CONFIG.dataSourceKey,
          });
        } catch (e) { console.error('SQL save error:', e); }
      }
      setLoading(true);
      try {
        const result = await ctx.sql.runById(CONFIG.reportUid, {
          type: 'selectRows',
          dataSourceKey: CONFIG.dataSourceKey,
        });
        setData(result?.[0] || {});
      } catch (e) {
        console.error('KPI query error:', e);
        setData({});
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  return { data, loading };
}

// Formatters
const fmt = (value, format, symbol) => {
  const v = Number(value) || 0;
  if (format === 'currency') {
    if (v >= 1e6) return `${symbol}${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${symbol}${(v / 1e3).toFixed(0)}K`;
    return `${symbol}${v.toFixed(0)}`;
  }
  if (format === 'percent') return v;
  return v;
};

const StatCard = ({ title, value, suffix }) => (
  <div style={styles.card}>
    <Statistic title={title} value={value} suffix={suffix}
      valueStyle={{ fontSize: 24, fontWeight: 600 }} />
  </div>
);

const KpiCards = () => {
  const { data, loading } = useKpiData();
  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><Spin /></div>;

  const d = data || {};
  const colSpan = Math.max(Math.floor(24 / CONFIG.cards.length), 6);

  return (
    <Row gutter={[12, 12]}>
      {CONFIG.cards.map(c => (
        <Col key={c.key} xs={12} sm={12} md={colSpan}>
          <StatCard
            title={c.title}
            value={fmt(d[c.key], c.format, CONFIG.currencySymbol)}
            suffix={c.format === 'percent' ? '%' : undefined}
          />
        </Col>
      ))}
    </Row>
  );
};

ctx.render(<KpiCards />);
