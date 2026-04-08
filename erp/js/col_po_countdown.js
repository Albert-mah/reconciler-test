/**
 * 到货倒计时 — 距离 expected_date 天数
 */
const { Tag } = ctx.antd;
const record = ctx.record;
const status = record?.status || '';
const expected = record?.expected_date;

if (status === '已入库') {
  ctx.render(<Tag color="green">✓ 已入库</Tag>);
} else if (status === '已取消') {
  ctx.render(<Tag>已取消</Tag>);
} else if (!expected) {
  ctx.render(<Tag color="default">待定</Tag>);
} else {
  const now = new Date();
  const target = new Date(expected);
  const diff = Math.ceil((target - now) / (1000 * 60 * 60 * 24));

  let color, text;
  if (diff < 0) {
    color = 'red'; text = `逾期 ${Math.abs(diff)} 天`;
  } else if (diff <= 3) {
    color = 'orange'; text = `${diff} 天`;
  } else {
    color = 'blue'; text = `${diff} 天`;
  }
  ctx.render(<Tag color={color}>{text}</Tag>);
}
