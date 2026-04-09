/**
 * Budget Utilization — formatted budget display with color coding
 * @type JSColumnModel
 */
const { Tag } = ctx.antd;
const r = ctx.record;
const budget = Number(r.budget) || 0;

const fmt = (v) => {
  if (v >= 1000000) return '$' + (v / 1000000).toFixed(1) + 'M';
  if (v >= 1000) return '$' + (v / 1000).toFixed(0) + 'K';
  return '$' + v;
};

if (budget >= 100000) {
  ctx.render(<Tag color="blue">${fmt(budget)}</Tag>);
} else if (budget >= 50000) {
  ctx.render(<Tag color="green">${fmt(budget)}</Tag>);
} else if (budget > 0) {
  ctx.render(<Tag>{fmt(budget)}</Tag>);
} else {
  ctx.render(<Tag color="gray">No Budget</Tag>);
}
