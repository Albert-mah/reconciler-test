/**
 * Stock Status Tag — stock_qty vs min_stock
 * @type JSColumnModel
 */
const { Tag } = ctx.antd;
const r = ctx.record;
const stock = r.stock_qty || 0;
const min = r.min_stock || 0;
const max = r.max_stock || Infinity;

if (stock <= 0) {
  ctx.render(<Tag color="red">Out of Stock</Tag>);
} else if (stock < min) {
  ctx.render(<Tag color="orange">Low ({stock}/{min})</Tag>);
} else if (stock > max && max > 0) {
  ctx.render(<Tag color="blue">Overstock ({stock})</Tag>);
} else {
  ctx.render(<Tag color="green">Normal ({stock})</Tag>);
}
