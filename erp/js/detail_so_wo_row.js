/**
 * 生产工单行卡片
 * @type JSItemModel
 * @collection nb_erp_work_orders
 * @fields wo_no, product_name, completed_qty, planned_qty, defect_qty, status
 */
const { Tag, Space, Progress, Typography } = ctx.antd;
const { Text } = Typography;
const { wo_no, product_name, completed_qty, planned_qty, defect_qty, status } = ctx.record;

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

let yieldColor;
if (yieldRate === '-') {
  yieldColor = 'default';
} else if (parseFloat(yieldRate) >= 98) {
  yieldColor = 'green';
} else if (parseFloat(yieldRate) >= 95) {
  yieldColor = 'orange';
} else {
  yieldColor = 'red';
}

const statusColorMap = {
  '待排产': 'default',
  '生产中': 'processing',
  '暂停': 'warning',
  '已完工': 'green',
  '已关闭': 'gray',
};

ctx.render(
  <Space size="middle" align="center" style={{ width: '100%' }}>
    <Text strong style={{ fontSize: 14 }}>{wo_no || '-'}</Text>
    <Text type="secondary" style={{ fontSize: 13 }}>{product_name || '-'}</Text>
    <div style={{ display: 'inline-flex', alignItems: 'center', minWidth: 140 }}>
      <Progress
        percent={completionPct}
        size="small"
        strokeColor={progressColor}
        style={{ width: 100, margin: 0 }}
      />
      <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>
        {completed}/{planned}
      </Text>
    </div>
    <Tag color={yieldColor}>
      良率 {yieldRate !== '-' ? `${yieldRate}%` : 'N/A'}
    </Tag>
    <Tag color={statusColorMap[status] || 'default'}>{status || '-'}</Tag>
  </Space>
);
