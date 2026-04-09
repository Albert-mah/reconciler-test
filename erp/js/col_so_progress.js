/**
 * SO Status Flow as Steps component
 * @type JSColumnModel
 */
const { Steps } = ctx.antd;
const r = ctx.record;
const status = r.status || 'Draft';

const flow = ['Draft', 'Confirmed', 'In Production', 'Ready to Ship', 'Shipped', 'Delivered'];
const currentIdx = flow.indexOf(status);

if (status === 'Cancelled') {
  ctx.render(<span style={{ color: '#ff4d4f', fontWeight: 500 }}>Cancelled</span>);
} else if (status === 'Partially Shipped') {
  ctx.render(
    <Steps
      size="small"
      current={4}
      status="process"
      items={flow.map((s, i) => ({ title: i === 4 ? 'Partial' : '' }))}
      style={{ maxWidth: 280 }}
    />
  );
} else {
  ctx.render(
    <Steps
      size="small"
      current={currentIdx >= 0 ? currentIdx : 0}
      items={flow.map(() => ({ title: '' }))}
      style={{ maxWidth: 280 }}
    />
  );
}
