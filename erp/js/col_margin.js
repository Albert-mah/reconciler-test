/**
 * Profit Margin Tag — (list_price - cost_price) / list_price
 * @type JSColumnModel
 */
const { Tag } = ctx.antd;
const r = ctx.record;
const list = parseFloat(r.list_price) || 0;
const cost = parseFloat(r.cost_price) || 0;

if (list <= 0) {
  ctx.render(<Tag color="default">N/A</Tag>);
} else {
  const margin = ((list - cost) / list * 100).toFixed(1);
  const num = parseFloat(margin);
  if (num >= 30) {
    ctx.render(<Tag color="green">{margin}%</Tag>);
  } else if (num >= 15) {
    ctx.render(<Tag color="blue">{margin}%</Tag>);
  } else if (num >= 0) {
    ctx.render(<Tag color="orange">{margin}%</Tag>);
  } else {
    ctx.render(<Tag color="red">{margin}%</Tag>);
  }
}
