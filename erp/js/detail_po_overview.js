const { Card, Row, Col, Statistic, Tag, Space, Steps, Divider, Typography } = ctx.antd;
const { Text } = Typography;
const {
  po_no,
  supplier_name,
  total_amount,
  tax_amount,
  status,
  priority,
  order_date,
  expected_date,
  actual_date,
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
  '待审批': 'processing',
  '已审批': 'blue',
  '到货': 'green',
  '关闭': 'gray',
};

const stepList = ['草稿', '待审批', '已审批', '到货', '关闭'];
const currentStep = stepList.indexOf(status);

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('zh-CN') : '-');

const now = new Date();
const expectedDt = expected_date ? new Date(expected_date) : null;
const actualDt = actual_date ? new Date(actual_date) : null;
const isOverdue =
  expectedDt &&
  !actualDt &&
  now > expectedDt &&
  currentStep >= 0 &&
  currentStep < 3;

ctx.render(
  <Card size="small" style={{ marginBottom: 16 }} title="采购单概览">
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
        <Text type="secondary">预计到货：</Text>
        <Text>{fmtDate(expected_date)}</Text>
      </Col>
      <Col span={8}>
        <Text type="secondary">实际到货：</Text>
        {isOverdue ? (
          <Text type="danger" strong>逾期未到货</Text>
        ) : (
          <Text>{fmtDate(actual_date)}</Text>
        )}
      </Col>
    </Row>
  </Card>
);
