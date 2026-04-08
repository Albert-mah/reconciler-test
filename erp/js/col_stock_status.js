/**
 * 库存预警标签 — stock_qty vs min_stock
 */
const { Tag } = ctx.antd;
const record = ctx.record;
const qty = record?.stock_qty ?? 0;
const min = record?.min_stock ?? 0;

let color, text;
if (qty <= 0) {
  color = 'red'; text = '缺货';
} else if (qty < min) {
  color = 'red'; text = '低于安全库存';
} else if (qty < min * 2) {
  color = 'orange'; text = '库存偏低';
} else {
  color = 'green'; text = '充足';
}

ctx.render(<Tag color={color}>{text} ({qty})</Tag>);
