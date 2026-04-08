/**
 * 利润率百分比 — (price-cost)/price
 */
const { Tag, Typography } = ctx.antd;
const record = ctx.record;
const price = record?.price ?? 0;
const cost = record?.cost ?? 0;

if (!price) {
  ctx.render(<Typography.Text type="secondary">-</Typography.Text>);
} else {
  const rate = ((price - cost) / price * 100).toFixed(1);
  let color;
  if (rate < 10) color = 'red';
  else if (rate < 20) color = 'orange';
  else color = 'green';

  ctx.render(<Tag color={color}>{rate}%</Tag>);
}
