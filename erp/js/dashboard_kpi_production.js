/**
 * KPI 卡片积木模板
 *
 * @type JSBlockModel
 * @template kpi-card
 *
 * === AI 修改指南 ===
 * 1. 修改 CONFIG 对象（标题、颜色、SQL）
 * 2. 修改 SQL（查询你的业务数据）
 * 3. 修改 parseResult（从 SQL 结果提取数值）
 * 4. 不要动 KpiCard 组件和样式 — 它们是通用的
 * ====================
 */

// ─── CONFIG: AI 修改这里 ───────────────────────────
const CONFIG = {
  title: '本月产出',              // 卡片标题
  gradient: ['#52c41a', '#95de64'], // 渐变色 [起始, 结束]
  textColor: '#fff',                // 文字颜色
  prefix: '',                      // 数值前缀 (¥, 件, %)
  suffix: ' 件',                        // 数值后缀
};

// SQL: 查询当前周期 + 上一周期（用于计算环比）
// __var1=当前开始, __var2=当前结束, __var3=上期开始, __var4=上期结束
const SQL = `
SELECT
  COALESCE(SUM(CASE WHEN "createdAt" >= :__var1 AND "createdAt" <= :__var2
    THEN completed_qty ELSE 0 END), 0) as current_value,
  COALESCE(SUM(CASE WHEN "createdAt" >= :__var3 AND "createdAt" < :__var4
    THEN completed_qty ELSE 0 END), 0) as previous_value
FROM nb_erp_work_orders
WHERE status IN ('生产中', '已完工', '已关闭')
`;

// 从 SQL 结果提取数值
const parseResult = (row) => ({
  value: parseFloat(row?.current_value || 0),
  previous: parseFloat(row?.previous_value || 0),
});
// ─── CONFIG END ────────────────────────────────────

// ─── 以下不需要修改 ───────────────────────────────
const { useState, useEffect } = ctx.React;
const { Spin } = ctx.antd;

const fmt = (v, prefix = '', suffix = '') => {
  const abs = Math.abs(v);
  const str = abs >= 1e8 ? `${(abs/1e8).toFixed(1)}亿`
    : abs >= 1e4 ? `${(abs/1e4).toFixed(1)}万`
    : abs.toLocaleString('zh-CN', { maximumFractionDigits: 0 });
  return `${prefix}${str}${suffix}`;
};

const KpiCard = () => {
  const [data, setData] = useState({ value: 0, previous: 0, loading: true });

  useEffect(() => {
    (async () => {
      try {
        const now = ctx.libs.dayjs();
        const start = now.startOf('month').format('YYYY-MM-DD 00:00:00');
        const end = now.endOf('month').format('YYYY-MM-DD 23:59:59');
        const prevStart = now.subtract(1, 'month').startOf('month').format('YYYY-MM-DD 00:00:00');
        const prevEnd = now.startOf('month').format('YYYY-MM-DD 00:00:00');

        const result = await ctx.sql.run({
          sql: SQL,
          bind: { __var1: start, __var2: end, __var3: prevStart, __var4: prevEnd },
          type: 'selectRows', dataSourceKey: 'main',
        });
        const parsed = parseResult(result?.[0]);
        setData({ ...parsed, loading: false });
      } catch (e) {
        console.error('KPI fetch error:', e);
        setData(prev => ({ ...prev, loading: false }));
      }
    })();
  }, []);

  const trend = data.previous > 0
    ? ((data.value - data.previous) / data.previous * 100).toFixed(1)
    : null;
  const trendUp = parseFloat(trend) >= 0;

  const style = {
    background: `linear-gradient(135deg, ${CONFIG.gradient[0]}, ${CONFIG.gradient[1]})`,
    borderRadius: 12, padding: '24px 28px', minHeight: 120,
    color: CONFIG.textColor, position: 'relative', overflow: 'hidden',
    margin: '-24px', height: 'calc(100% + 48px)', width: 'calc(100% + 48px)',
  };

  if (data.loading) return (<div style={style}><Spin /></div>);

  return (
    <div style={style}>
      <div style={{ fontSize: 14, opacity: 0.85, marginBottom: 8 }}>{CONFIG.title}</div>
      <div style={{ fontSize: 32, fontWeight: 700, letterSpacing: '-0.03em' }}>
        {fmt(data.value, CONFIG.prefix, CONFIG.suffix)}
      </div>
      {trend !== null && (
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.9 }}>
          <span style={{ marginRight: 4 }}>{trendUp ? '↑' : '↓'}</span>
          <span>环比 {trendUp ? '+' : ''}{trend}%</span>
        </div>
      )}
      {/* 装饰圆 */}
      <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100,
        borderRadius: '50%', background: 'rgba(255,255,255,0.1)' }} />
      <div style={{ position: 'absolute', right: 30, bottom: -30, width: 80, height: 80,
        borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
    </div>
  );
};

ctx.render(<KpiCard />);
