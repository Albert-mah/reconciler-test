/**
 * WO Yield Rate Tag
 * @type JSColumnModel
 */
const { Tag } = ctx.antd;
const r = ctx.record;
const completed = parseInt(r.completed_qty) || 0;
const defect = parseInt(r.defect_qty) || 0;
const total = completed + defect;

if (total <= 0) {
  ctx.render(<Tag color="default">-</Tag>);
} else {
  const yieldRate = (completed / total * 100).toFixed(1);
  const num = parseFloat(yieldRate);
  if (num >= 98) {
    ctx.render(<Tag color="green">{yieldRate}%</Tag>);
  } else if (num >= 95) {
    ctx.render(<Tag color="blue">{yieldRate}%</Tag>);
  } else if (num >= 90) {
    ctx.render(<Tag color="orange">{yieldRate}%</Tag>);
  } else {
    ctx.render(<Tag color="red">{yieldRate}%</Tag>);
  }
}
