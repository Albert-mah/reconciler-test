/**
 * Combined delivery + quality score as stars
 * @type JSColumnModel
 */
const { Rate } = ctx.antd;
const r = ctx.record;
const delivery = parseFloat(r.delivery_score) || 0;
const quality = parseFloat(r.quality_score) || 0;
const avg = (delivery + quality) / 2;
const stars = Math.round(avg / 20);

ctx.render(
  <Rate disabled value={stars} style={{ fontSize: 14 }} />
);
