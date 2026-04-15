/**
 * Stats Filter Block — status distribution buttons with live counts
 *
 * @type JSItemModel
 * @template stats-filter
 *
 * Copy this file to your page's js/ directory, then modify CONFIG.
 *
 * SQL flow: ctx.sql.save({ uid, sql }) → ctx.sql.runById(uid, { type: 'selectRows' })
 */

// ─── CONFIG: modify here ─────────────────────────────────────
var CONFIG = {
  dataSourceKey: 'main',
  reportUid: 'my_collection_stats',
  totalSql: 'SELECT count(*) AS cnt FROM my_collection',
  groupSql: "SELECT COALESCE(status, 'N/A') AS label, count(*) AS cnt FROM my_collection GROUP BY status ORDER BY cnt DESC",
};
// ─── END CONFIG ──────────────────────────────────────────────

var React = ctx.React;
var useState = React.useState;
var useEffect = React.useEffect;
var Space = ctx.antd.Space, Button = ctx.antd.Button, Badge = ctx.antd.Badge, Spin = ctx.antd.Spin;

function useStats() {
  var _s = useState([]), stats = _s[0], setStats = _s[1];
  var _l = useState(true), loading = _l[0], setLoading = _l[1];

  useEffect(function() {
    var init = async function() {
      if (ctx.flowSettingsEnabled) {
        try {
          await ctx.sql.save({ uid: CONFIG.reportUid + '_total', sql: CONFIG.totalSql.trim(), dataSourceKey: CONFIG.dataSourceKey });
          await ctx.sql.save({ uid: CONFIG.reportUid + '_group', sql: CONFIG.groupSql.trim(), dataSourceKey: CONFIG.dataSourceKey });
        } catch(e) {}
      }
      try {
        var totalRows = await ctx.sql.runById(CONFIG.reportUid + '_total', { type: 'selectRows', dataSourceKey: CONFIG.dataSourceKey });
        var groupRows = await ctx.sql.runById(CONFIG.reportUid + '_group', { type: 'selectRows', dataSourceKey: CONFIG.dataSourceKey });
        var items = [{ key: 'all', label: 'All', count: Number(totalRows?.[0]?.cnt) || 0 }];
        (groupRows || []).forEach(function(row) {
          items.push({ key: String(row.label), label: String(row.label), count: Number(row.cnt) || 0 });
        });
        setStats(items);
      } catch(e) {
        setStats([{ key: 'all', label: 'All', count: '-' }]);
      }
      setLoading(false);
    };
    init();
  }, []);

  return { stats: stats, loading: loading };
}

var Comp = function() {
  var _a = useState('all'), active = _a[0], setActive = _a[1];
  var r = useStats();

  if (r.loading) return React.createElement(Spin, { size: 'small' });

  return React.createElement(Space, { wrap: true },
    r.stats.map(function(b) {
      return React.createElement(Button, {
        key: b.key,
        type: active === b.key ? 'primary' : 'default',
        size: 'small',
        onClick: function() { setActive(b.key); },
      }, b.label + ' (' + b.count + ')');
    })
  );
};

ctx.render(React.createElement(Comp));
