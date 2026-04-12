/**
 * Module scaffold — generate a new module skeleton with Dashboard + pages.
 *
 * Usage: cli.ts scaffold <dir> <module-name> --pages Dashboard,Orders,Products
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { slugify } from '../utils/slugify';
import { dumpYaml } from '../utils/yaml';

const KPI_COLORS = [
  { key: 'kpi_1', color: '#3b82f6', bg: '#eff6ff', stroke: '#bfdbfe', label: 'Total Records' },
  { key: 'kpi_2', color: '#10b981', bg: '#ecfdf5', stroke: '#6ee7b7', label: 'Active Rate' },
  { key: 'kpi_3', color: '#f59e0b', bg: '#fffbeb', stroke: '#fcd34d', label: 'Pending Items' },
  { key: 'kpi_4', color: '#8b5cf6', bg: '#f5f3ff', stroke: '#c4b5fd', label: 'Completed' },
];

const CHART_TYPES = [
  { key: 'chart_1', type: 'bar',  desc: 'Bar Chart — count by category' },
  { key: 'chart_2', type: 'pie',  desc: 'Pie Chart — distribution by status' },
  { key: 'chart_3', type: 'line', desc: 'Line Chart — trend over time' },
  { key: 'chart_4', type: 'bar',  desc: 'Stacked Bar — breakdown comparison' },
  { key: 'chart_5', type: 'pie',  desc: 'Donut Chart — proportion overview' },
];

const CHART_RENDERS: Record<string, string> = {
  bar: "var data = ctx.data.objects || [];\nreturn {\n  title: { text: 'TITLE', left: 'center', textStyle: { fontSize: 14 } },\n  tooltip: { trigger: 'axis' },\n  xAxis: { type: 'category', data: data.map(function(d) { return d.label; }), axisLabel: { rotate: 30 } },\n  yAxis: { type: 'value' },\n  series: [{ type: 'bar', data: data.map(function(d) { return d.value; }), itemStyle: { color: '#1677ff' } }]\n};",
  pie: "var data = ctx.data.objects || [];\nreturn {\n  title: { text: 'TITLE', left: 'center', textStyle: { fontSize: 14 } },\n  tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },\n  series: [{ type: 'pie', radius: ['40%', '70%'], data: data.map(function(d) { return { name: d.label, value: d.value }; }), label: { show: true, formatter: '{b}\\n{d}%' } }]\n};",
  line: "var data = ctx.data.objects || [];\nreturn {\n  title: { text: 'TITLE', left: 'center', textStyle: { fontSize: 14 } },\n  tooltip: { trigger: 'axis' },\n  xAxis: { type: 'category', data: data.map(function(d) { return d.label; }) },\n  yAxis: { type: 'value' },\n  series: [{ type: 'line', data: data.map(function(d) { return d.value; }), smooth: true, areaStyle: { opacity: 0.1 }, itemStyle: { color: '#1677ff' } }]\n};",
};

export function scaffold(
  modDir: string,
  moduleName: string,
  pages: string[],
  log: (msg: string) => void = console.log,
): void {
  const mod = path.resolve(modDir);
  for (const dir of ['js', 'charts', 'popups', 'ai']) {
    fs.mkdirSync(path.join(mod, dir), { recursive: true });
  }

  const modSlug = slugify(moduleName);
  const pageSpecs: Record<string, unknown>[] = [];
  const enhancePopups: Record<string, unknown>[] = [];

  // Find KPI template
  const templateDirs = [
    path.join(path.dirname(path.dirname(mod)), 'templates'),
    path.join(path.dirname(mod), 'templates'),
  ];
  let kpiTemplate = '';
  for (const td of templateDirs) {
    const p = path.join(td, 'kpi_card.js');
    if (fs.existsSync(p)) { kpiTemplate = fs.readFileSync(p, 'utf8'); break; }
  }

  for (const pageName of pages) {
    const pageKey = slugify(pageName);
    const isDashboard = pageName.toLowerCase().includes('dashboard');

    if (isDashboard) {
      // ── Dashboard: KPI + charts ──
      for (let i = 0; i < KPI_COLORS.length; i++) {
        const { key, color, bg, stroke, label } = KPI_COLORS[i];
        let js: string;
        if (kpiTemplate) {
          js = kpiTemplate
            .replace("label: 'Total Employees'", `label: '${label}'`)
            .replace("'#3b82f6'", `'${color}'`).replace("'#eff6ff'", `'${bg}'`).replace("'#bfdbfe'", `'${stroke}'`)
            .replace("reportUid: 'hrm_kpi_employees'", `reportUid: '${modSlug}_kpi_${i + 1}'`)
            .replace('FROM nb_hrm_employees', `FROM nb_${modSlug}_TODO  -- ← CHANGE THIS`);
        } else {
          js = `// KPI Card ${i + 1}: ${label}\nctx.render(ctx.React.createElement('div', null, '${label}'));`;
        }
        fs.writeFileSync(path.join(mod, 'js', `${key}.js`), js);
      }

      for (const { key, type, desc } of CHART_TYPES) {
        fs.writeFileSync(path.join(mod, 'charts', `${key}.yaml`),
          `sql_file: ./charts/${key}.sql\nrender_file: ./charts/${key}_render.js\n`);
        fs.writeFileSync(path.join(mod, 'charts', `${key}.sql`),
          `-- ${desc}\nSELECT 'Category A' AS label, 10 AS value\nUNION ALL SELECT 'Category B', 20\nUNION ALL SELECT 'Category C', 15\nUNION ALL SELECT 'Category D', 8\n`);
        const renderJs = (CHART_RENDERS[type] || CHART_RENDERS.bar).replace('TITLE', desc.split(' — ')[0]);
        fs.writeFileSync(path.join(mod, 'charts', `${key}_render.js`), renderJs);
      }

      pageSpecs.push({
        page: pageName, icon: 'dashboardoutlined',
        blocks: [
          ...KPI_COLORS.map((c, i) => ({ key: c.key, type: 'jsBlock', desc: `KPI Card ${i + 1}`, file: `./js/${c.key}.js` })),
          ...CHART_TYPES.map(c => ({ key: c.key, type: 'chart', chart_config: `./charts/${c.key}.yaml` })),
        ],
        layout: [
          [{ kpi_1: 6 }, { kpi_2: 6 }, { kpi_3: 6 }, { kpi_4: 6 }],
          [{ chart_1: 15 }, { chart_2: 9 }],
          ['chart_3'],
          [{ chart_4: 14 }, { chart_5: 10 }],
        ],
      });
    } else {
      // ── Regular page: filterForm + table ──
      const coll = `nb_${modSlug}_${pageKey}`;
      pageSpecs.push({
        page: pageName, icon: 'fileoutlined', coll,
        blocks: [
          { key: 'filterForm', type: 'filterForm', coll, fields: [{ field: 'name', filterPaths: ['name'] }] },
          { key: 'table', type: 'table', coll, fields: ['name', 'status', 'createdAt'], actions: ['filter', 'refresh', 'addNew'], recordActions: ['edit', 'delete'] },
        ],
        layout: [['filterForm'], ['table']],
      });
      enhancePopups.push({
        target: `$${pageKey}.table.actions.addNew`,
        auto: ['edit', 'detail'], view_field: 'name', coll,
        blocks: [{ key: 'form', type: 'createForm', resource: { binding: 'currentCollection' }, fields: ['name', 'status'], field_layout: ['--- Basic Info ---', ['name', 'status']], actions: ['submit'] }],
      });
    }
  }

  const structure = {
    module: moduleName, icon: 'appstoreoutlined',
    collections: Object.fromEntries(pages.map(p => {
      const k = `nb_${modSlug}_${slugify(p)}`;
      return [k, { title: p, fields: [{ name: 'name', interface: 'input', title: 'Name' }, { name: 'status', interface: 'select', title: 'Status', options: ['Active', 'Inactive'] }] }];
    })),
    pages: pageSpecs,
  };

  fs.writeFileSync(path.join(mod, 'structure.yaml'), dumpYaml(structure));
  fs.writeFileSync(path.join(mod, 'enhance.yaml'), dumpYaml({ popups: enhancePopups }));

  log(`\n  Scaffold created: ${modDir}/`);
  log(`    ${pages.length} pages: ${pages.join(', ')}`);
  log(`\n  Next steps:`);
  log(`    1. Edit structure.yaml — add fields to collections + blocks`);
  log(`    2. Edit enhance.yaml — customize addNew form fields + layout`);
  log(`    3. Deploy: cli.ts deploy ${modDir}/`);
}
