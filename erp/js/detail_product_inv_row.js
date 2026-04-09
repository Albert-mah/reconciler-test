/**
 * 库存流水行卡片
 * @type JSItemModel
 * @collection nb_erp_inventory
 * @fields txn_type, qty, warehouse, ref_no, createdAt
 */
const { Tag, Space, Typography } = ctx.antd;
const { Text } = Typography;
const { txn_type, qty, warehouse, ref_no, createdAt } = ctx.record;

const inbound = ['采购入库', '生产入库', '退货入库', '盘盈'];
const outbound = ['销售出库', '生产领料', '盘亏'];
const transfer = ['调拨'];

let txnColor, sign;
if (inbound.includes(txn_type)) {
  txnColor = 'green';
  sign = '+';
} else if (outbound.includes(txn_type)) {
  txnColor = 'red';
  sign = '-';
} else if (transfer.includes(txn_type)) {
  txnColor = 'blue';
  sign = '±';
} else {
  txnColor = 'default';
  sign = '';
}

const relativeDate = (d) => {
  if (!d) return '-';
  const now = new Date();
  const dt = new Date(d);
  const diffMs = now - dt;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}小时前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}天前`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}个月前`;
  return `${Math.floor(diffMonth / 12)}年前`;
};

const qtyNum = qty ?? 0;
const qtyColor = sign === '+' ? '#3f8600' : sign === '-' ? '#cf1322' : '#1890ff';

ctx.render(
  <Space size="middle" align="center" style={{ width: '100%' }}>
    <Tag color={txnColor}>{txn_type || '-'}</Tag>
    <Text strong style={{ color: qtyColor, minWidth: 60 }}>
      {sign}{Math.abs(qtyNum)}
    </Text>
    <Tag color="cyan">{warehouse || '-'}</Tag>
    <Text type="secondary" style={{ fontSize: 13 }}>{ref_no || '-'}</Text>
    <Text type="secondary" style={{ fontSize: 12 }}>{relativeDate(createdAt)}</Text>
  </Space>
);
