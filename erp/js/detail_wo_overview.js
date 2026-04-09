const { Card, Row, Col, Statistic, Tag, Space, Steps, Progress, Divider, Typography } = ctx.antd;
const { Text } = Typography;
const {
  wo_no,
  product_name,
  planned_qty,
  completed_qty,
  defect_qty,
  status,
  priority,
  planned_start,
  planned_end,
  actual_start,
  actual_end,
  workshop,
} = ctx.record;

const planned = planned_qty ?? 0;
const completed = completed_qty ?? 0;
const defect = defect_qty ?? 0;
const goodQty = completed - defect;

const completionPct = planned > 0 ? Math.round((completed / planned) * 100) : 0;
const yieldRate = completed > 0 ? ((goodQty / completed) * 100).toFixed(1) : '-';

let progressColor;
if (completionPct >= 100) {
  progressColor = '#52c41a';
} else if (completionPct >= 60) {
  progressColor = '#1890ff';
} else if (completionPct >= 30) {
  progressColor = '#faad14';
} else {
  progressColor = '#ff4d4f';
}

const priorityMap = {
  '紧急': 'red',
  '高': 'orange',
  '普通': 'blue',
  '低': 'gray',
};

const statusColorMap = {
  '待排产': 'default',
  '生产中': 'processing',
  '暂停': 'warning',
  '已完工': 'green',
  '已关闭': 'gray',
};

const stepList = ['待排产', '生产中', '已完工', '已关闭'];
const currentStep = stepList.indexOf(status);
const isPaused = status === '暂停';

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('zh-CN') : '-');

const now = new Date();
const plannedEndDt = planned_end ? new Date(planned_end) : null;
const isOverdue =
  plannedEndDt &&
  !actual_end &&
  now > plannedEndDt &&
  status !== '已完工' &&
  status !== '已关闭';

ctx.render(
  <Card size="small" style={{ marginBottom: 16 }} title="生产工单概览">
    <Row gutter={16} align="middle">
      <Col span={5} style={{ textAlign: 'center' }}>
        <Progress
          type="circle"
          percent={completionPct}
          size={80}
          strokeColor={progressColor}
          format={(pct) => `${pct}%`}
        />
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {completed}/{planned}
          </Text>
        </div>
      </Col>
      <Col span={5}>
        <Statistic
          title="良品率"
          value={yieldRate}
          suffix={yieldRate !== '-' ? '%' : ''}
          valueStyle={{
            color:
              yieldRate !== '-' && parseFloat(yieldRate) >= 98
                ? '#3f8600'
                : yieldRate !== '-' && parseFloat(yieldRate) >= 95
                ? '#d4b106'
                : '#cf1322',
          }}
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
      <Col span={4}>
        <div style={{ marginBottom: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>车间</Text>
        </div>
        <Text>{workshop || '-'}</Text>
      </Col>
    </Row>
    <Divider style={{ margin: '12px 0' }} />
    <Steps
      size="small"
      current={isPaused ? 1 : currentStep >= 0 ? currentStep : 0}
      status={isPaused ? 'error' : isOverdue ? 'error' : 'process'}
      items={stepList.map((s, i) => ({
        title: s,
        description: isPaused && i === 1 ? '⚠ 暂停中' : undefined,
      }))}
    />
    <Divider style={{ margin: '12px 0' }} />
    <Row gutter={16}>
      <Col span={6}>
        <Text type="secondary">计划开始：</Text>
        <Text>{fmtDate(planned_start)}</Text>
      </Col>
      <Col span={6}>
        <Text type="secondary">计划结束：</Text>
        <Text style={isOverdue ? { color: '#ff4d4f', fontWeight: 'bold' } : undefined}>
          {fmtDate(planned_end)}
        </Text>
      </Col>
      <Col span={6}>
        <Text type="secondary">实际开始：</Text>
        <Text>{fmtDate(actual_start)}</Text>
      </Col>
      <Col span={6}>
        <Text type="secondary">实际结束：</Text>
        {isOverdue ? (
          <Text type="danger" strong>逾期</Text>
        ) : (
          <Text>{fmtDate(actual_end)}</Text>
        )}
      </Col>
    </Row>
  </Card>
);
