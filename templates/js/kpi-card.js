/**
 * KPI Summary Cards Block
 *
 * @type JSBlockModel
 * @template kpi-card
 *
 * Copy this file to your page's js/ directory, then modify CONFIG:
 * - CARDS: define each KPI card (title, color, data source)
 * - Each card can use SQL (ctx.sql.save + runById) or API (ctx.api.request)
 *
 * SQL flow:  ctx.sql.save({ uid, sql }) → ctx.sql.runById(uid, { type: 'selectRows' })
 * API flow:  ctx.api.request({ url: 'collection:list', params: { ... } })
 */

// ─── CONFIG: modify here ─────────────────────────────────────
var CARDS = [
  {
    title: 'Total Records',
    color: '#3b82f6',
    // SQL mode: register + run
    reportUid: 'my_kpi_total',
    sql: 'SELECT count(*) AS value FROM my_collection',
  },
  {
    title: 'Active',
    color: '#22c55e',
    reportUid: 'my_kpi_active',
    sql: "SELECT count(*) AS value FROM my_collection WHERE status = 'active'",
  },
  // API mode example:
  // {
  //   title: 'This Month',
  //   color: '#8b5cf6',
  //   api: { url: 'my_collection:list', params: { pageSize: 1, filter: JSON.stringify({ createdAt: { $gte: monthStart } }) } },
  //   getValue: function(res) { return res?.data?.meta?.count || 0; },
  // },
];
var CURRENCY_SYMBOL = '$';
var DATA_SOURCE_KEY = 'main';
// ─── END CONFIG ──────────────────────────────────────────────

var React = ctx.React;
var useState = React.useState;
var useEffect = React.useEffect;
var Row = ctx.antd.Row, Col = ctx.antd.Col, Spin = ctx.antd.Spin;
var T = ctx.themeToken || {};

var kpiStyle = {
  borderRadius: 12, padding: '16px 20px',
  background: T.colorBgContainer || '#fff',
  border: '1px solid ' + (T.colorBorderSecondary || '#f0f0f0'),
  minHeight: 90, transition: 'all 0.2s ease',
};
var labelStyle = { fontSize: '0.875rem', fontWeight: 600, color: T.colorTextSecondary || '#333', marginBottom: 4 };
var valStyle = function(color) {
  return { fontSize: '1.6rem', fontWeight: 700, color: color, letterSpacing: '-0.02em' };
};

var fmtCurrency = function(v) {
  var n = Number(v) || 0;
  if (n >= 1e6) return CURRENCY_SYMBOL + (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return CURRENCY_SYMBOL + (n / 1e3).toFixed(1) + 'K';
  return CURRENCY_SYMBOL + n.toFixed(0);
};

function useKpiData() {
  var _s = useState(null), data = _s[0], setData = _s[1];
  var _l = useState(true), loading = _l[0], setLoading = _l[1];

  useEffect(function() {
    var init = async function() {
      // Register SQL templates
      if (ctx.flowSettingsEnabled) {
        for (var c of CARDS) {
          if (c.sql && c.reportUid) {
            try { await ctx.sql.save({ uid: c.reportUid, sql: c.sql.trim(), dataSourceKey: DATA_SOURCE_KEY }); } catch(e) {}
          }
        }
      }
      // Fetch all cards
      var results = {};
      await Promise.all(CARDS.map(async function(c) {
        try {
          if (c.reportUid) {
            var rows = await ctx.sql.runById(c.reportUid, { type: 'selectRows', dataSourceKey: DATA_SOURCE_KEY });
            results[c.title] = Number(rows?.[0]?.value) || 0;
          } else if (c.api) {
            var res = await ctx.api.request(c.api);
            results[c.title] = c.getValue ? c.getValue(res) : (res?.data?.meta?.count || 0);
          }
        } catch(e) { results[c.title] = 0; }
      }));
      setData(results);
      setLoading(false);
    };
    init();
  }, []);

  return { data: data, loading: loading };
}

var KPI = function(props) {
  return React.createElement('div', { style: kpiStyle, className: 'kpi-hover' },
    React.createElement('div', { style: labelStyle }, props.title),
    React.createElement('span', { style: valStyle(props.color) },
      props.format === 'currency' ? fmtCurrency(props.value) : (props.value || 0)
    )
  );
};

var Comp = function() {
  var r = useKpiData();
  if (r.loading) return React.createElement('div', { style: { textAlign: 'center', padding: 24 } }, React.createElement(Spin));
  var d = r.data || {};
  var span = Math.max(Math.floor(24 / CARDS.length), 6);
  return React.createElement(Row, { gutter: [12, 12] },
    CARDS.map(function(c) {
      return React.createElement(Col, { key: c.title, xs: 12, md: span },
        React.createElement(KPI, { title: c.title, value: d[c.title], color: c.color, format: c.format })
      );
    })
  );
};

ctx.render(React.createElement(React.Fragment, null,
  React.createElement('style', null, '.kpi-hover{transition:all .2s ease}.kpi-hover:hover{box-shadow:0 4px 12px rgba(0,0,0,.1);transform:translateY(-2px);border-color:#d0d0d0!important}'),
  React.createElement(Comp)
));
