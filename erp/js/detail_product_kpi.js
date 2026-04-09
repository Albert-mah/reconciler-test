const { Card, Row, Col, Statistic, Tag, Space, Divider } = ctx.antd;
const {
  standard_price,
  cost_price,
  stock_qty,
  min_stock,
  max_stock,
  lead_time,
  status,
  category,
} = ctx.record;

const stdPrice = standard_price ?? 0;
const costPrice = cost_price ?? 0;
const profitRate = stdPrice > 0 ? ((stdPrice - costPrice) / stdPrice) * 100 : 0;
const qty = stock_qty ?? 0;
const minQty = min_stock ?? 0;

const profitColor = profitRate >= 30 ? '#3f8600' : profitRate >= 15 ? '#d4b106' : '#cf1322';

let stockColor;
if (qty <= 0) {
  stockColor = '#cf1322';
} else if (qty < minQty) {
  stockColor = '#cf1322';
} else if (qty < minQty * 2) {
  stockColor = '#d4b106';
} else {
  stockColor = '#3f8600';
}

const statusColorMap = {
  '启用': 'green',
  '停用': 'red',
  '待审核': 'orange',
};

ctx.render(
  <Card size="small" style={{ marginBottom: 16 }} title="物料概览">
    <Row gutter={16}>
      <Col span={4}>
        <Statistic title="标准价" value={stdPrice} precision={2} prefix="¥" />
      </Col>
      <Col span={4}>
        <Statistic title="成本价" value={costPrice} precision={2} prefix="¥" />
      </Col>
      <Col span={4}>
        <Statistic
          title="利润率"
          value={profitRate}
          precision={1}
          suffix="%"
          valueStyle={{ color: profitColor }}
        />
      </Col>
      <Col span={4}>
        <Statistic
          title="库存数量"
          value={qty}
          valueStyle={{ color: stockColor }}
        />
      </Col>
      <Col span={4}>
        <Statistic title="安全库存" value={minQty} />
      </Col>
      <Col span={4}>
        <Statistic title="采购周期" value={lead_time ?? '-'} suffix="天" />
      </Col>
    </Row>
    <Divider style={{ margin: '12px 0' }} />
    <Space size={12}>
      <Tag color={statusColorMap[status] || 'default'}>{status || '-'}</Tag>
      <Tag color="blue">{category || '-'}</Tag>
    </Space>
  </Card>
);
