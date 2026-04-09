/**
 * 销售订单行卡片
 * @type JSItemModel
 * @collection nb_erp_sales_orders
 * @fields so_no, total_amount, status, delivery_date, priority
 */
const { Tag, Space, Typography } = ctx.antd;
const { Text } = Typography;
const { so_no, total_amount, status, delivery_date, priority } = ctx.record;

const statusColorMap = {
  '草稿': 'default',
  '已确认': 'processing',
  '生产中': 'blue',
  '待发货': 'orange',
  '已发货': 'cyan',
  '已签收': 'green',
  '已取消': 'red',
};

const priorityMap = {
  '紧急': 'red',
  '高': 'orange',
  '普通': 'blue',
  '低': 'gray',
};

const deliveryCountdown = (d) => {
  if (!d) return null;
  const now = new Date();
  const dt = new Date(d);
  const diffMs = dt - now;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) {
    return { text: `逾期${Math.abs(diffDays)}天`, color: '#cf1322' };
  }
  if (diffDays === 0) {
    return { text: '今天到期', color: '#fa8c16' };
  }
  if (diffDays <= 3) {
    return { text: `${diffDays}天后`, color: '#fa8c16' };
  }
  return { text: `${diffDays}天后`, color: '#999' };
};

const finishedStatuses = ['已发货', '已签收', '已取消'];
const countdown = !finishedStatuses.includes(status) ? deliveryCountdown(delivery_date) : null;
const amount = total_amount ?? 0;

ctx.render(
  <Space size="middle" align="center" style={{ width: '100%' }}>
    <Text strong style={{ fontSize: 14 }}>{so_no || '-'}</Text>
    <Text style={{ color: '#1890ff' }}>¥{amount.toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</Text>
    <Tag color={statusColorMap[status] || 'default'}>{status || '-'}</Tag>
    {priority && (priorityMap[priority] === 'red' || priorityMap[priority] === 'orange') && (
      <Tag color={priorityMap[priority]}>{priority}</Tag>
    )}
    {countdown && (
      <Text style={{ color: countdown.color, fontSize: 12 }}>{countdown.text}</Text>
    )}
  </Space>
);
