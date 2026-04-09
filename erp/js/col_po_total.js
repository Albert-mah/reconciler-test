/**
 * PO Total + Tax formatted
 * @type JSColumnModel
 */
const { Space } = ctx.antd;
const r = ctx.record;
const total = parseFloat(r.total_amount) || 0;
const tax = parseFloat(r.tax_amount) || 0;
const grand = total + tax;

const fmt = (v) => v >= 1e6 ? `$${(v/1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(1)}K` : `$${v.toFixed(2)}`;

ctx.render(
  <Space direction="vertical" size={0}>
    <span style={{ fontWeight: 600, fontSize: 14 }}>{fmt(grand)}</span>
    <span style={{ color: '#999', fontSize: 11 }}>Tax: {fmt(tax)}</span>
  </Space>
);
