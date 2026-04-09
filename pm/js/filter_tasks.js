/**
 * Task Stats Filter
 *
 * @type JSItemModel
 * @template filter-stats
 */

const TARGET_BLOCK_UID = '__TABLE_UID__';

// ─── CONFIG: AI modifies here ────────────────────────────────
const COLLECTION = 'pm_tasks';

const GROUPS = [
  {
    name: 'Status',
    items: [
      { key: 'all', label: 'All', filter: null },
      { key: 'todo', label: 'To Do', filter: { status: { $eq: 'To Do' } } },
      { key: 'in_progress', label: 'In Progress', filter: { status: { $eq: 'In Progress' } } },
      { key: 'in_review', label: 'In Review', filter: { status: { $eq: 'In Review' } } },
      { key: 'done', label: 'Done', filter: { status: { $eq: 'Done' } } },
      { key: 'blocked', label: 'Blocked', filter: { status: { $eq: 'Blocked' } } },
    ],
  },
  {
    name: 'Smart',
    items: [
      { key: 'overdue', label: 'Overdue', filterFn: () => {
          const today = ctx.libs.dayjs().format('YYYY-MM-DD');
          return { $and: [{ due_date: { $lt: today } }, { status: { $notIn: ['Done'] } }] };
        }, danger: true },
      { key: 'unassigned', label: 'Unassigned', filter: { assignee: { $empty: true } } },
    ],
  },
];
// ─── CONFIG END ────────────────────────────────────

// ─── Do not modify below ─────────────────────────────────────
const { useState, useEffect, useCallback } = ctx.React;
const { Button, Badge, Space, Spin, Divider } = ctx.antd;

function useStats() {
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchCounts = useCallback(async () => {
    setLoading(true);
    try {
      const allItems = GROUPS.flatMap(g => g.items).filter(item => !item.filterFn);
      const results = await Promise.all(
        allItems.map(item =>
          ctx.api.request({
            url: `${COLLECTION}:list`,
            params: {
              pageSize: 1,
              ...(item.filter && { filter: item.filter }),
            },
          })
        )
      );
      const c = {};
      allItems.forEach((item, i) => {
        c[item.key] = results[i]?.data?.meta?.count || 0;
      });
      setCounts(c);
    } catch (e) {
      console.error('Stats fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCounts(); }, [fetchCounts]);
  return { counts, loading };
}

const StatsFilter = () => {
  const { counts, loading } = useStats();
  const [active, setActive] = useState('all');

  const handleClick = useCallback(async (item) => {
    setActive(item.key);
    try {
      const target = ctx.engine?.getModel(TARGET_BLOCK_UID);
      if (!target) return;
      const filterVal = item.filterFn ? item.filterFn() : (item.filter || { $and: [] });
      target.resource.addFilterGroup(ctx.model.uid, filterVal);
      await target.resource.refresh();
    } catch (e) {
      console.error('Filter error:', e);
    }
  }, []);

  if (loading) return (<Spin size="small" />);

  const renderGroup = (group, idx) => (
    <Space key={idx} wrap size={[6, 6]}>
      {group.items.map(item => (
        <Badge key={item.key} count={counts[item.key] ?? 0} overflowCount={9999} offset={[6, 0]}>
          <Button
            type={active === item.key ? 'primary' : 'default'}
            size="small"
            danger={item.danger}
            onClick={() => handleClick(item)}
          >
            {item.label}
          </Button>
        </Badge>
      ))}
    </Space>
  );

  return (
    <Space wrap size={[8, 8]} split={GROUPS.length > 1 ? <Divider type="vertical" style={{ margin: 0 }} /> : null}>
      {GROUPS.map((group, idx) => renderGroup(group, idx))}
    </Space>
  );
};

ctx.render(<StatsFilter />);
