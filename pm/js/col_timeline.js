/**
 * Project Timeline Countdown — days remaining with color coding
 * @type JSColumnModel
 */
const { Tag } = ctx.antd;
const r = ctx.record;
const dayjs = ctx.libs.dayjs;
const status = r.status;
const endDate = r.end_date;

if (status === 'Completed' || status === 'Cancelled') {
  ctx.render(<Tag color="gray">{status}</Tag>);
} else if (!endDate) {
  ctx.render(<Tag color="gray">No End Date</Tag>);
} else {
  const now = dayjs();
  const end = dayjs(endDate);
  const days = end.diff(now, 'day');

  if (days < 0) {
    ctx.render(<Tag color="red">Overdue by {Math.abs(days)} days</Tag>);
  } else if (days <= 7) {
    ctx.render(<Tag color="orange">{days} days left</Tag>);
  } else if (days <= 30) {
    ctx.render(<Tag color="blue">{days} days left</Tag>);
  } else {
    ctx.render(<Tag color="green">{days} days left</Tag>);
  }
}
