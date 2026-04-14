/**
 * CRM Overview page — TS DSL example.
 *
 * This recreates the CRM Overview layout.yaml using the fluent builder API.
 * Compare with: /tmp/crm-roundtrip/pages/main/overview/layout.yaml
 */

import {
  page,
  table,
  jsBlock,
  field,
  link,
  ai,
  updateRecord,
  filter,
  jsColumn,
  popup,
  editForm,
  group,
  route,
  app,
} from '../src/dsl';

// ─── Block definitions ───

const overviewJs = jsBlock('./js/overview_jsBlock.js');

const highScoreLeads = table('high_score_leads', 'nb_crm_leads', {
  title: 'High Score Leads',
  dataScope: filter({
    status: { $in: ['new', 'working'] },
    ai_score: { $gte: '75' },
  }),
  pageSize: 5,
  fields: [
    field('name', {
      clickToOpen: true,
      popupSettings: {
        collectionName: 'nb_crm_leads',
        mode: 'drawer',
        size: 'large',
        filterByTk: '{{ ctx.record.id }}',
        popupTemplateUid: 'z3ah4m1jm20',
      },
    }),
    field('ai_next_best_action', { width: 300 }),
    'updatedAt',
  ],
  jsColumns: [
    jsColumn('ai_score', './js/overview_high_score_leads_col_ai_score.js', {
      title: 'AI Score',
      desc: 'AI Score Column',
    }),
  ],
  columnOrder: ['name', '[JS:ai_score]', 'ai_next_best_action', 'updatedAt'],
  actions: [
    'filter',
    'refresh',
    link('View All', '/admin/e9478uhrdve', { icon: 'arrowrightoutlined' }),
    ai('viz'),
  ],
});

const todaysTasks = table('today_s_tasks', 'nb_crm_activities', {
  title: "Today's Tasks",
  dataScope: filter({
    type: 'task',
    activity_date: { $dateOn: { type: 'today' } },
  }),
  pageSize: 5,
  fields: [
    field('subject', {
      clickToOpen: true,
      popupSettings: {
        collectionName: 'nb_crm_activities',
        mode: 'drawer',
        size: 'medium',
        filterByTk: '{{ ctx.record.id }}',
        popupTemplateUid: 'gn64s38sjki',
      },
    }),
    'activity_date',
  ],
  recordActions: [
    updateRecord('done', {
      icon: 'borderoutlined',
      tooltip: 'Done',
      style: 'link',
      assign: { is_completed: true },
      hiddenWhen: filter(
        { '{{ ctx.record.is_completed }}': { $isTruly: true } },
      ),
    }),
    updateRecord('undone', {
      icon: 'checksquareoutlined',
      tooltip: 'Undone',
      style: 'link',
      assign: {},
      hiddenWhen: filter(
        {
          '{{ ctx.record.is_completed }}': { $isFalsy: true },
        },
        '$or',
      ),
    }),
  ],
  actions: [
    'filter',
    'refresh',
    link('View All', '/admin/n6bh6s6isej', { icon: 'arrowrightoutlined' }),
    'addNew',
    ai('viz', './ai/overview_today_s_tasks_tasks.yaml'),
  ],
});

const calendarBlock = jsBlock('./js/overview_activity_calendar_block.js', {
  key: 'activity_calendar_block',
  desc: 'Activity Calendar Block',
});

// ─── Page definition ───

export default page('Overview', {
  icon: 'calendaroutlined',
  blocks: [overviewJs, highScoreLeads, todaysTasks, calendarBlock],
  layout: [
    ['jsBlock'],
    [{ high_score_leads: 16 }, { today_s_tasks: 8 }],
    ['activity_calendar_block'],
  ],
});

// ─── App-level example (shows route structure) ───

export const crmApp = app('CRM App', {
  routes: [
    group('CRM', 'dashboardoutlined', [
      route('Overview', 'calendaroutlined',
        page('Overview', {
          icon: 'calendaroutlined',
          blocks: [overviewJs, highScoreLeads, todaysTasks, calendarBlock],
          layout: [
            ['jsBlock'],
            [{ high_score_leads: 16 }, { today_s_tasks: 8 }],
            ['activity_calendar_block'],
          ],
        }),
      ),
    ]),
  ],
});
