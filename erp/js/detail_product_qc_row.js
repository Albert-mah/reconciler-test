/**
 * 质检行卡片
 * @type JSItemModel
 * @collection nb_erp_quality
 * @fields qc_type, result, pass_qty, sample_qty, batch_no
 */
const { Tag, Space, Badge, Typography } = ctx.antd;
const { Text } = Typography;
const { qc_type, result, pass_qty, sample_qty, batch_no } = ctx.record;

const qcTypeColorMap = {
  '来料检': 'blue',
  '过程检': 'orange',
  '成品检': 'green',
  '出货检': 'purple',
};

const resultColorMap = {
  '合格': 'green',
  '不合格': 'red',
  '让步接收': 'orange',
  '待判定': 'gray',
};

const passNum = pass_qty ?? 0;
const sampleNum = sample_qty ?? 0;
const ratio = sampleNum > 0 ? ((passNum / sampleNum) * 100).toFixed(1) : '-';
const ratioColor =
  ratio === '-' ? undefined
  : parseFloat(ratio) >= 98 ? '#3f8600'
  : parseFloat(ratio) >= 90 ? '#d4b106'
  : '#cf1322';

const resultColor = resultColorMap[result] || 'gray';

ctx.render(
  <Space size="middle" align="center" style={{ width: '100%' }}>
    <Tag color={qcTypeColorMap[qc_type] || 'default'}>{qc_type || '-'}</Tag>
    <Badge
      color={resultColor}
      text={
        <Text strong style={{ color: resultColor === 'gray' ? '#999' : resultColor, fontSize: 14 }}>
          {result || '-'}
        </Text>
      }
    />
    <Text style={{ color: ratioColor, minWidth: 80 }}>
      {passNum}/{sampleNum}
      {ratio !== '-' && <Text type="secondary" style={{ fontSize: 12 }}> ({ratio}%)</Text>}
    </Text>
    <Text type="secondary" style={{ fontSize: 13 }}>{batch_no || '-'}</Text>
  </Space>
);
