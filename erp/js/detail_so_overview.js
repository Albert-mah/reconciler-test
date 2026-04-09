/**
 * Sales Order Overview KPI — amount + status steps + delivery countdown
 * @type JSItemModel
 */
const { Card, Row, Col, Statistic, Steps, Tag, Space } = ctx.antd;
const r = ctx.record;

const total = parseFloat(r.total_amount) || 0;
const tax = parseFloat(r.tax_amount) || 0;
const grand = total + tax;
const status = r.status || 'Draft';
const delivery = r.delivery_date;

const fmtAmt = (v) => v >= 1e6 ? `$${(v/1e6).toFixed(2)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(1)}K` : `$${v.toFixed(2)}`;

const flow = ['Draft', 'Confirmed', 'In Production', 'Ready to Ship', 'Shipped', 'Delivered'];
const currentIdx = flow.indexOf(status);

let daysLeft = null;
let daysColor = '#52c41a';
if (delivery && status !== 'Delivered' && status !== 'Shipped' && status !== 'Cancelled') {
  const now = ctx.libs.dayjs();
  const target = ctx.libs.dayjs(delivery);
  daysLeft = target.diff(now, 'day');
  daysColor = daysLeft < 0 ? '#ff4d4f' : daysLeft <= 3 ? '#faad14' : daysLeft <= 7 ? '#1677ff' : '#52c41a';
}

ctx.render(
  <Card size="small" style={{ marginBottom: 12 }}>
    <Row gutter={16}>
      <Col span={8}>
        <Statistic
          title="Grand Total"
          value={fmtAmt(grand)}
          valueStyle={{ fontSize: 22, fontWeight: 700, color: '#1677ff' }}
        />
        <div style={{ color: '#999', fontSize: 11, marginTop: 2 }}>
          Subtotal: {fmtAmt(total)} + Tax: {fmtAmt(tax)}
        </div>
      </Col>
      <Col span={8}>
        {status === 'Cancelled' ? (
          <Tag color="red" style={{ fontSize: 14, padding: '4px 12px' }}>Cancelled</Tag>
        ) : (
          <Steps
            size="small"
            current={currentIdx >= 0 ? currentIdx : 0}
            items={flow.map(s => ({ title: s === status ? s : '' }))}
            direction="vertical"
            style={{ maxHeight: 120 }}
          />
        )}
      </Col>
      <Col span={8}>
        {daysLeft !== null ? (
          <Statistic
            title="Delivery"
            value={daysLeft < 0 ? `Overdue ${Math.abs(daysLeft)}d` : `${daysLeft}d left`}
            valueStyle={{ fontSize: 18, color: daysColor }}
          />
        ) : (
          <Statistic title="Delivery" value={status === 'Delivered' ? 'Complete' : '-'} valueStyle={{ fontSize: 16 }} />
        )}
      </Col>
    </Row>
  </Card>
);
