/**
 * Work Order Overview KPI — progress circle + yield + dates
 * @type JSItemModel
 */
const { Card, Row, Col, Statistic, Progress, Tag, Space } = ctx.antd;
const r = ctx.record;

const planned = parseInt(r.planned_qty) || 0;
const completed = parseInt(r.completed_qty) || 0;
const defect = parseInt(r.defect_qty) || 0;
const total = completed + defect;
const completionPct = planned > 0 ? Math.round(completed / planned * 100) : 0;
const yieldPct = total > 0 ? (completed / total * 100).toFixed(1) : '0.0';
const status = r.status || 'Scheduled';

const plannedStart = r.planned_start;
const plannedEnd = r.planned_end;
const actualStart = r.actual_start;
const actualEnd = r.actual_end;

let scheduleTag = null;
if (plannedEnd && !actualEnd && status !== 'Completed' && status !== 'Closed') {
  const now = ctx.libs.dayjs();
  const end = ctx.libs.dayjs(plannedEnd);
  const diff = end.diff(now, 'day');
  if (diff < 0) {
    scheduleTag = <Tag color="red">Behind {Math.abs(diff)}d</Tag>;
  } else if (diff <= 2) {
    scheduleTag = <Tag color="orange">Due in {diff}d</Tag>;
  } else {
    scheduleTag = <Tag color="green">On track</Tag>;
  }
} else if (actualEnd && plannedEnd) {
  const actual = ctx.libs.dayjs(actualEnd);
  const planned_ = ctx.libs.dayjs(plannedEnd);
  const diff = actual.diff(planned_, 'day');
  if (diff > 0) {
    scheduleTag = <Tag color="orange">Finished {diff}d late</Tag>;
  } else {
    scheduleTag = <Tag color="green">On time</Tag>;
  }
}

const yieldColor = parseFloat(yieldPct) >= 98 ? '#52c41a' : parseFloat(yieldPct) >= 95 ? '#1677ff' : parseFloat(yieldPct) >= 90 ? '#faad14' : '#ff4d4f';

ctx.render(
  <Card size="small" style={{ marginBottom: 12 }}>
    <Row gutter={16} align="middle">
      <Col span={6} style={{ textAlign: 'center' }}>
        <Progress
          type="circle"
          percent={Math.min(completionPct, 100)}
          size={80}
          format={() => `${completed}/${planned}`}
          strokeColor={completionPct >= 100 ? '#52c41a' : '#1677ff'}
        />
        <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>Completion</div>
      </Col>
      <Col span={6}>
        <Statistic
          title="Yield Rate"
          value={yieldPct}
          suffix="%"
          valueStyle={{ fontSize: 22, color: yieldColor }}
        />
        <div style={{ color: '#999', fontSize: 11 }}>Defects: {defect}</div>
      </Col>
      <Col span={6}>
        <Space direction="vertical" size={2}>
          <Statistic title="Status" value={status} valueStyle={{ fontSize: 16 }} />
          {scheduleTag}
        </Space>
      </Col>
      <Col span={6}>
        <Space direction="vertical" size={2}>
          <div style={{ fontSize: 12, color: '#999' }}>
            Plan: {plannedStart ? ctx.libs.dayjs(plannedStart).format('MM/DD') : '-'} ~ {plannedEnd ? ctx.libs.dayjs(plannedEnd).format('MM/DD') : '-'}
          </div>
          <div style={{ fontSize: 12, color: '#666' }}>
            Actual: {actualStart ? ctx.libs.dayjs(actualStart).format('MM/DD') : '-'} ~ {actualEnd ? ctx.libs.dayjs(actualEnd).format('MM/DD') : '-'}
          </div>
        </Space>
      </Col>
    </Row>
  </Card>
);
