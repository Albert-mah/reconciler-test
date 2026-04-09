/**
 * SO Delivery countdown to delivery_date
 * @type JSColumnModel
 */
const { Tag } = ctx.antd;
const r = ctx.record;
const delivery = r.delivery_date;
const status = r.status;

if (status === 'Delivered' || status === 'Shipped') {
  ctx.render(<Tag color="green">Completed</Tag>);
} else if (status === 'Cancelled') {
  ctx.render(<Tag color="default">Cancelled</Tag>);
} else if (!delivery) {
  ctx.render(<Tag color="default">-</Tag>);
} else {
  const now = ctx.libs.dayjs();
  const target = ctx.libs.dayjs(delivery);
  const days = target.diff(now, 'day');

  if (days < 0) {
    ctx.render(<Tag color="red">Overdue {Math.abs(days)}d</Tag>);
  } else if (days <= 3) {
    ctx.render(<Tag color="orange">{days}d left</Tag>);
  } else if (days <= 7) {
    ctx.render(<Tag color="blue">{days}d left</Tag>);
  } else {
    ctx.render(<Tag color="green">{days}d left</Tag>);
  }
}
