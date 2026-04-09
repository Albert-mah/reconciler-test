/**
 * Estimated vs Actual Hours — comparison with color coding
 * @type JSColumnModel
 */
const { Tag } = ctx.antd;
const r = ctx.record;
const estimated = Number(r.estimated_hours) || 0;
const actual = Number(r.actual_hours) || 0;

if (actual > estimated && estimated > 0) {
  ctx.render(<Tag color="red">{actual.toFixed(1)} / {estimated.toFixed(1)} h</Tag>);
} else if (actual > 0) {
  ctx.render(<Tag color="green">{actual.toFixed(1)} / {estimated.toFixed(1)} h</Tag>);
} else {
  ctx.render(<Tag color="gray">0 / {estimated.toFixed(1)} h</Tag>);
}
