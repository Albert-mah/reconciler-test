/**
 * 产品概览卡片 — KPI 展示
 */
const { Card, Row, Col, Statistic, Tag, Space } = ctx.antd;
const record = ctx.record;

const price = record?.price ?? 0;
const cost = record?.cost ?? 0;
const qty = record?.stock_qty ?? 0;
const min = record?.min_stock ?? 0;
const rate = price ? ((price - cost) / price * 100).toFixed(1) : 0;
const status = record?.status || '';

const stockColor = qty <= 0 ? '#ff4d4f' : qty < min ? '#faad14' : '#52c41a';
const rateColor = rate < 10 ? '#ff4d4f' : rate < 20 ? '#faad14' : '#52c41a';

ctx.render(
  <Card size="small" style={{ marginBottom: 16 }}>
    <Row gutter={24}>
      <Col span={4}>
        <Statistic title="标准价格" value={price} prefix="¥" precision={2} />
      </Col>
      <Col span={4}>
        <Statistic title="成本价" value={cost} prefix="¥" precision={2} />
      </Col>
      <Col span={4}>
        <Statistic title="利润率" value={rate} suffix="%" valueStyle={{ color: rateColor }} />
      </Col>
      <Col span={4}>
        <Statistic title="库存数量" value={qty} valueStyle={{ color: stockColor }} />
      </Col>
      <Col span={4}>
        <Statistic title="安全库存" value={min} />
      </Col>
      <Col span={4}>
        <Space direction="vertical" align="center">
          <span style={{ color: '#999', fontSize: 12 }}>状态</span>
          <Tag color={status === '在售' ? 'green' : status === '开发中' ? 'blue' : 'default'}>{status}</Tag>
        </Space>
      </Col>
    </Row>
  </Card>
);
