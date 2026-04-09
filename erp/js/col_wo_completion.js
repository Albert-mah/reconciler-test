/**
 * WO Completion Progress bar
 * @type JSColumnModel
 */
const { Progress } = ctx.antd;
const r = ctx.record;
const planned = parseInt(r.planned_qty) || 0;
const completed = parseInt(r.completed_qty) || 0;
const pct = planned > 0 ? Math.round(completed / planned * 100) : 0;

const status = pct >= 100 ? 'success' : pct >= 50 ? 'active' : 'normal';

ctx.render(
  <Progress
    percent={Math.min(pct, 100)}
    size="small"
    status={status}
    format={() => `${completed}/${planned}`}
    style={{ maxWidth: 160 }}
  />
);
