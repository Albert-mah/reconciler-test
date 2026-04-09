const { Card, Row, Col, Statistic, Tag, Space, Steps, Divider, Typography } = ctx.antd;
const { Text } = Typography;
const {
  so_no,
  customer_name,
  total_amount,
  tax_amount,
  status,
  priority,
  order_date,
  delivery_date,
  shipped_date,
} = ctx.record;

const total = (total_amount ?? 0) + (tax_amount ?? 0);

const priorityMap = {
  '紧急': 'red',
  '高': 'orange',
  '普通': 'blue',
  '低': 'gray',
};

const statusColorMap = {
  '草稿': 'default',
  '已确认': 'processing',
  '生产中': 'blue',
  '待发货': 'orange',
  '已发货': 'cyan',
  '已签收': 'green',
};

const stepList = ['草稿', '已确认', '生产中', '待发货', '已发货', '已签收'];
const currentStep = stepList.indexOf(status);

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('zh-CN') : '-');

const now = new Date();
const deliveryDt = delivery_date ? new Date(delivery_date) : null;
const shippedDt = shipped_date ? new Date(shipped_date) : null;
const isOverdue =
  deliveryDt &&
  !shippedDt &&
  now > deliveryDt &&
  currentStep >= 0 &&
  currentStep < 4;

ctx.render(
  <Card size="small" style={{ marginBottom: 16 }} title="销售单概览">
    <Row gutter={16} align="middle">
      <Col span={8}>
        <Statistic
          title="合计金额（含税）"
          value={total}
          precision={2}
          prefix="¥"
        />
      </Col>
      <Col span={4}>
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>优先级</Text>
        </div>
        <Tag color={priorityMap[priority] || 'default'}>{priority || '-'}</Tag>
      </Col>
      <Col span={4}>
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>状态</Text>
        </div>
        <Tag color={statusColorMap[status] || 'default'}>{status || '-'}</Tag>
      </Col>
    </Row>
    <Divider style={{ margin: '12px 0' }} />
    <Steps
      size="small"
      current={currentStep >= 0 ? currentStep : 0}
      status={isOverdue ? 'error' : 'process'}
      items={stepList.map((s) => ({ title: s }))}
    />
    <Divider style={{ margin: '12px 0' }} />
    <Row gutter={16}>
      <Col span={8}>
        <Text type="secondary">下单日期：</Text>
        <Text>{fmtDate(order_date)}</Text>
      </Col>
      <Col span={8}>
        <Text type="secondary">交货日期：</Text>
        <Text>{fmtDate(delivery_date)}</Text>
      </Col>
      <Col span={8}>
        <Text type="secondary">发货日期：</Text>
        {isOverdue ? (
          <Text type="danger" strong>逾期未发货</Text>
        ) : (
          <Text>{fmtDate(shipped_date)}</Text>
        )}
      </Col>
    </Row>
  </Card>
);
