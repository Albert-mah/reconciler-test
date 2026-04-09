/**
 * Customer Profile KPI — level badge + credit + payment terms
 * @type JSItemModel
 */
const { Card, Row, Col, Statistic, Badge, Tag, Space } = ctx.antd;
const r = ctx.record;

const level = r.level || '-';
const credit = parseFloat(r.credit_limit) || 0;
const taxRate = parseFloat(r.tax_rate) || 0;
const payment = r.payment_terms || '-';
const status = r.status || '-';

const levelColors = { VIP: '#722ed1', A: '#1677ff', B: '#52c41a', C: '#faad14' };
const statusColors = { Active: 'green', Suspended: 'orange', Blocked: 'red' };
const fmtCredit = credit >= 1e6 ? `$${(credit/1e6).toFixed(1)}M` : credit >= 1e3 ? `$${(credit/1e3).toFixed(0)}K` : `$${credit.toFixed(0)}`;

ctx.render(
  <Card size="small" style={{ marginBottom: 12 }}>
    <Row gutter={16} align="middle">
      <Col span={6}>
        <Space direction="vertical" size={2} align="center" style={{ width: '100%' }}>
          <div style={{
            width: 48, height: 48, borderRadius: '50%',
            background: levelColors[level] || '#999',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 18
          }}>
            {level}
          </div>
          <Tag color={statusColors[status] || 'default'}>{status}</Tag>
        </Space>
      </Col>
      <Col span={6}>
        <Statistic
          title="Credit Limit"
          value={fmtCredit}
          valueStyle={{ fontSize: 18, color: levelColors[level] }}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="Tax Rate"
          value={taxRate}
          suffix="%"
          valueStyle={{ fontSize: 18 }}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="Payment Terms"
          value={payment}
          valueStyle={{ fontSize: 16 }}
        />
      </Col>
    </Row>
  </Card>
);
