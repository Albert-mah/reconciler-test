/**
 * Project Detail KPI — key metrics for project overview
 *
 * @type JSItemModel
 * @collection pm_projects
 * @fields code, name, status, budget, start_date, end_date
 */

const { useState, useEffect } = ctx.React;
const { Row, Col, Spin } = ctx.antd;
const h = ctx.React.createElement;

const fmt = (v) => v >= 1e6 ? `$${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v/1e3).toFixed(1)}K` : `$${Number(v).toFixed(0)}`;

const kpiStyle = {
  borderRadius: 8, padding: '12px 16px', background: '#fafafa',
  border: '1px solid #f0f0f0', minHeight: 60,
};
const labelSt = { fontSize: '0.75rem', color: '#999', marginBottom: 2 };
const valSt = (color) => ({ fontSize: '1.25rem', fontWeight: 700, color });

function DetailKPI() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const record = ctx.record || {};

  useEffect(() => {
    const projectName = record.name;
    if (!projectName) { setLoading(false); return; }

    Promise.all([
      ctx.api.request({ url: 'pm_tasks:list', params: { pageSize: 1, filter: { project_name: { $eq: projectName } } } }),
      ctx.api.request({ url: 'pm_tasks:list', params: { pageSize: 1, filter: { project_name: { $eq: projectName }, status: 'Done' } } }),
      ctx.api.request({ url: 'pm_timesheets:list', params: { pageSize: 200, filter: { project_name: { $eq: projectName } }, fields: ['hours'] } }),
      ctx.api.request({ url: 'pm_milestones:list', params: { pageSize: 1, filter: { project_name: { $eq: projectName }, status: 'Completed' } } }),
      ctx.api.request({ url: 'pm_milestones:list', params: { pageSize: 1, filter: { project_name: { $eq: projectName } } } }),
    ]).then(results => {
      const totalTasks = results[0]?.data?.meta?.count || 0;
      const doneTasks = results[1]?.data?.meta?.count || 0;
      const timesheetData = results[2]?.data?.data || [];
      const totalHours = timesheetData.reduce((s, t) => s + (Number(t.hours) || 0), 0);
      const completedMilestones = results[3]?.data?.meta?.count || 0;
      const totalMilestones = results[4]?.data?.meta?.count || 0;
      setData({ totalTasks, doneTasks, totalHours, completedMilestones, totalMilestones });
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [record.name]);

  if (loading) return h(Spin, { size: 'small' });
  if (!data) return null;

  const taskPct = data.totalTasks > 0 ? Math.round(data.doneTasks / data.totalTasks * 100) : 0;
  const budget = Number(record.budget) || 0;

  const KpiBox = ({ label, value, color }) => h('div', { style: kpiStyle },
    h('div', { style: labelSt }, label),
    h('div', { style: valSt(color) }, value)
  );

  return h(Row, { gutter: [12, 12] },
    h(Col, { xs: 12, md: 6 }, h(KpiBox, { label: 'Budget', value: fmt(budget), color: '#3b82f6' })),
    h(Col, { xs: 12, md: 6 }, h(KpiBox, { label: 'Tasks', value: `${data.doneTasks}/${data.totalTasks} (${taskPct}%)`, color: '#22c55e' })),
    h(Col, { xs: 12, md: 6 }, h(KpiBox, { label: 'Hours Logged', value: `${data.totalHours.toFixed(1)}h`, color: '#8b5cf6' })),
    h(Col, { xs: 12, md: 6 }, h(KpiBox, { label: 'Milestones', value: `${data.completedMilestones}/${data.totalMilestones}`, color: '#f59e0b' })),
  );
}

ctx.render(h(DetailKPI, null));
