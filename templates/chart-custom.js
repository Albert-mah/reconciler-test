/**
 * ECharts 自定义图表积木模板
 *
 * @type chart.option.raw
 * @template chart-custom
 *
 * === AI 修改指南 ===
 * 1. 修改 buildOption(data) 函数里的 ECharts 配置
 * 2. data 已经是数组（自动从 ctx.data.objects 提取并校验）
 * 3. 不需要处理 ctx.data 格式问题 — 模板已处理
 * ====================
 */

// ─── 安全数据提取（不要动） ───────────────────────
const data = (() => {
  const raw = ctx.data;
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.objects)) return raw.objects;
  if (raw && Array.isArray(raw.data)) return raw.data;
  return [];
})();

if (data.length === 0) {
  return { title: { text: '暂无数据', left: 'center', top: 'center', textStyle: { color: '#999', fontSize: 14 } } };
}

// ─── CONFIG: AI 修改这里 ───────────────────────────
function buildOption(data) {
  // 示例：柱状图
  const categories = data.map(d => d.name || '');
  const values = data.map(d => parseFloat(d.value || 0));

  return {
    title: { text: '图表标题', left: 'center', textStyle: { fontSize: 14 } },
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: categories },
    yAxis: { type: 'value' },
    series: [{
      type: 'bar',
      data: values,
      itemStyle: { color: '#1677ff', borderRadius: [4, 4, 0, 0] },
    }],
  };
}
// ─── CONFIG END ────────────────────────────────────

return buildOption(data);
