/**
 * Inventory Direction Tag — In/Out/Transfer
 * @type JSColumnModel
 */
const { Tag } = ctx.antd;
const r = ctx.record;
const type = r.txn_type || '';

const inTypes = ['Purchase Receipt', 'Production Receipt', 'Return Receipt', 'Gain'];
const outTypes = ['Sales Issue', 'Production Issue', 'Loss'];
const transferTypes = ['Transfer'];

if (inTypes.includes(type)) {
  ctx.render(<Tag color="green" style={{ fontWeight: 600 }}>In &#8593;</Tag>);
} else if (outTypes.includes(type)) {
  ctx.render(<Tag color="red" style={{ fontWeight: 600 }}>Out &#8595;</Tag>);
} else if (transferTypes.includes(type)) {
  ctx.render(<Tag color="blue" style={{ fontWeight: 600 }}>Transfer &#8596;</Tag>);
} else {
  ctx.render(<Tag color="default">{type}</Tag>);
}
