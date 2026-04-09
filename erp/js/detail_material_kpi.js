/**
 * Material Detail KPI — price/cost/margin/stock metrics
 * @type JSItemModel
 */
const { Card, Row, Col, Statistic, Tag, Space } = ctx.antd;
const r = ctx.record;

const listPrice = parseFloat(r.list_price) || 0;
const costPrice = parseFloat(r.cost_price) || 0;
const margin = listPrice > 0 ? ((listPrice - costPrice) / listPrice * 100).toFixed(1) : 0;
const stock = parseInt(r.stock_qty) || 0;
const minStock = parseInt(r.min_stock) || 0;
const leadTime = parseInt(r.lead_time) || 0;

const marginColor = margin >= 30 ? '#52c41a' : margin >= 15 ? '#1677ff' : margin >= 0 ? '#faad14' : '#ff4d4f';
const stockColor = stock <= 0 ? '#ff4d4f' : stock < minStock ? '#faad14' : '#52c41a';
const stockLabel = stock <= 0 ? 'Out of Stock' : stock < minStock ? 'Low Stock' : 'Normal';

ctx.render(
  <Card size="small" style={{ marginBottom: 12 }}>
    <Row gutter={16}>
      <Col span={6}>
        <Statistic
          title="List Price"
          value={listPrice}
          precision={2}
          prefix="$"
          valueStyle={{ fontSize: 18 }}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="Cost Price"
          value={costPrice}
          precision={2}
          prefix="$"
          valueStyle={{ fontSize: 18 }}
        />
      </Col>
      <Col span={6}>
        <Statistic
          title="Margin"
          value={margin}
          suffix="%"
          valueStyle={{ fontSize: 18, color: marginColor }}
        />
      </Col>
      <Col span={6}>
        <Space direction="vertical" size={0}>
          <Statistic
            title="Stock"
            value={stock}
            valueStyle={{ fontSize: 18, color: stockColor }}
          />
          <Tag color={stockColor} style={{ marginTop: 2 }}>{stockLabel}</Tag>
        </Space>
      </Col>
    </Row>
    {leadTime > 0 && (
      <div style={{ marginTop: 8, color: '#999', fontSize: 12 }}>
        Lead Time: {leadTime} days
      </div>
    )}
  </Card>
);
