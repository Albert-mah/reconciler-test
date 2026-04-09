/**
 * QC Pass Rate Tag
 * @type JSColumnModel
 */
const { Tag } = ctx.antd;
const r = ctx.record;
const pass = parseInt(r.pass_qty) || 0;
const sample = parseInt(r.sample_qty) || 0;

if (sample <= 0) {
  ctx.render(<Tag color="default">-</Tag>);
} else {
  const rate = (pass / sample * 100).toFixed(1);
  const num = parseFloat(rate);
  if (num >= 98) {
    ctx.render(<Tag color="green">{rate}%</Tag>);
  } else if (num >= 95) {
    ctx.render(<Tag color="blue">{rate}%</Tag>);
  } else if (num >= 90) {
    ctx.render(<Tag color="orange">{rate}%</Tag>);
  } else {
    ctx.render(<Tag color="red">{rate}%</Tag>);
  }
}
