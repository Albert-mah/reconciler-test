/**
 * Billable Indicator — Yes/No tag
 * @type JSColumnModel
 */
const { Tag } = ctx.antd;
const r = ctx.record;
const billable = r.billable;

if (billable === 'Yes') {
  ctx.render(<Tag color="green">Billable</Tag>);
} else if (billable === 'No') {
  ctx.render(<Tag>Non-billable</Tag>);
} else {
  ctx.render(<span />);
}
