/**
 * 客户信用状态卡片 — 等级徽章+付款条件+信用额度
 */
const { Card, Row, Col, Statistic, Tag, Space, Progress } = ctx.antd;
const record = ctx.record;

const level = record?.level || '-';
const terms = record?.payment_terms || '-';
const limit = record?.credit_limit ?? 0;

const levelColor = { A: 'gold', B: 'blue', C: 'green', D: 'default' }[level] || 'default';

ctx.render(
  <Card size="small" style={{ marginBottom: 16 }}>
    <Row gutter={24} align="middle">
      <Col span={4}>
        <Space direction="vertical" align="center">
          <span style={{ color: '#999', fontSize: 12 }}>客户等级</span>
          <Tag color={levelColor} style={{ fontSize: 18, padding: '4px 16px' }}>{level}</Tag>
        </Space>
      </Col>
      <Col span={6}>
        <Statistic title="信用额度" value={limit} prefix="¥" precision={0} />
      </Col>
      <Col span={6}>
        <Space direction="vertical">
          <span style={{ color: '#999', fontSize: 12 }}>付款条件</span>
          <Tag>{terms}</Tag>
        </Space>
      </Col>
      <Col span={8}>
        <Space direction="vertical">
          <span style={{ color: '#999', fontSize: 12 }}>联系方式</span>
          <span>{record?.contact} {record?.phone}</span>
        </Space>
      </Col>
    </Row>
  </Card>
);
