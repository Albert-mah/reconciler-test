/**
 * Credit Level Badge + formatted limit
 * @type JSColumnModel
 */
const { Badge, Space } = ctx.antd;
const r = ctx.record;
const level = r.level || '-';
const limit = parseFloat(r.credit_limit) || 0;

const colorMap = { VIP: '#722ed1', A: '#1677ff', B: '#52c41a', C: '#faad14' };
const color = colorMap[level] || '#999';
const formatted = limit >= 1e6 ? `$${(limit/1e6).toFixed(1)}M` : limit >= 1e3 ? `$${(limit/1e3).toFixed(0)}K` : `$${limit.toFixed(0)}`;

ctx.render(
  <Space size={4}>
    <Badge color={color} text={level} />
    <span style={{ color: '#666', fontSize: 12 }}>{formatted}</span>
  </Space>
);
