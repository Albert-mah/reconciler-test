const { Card, Row, Col, Statistic, Tag, Space, Progress, Badge, Divider, Typography } = ctx.antd;
const { Text } = Typography;
const {
  qc_no,
  product_name,
  qc_type,
  batch_no,
  sample_qty,
  pass_qty,
  fail_qty,
  result,
  inspector,
} = ctx.record;

const sample = sample_qty ?? 0;
const pass = pass_qty ?? 0;
const fail = fail_qty ?? 0;
const passRate = sample > 0 ? Math.round((pass / sample) * 100) : 0;

const resultConfig = {
  '合格': { color: '#52c41a', bg: '#f6ffed', border: '#b7eb8f', size: 32 },
  '不合格': { color: '#ff4d4f', bg: '#fff2f0', border: '#ffccc7', size: 32 },
  '让步接收': { color: '#fa8c16', bg: '#fff7e6', border: '#ffd591', size: 24 },
  '待判定': { color: '#8c8c8c', bg: '#fafafa', border: '#d9d9d9', size: 24 },
};
const rc = resultConfig[result] || resultConfig['待判定'];

const qcTypeColorMap = {
  '来料检验': 'blue',
  '过程检验': 'cyan',
  '成品检验': 'green',
  '出货检验': 'purple',
};

ctx.render(
  <Card size="small" style={{ marginBottom: 16 }} title="质检概览">
    <Row gutter={16} align="middle">
      <Col span={6} style={{ textAlign: 'center' }}>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 80,
            height: 80,
            borderRadius: 8,
            backgroundColor: rc.bg,
            border: `2px solid ${rc.border}`,
          }}
        >
          <span style={{ fontSize: rc.size, fontWeight: 'bold', color: rc.color }}>
            {result || '-'}
          </span>
        </div>
      </Col>
      <Col span={5} style={{ textAlign: 'center' }}>
        <Progress
          type="circle"
          percent={passRate}
          size={80}
          strokeColor={passRate >= 95 ? '#52c41a' : passRate >= 80 ? '#faad14' : '#ff4d4f'}
          format={(pct) => `${pct}%`}
        />
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>合格率</Text>
        </div>
      </Col>
      <Col span={4}>
        <Statistic title="抽样数" value={sample} />
      </Col>
      <Col span={4}>
        <Statistic
          title="合格数"
          value={pass}
          valueStyle={{ color: '#3f8600' }}
        />
      </Col>
      <Col span={4}>
        <Statistic
          title="不合格数"
          value={fail}
          valueStyle={{ color: fail > 0 ? '#cf1322' : undefined }}
        />
      </Col>
    </Row>
    <Divider style={{ margin: '12px 0' }} />
    <Space size={24}>
      <span>
        <Text type="secondary">检验类型：</Text>
        <Tag color={qcTypeColorMap[qc_type] || 'default'}>{qc_type || '-'}</Tag>
      </span>
      <span>
        <Text type="secondary">批次号：</Text>
        <Text>{batch_no || '-'}</Text>
      </span>
      <span>
        <Text type="secondary">检验员：</Text>
        <Text>{inspector || '-'}</Text>
      </span>
    </Space>
  </Card>
);
