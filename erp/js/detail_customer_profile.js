const { Card, Row, Col, Statistic, Tag, Space, Badge, Divider, Typography } = ctx.antd;
const { Text } = Typography;
const {
  level,
  industry,
  payment_terms,
  credit_limit,
  tax_rate,
  contact,
  phone,
  status,
} = ctx.record;

const levelConfig = {
  VIP: { color: 'gold', fontSize: 28 },
  A: { color: 'blue', fontSize: 22 },
  B: { color: 'green', fontSize: 18 },
  C: { color: 'gray', fontSize: 16 },
};
const lv = levelConfig[level] || { color: 'gray', fontSize: 16 };

const statusColorMap = {
  '正常': 'green',
  '停用': 'red',
  '黑名单': 'red',
  '待审核': 'orange',
};

const paymentColorMap = {
  '预付': 'green',
  '月结30天': 'blue',
  '月结60天': 'orange',
  '月结90天': 'red',
};

ctx.render(
  <Card size="small" style={{ marginBottom: 16 }} title="客户画像">
    <Row gutter={16} align="middle">
      <Col span={4} style={{ textAlign: 'center' }}>
        <Badge
          color={lv.color}
          text={
            <span style={{ fontSize: lv.fontSize, fontWeight: 'bold', color: lv.color }}>
              {level || '-'}
            </span>
          }
        />
      </Col>
      <Col span={5}>
        <Statistic
          title="信用额度"
          value={credit_limit ?? 0}
          precision={0}
          prefix="¥"
        />
      </Col>
      <Col span={4}>
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>付款条件</Text>
        </div>
        <Tag color={paymentColorMap[payment_terms] || 'default'}>
          {payment_terms || '-'}
        </Tag>
      </Col>
      <Col span={4}>
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>行业</Text>
        </div>
        <Tag color="purple">{industry || '-'}</Tag>
      </Col>
      <Col span={3}>
        <Statistic title="税率" value={tax_rate ?? 0} suffix="%" precision={1} />
      </Col>
      <Col span={4}>
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>状态</Text>
        </div>
        <Tag color={statusColorMap[status] || 'default'}>{status || '-'}</Tag>
      </Col>
    </Row>
    <Divider style={{ margin: '12px 0' }} />
    <Space size={24}>
      <Text><Text type="secondary">联系人：</Text>{contact || '-'}</Text>
      <Text><Text type="secondary">电话：</Text>{phone || '-'}</Text>
    </Space>
  </Card>
);
