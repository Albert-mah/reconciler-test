/**
 * Task Priority Tag — colored by priority level
 * @type JSColumnModel
 */
const { Tag } = ctx.antd;
const r = ctx.record;
const priority = r.priority;

if (priority === 'Critical') {
  ctx.render(<Tag color="red">Critical</Tag>);
} else if (priority === 'High') {
  ctx.render(<Tag color="orange">High</Tag>);
} else if (priority === 'Medium') {
  ctx.render(<Tag color="blue">Medium</Tag>);
} else if (priority === 'Low') {
  ctx.render(<Tag>Low</Tag>);
} else {
  ctx.render(<span />);
}
