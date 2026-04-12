/**
 * SQL verification — test all chart/KPI SQL against live PostgreSQL.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { NocoBaseClient } from '../client';
import type { StructureSpec } from '../types/spec';
import { loadYaml } from '../utils/yaml';

interface SqlSource {
  label: string;
  sql: string;
  filePath: string;
}

/**
 * Verify all SQL in a module by running against live database.
 * Returns { passed, failed } counts.
 */
export async function verifySql(
  modDir: string,
  nb: NocoBaseClient,
  structure?: StructureSpec,
): Promise<{ passed: number; failed: number; results: { label: string; ok: boolean; rows?: number; error?: string }[] }> {
  const mod = path.resolve(modDir);

  if (!structure) {
    structure = loadYaml<StructureSpec>(path.join(mod, 'structure.yaml'));
  }

  const sources = collectSqlSources(mod, structure);
  const results: { label: string; ok: boolean; rows?: number; error?: string }[] = [];

  for (const { label, sql, filePath } of sources) {
    // Clean liquid/jinja templates
    let clean = sql.replace(/\{%\s*if\s+[^%]*%\}.*?\{%\s*endif\s*%\}/gs, '');
    clean = clean.split('\n').filter(l => !l.includes('{{') && !l.includes('{%')).join('\n').trim();

    try {
      const uid = `_verify_${label.replace(/[/. ]/g, '_')}`;
      const resp = await nb.http.post(`${nb.baseUrl}/api/flowSql:run`, {
        type: 'selectRows', uid, dataSourceKey: 'main', sql: clean, bind: {},
      });

      if (resp.status >= 400 || resp.data?.errors?.length) {
        const msg = resp.data?.errors?.[0]?.message || JSON.stringify(resp.data).slice(0, 200);
        results.push({ label, ok: false, error: msg });
      } else {
        const rows = resp.data?.data?.length || 0;
        results.push({ label, ok: true, rows });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ label, ok: false, error: msg });
    }
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  return { passed, failed, results };
}

function collectSqlSources(mod: string, structure: StructureSpec): SqlSource[] {
  const sources: SqlSource[] = [];

  for (const ps of structure.pages) {
    for (const bs of ps.blocks) {
      // Chart SQL
      const chartFile = bs.chart_config || '';
      if (chartFile) {
        const cfgPath = path.join(mod, chartFile);
        if (fs.existsSync(cfgPath) && (chartFile.endsWith('.yaml') || chartFile.endsWith('.yml'))) {
          try {
            const spec = loadYaml<Record<string, string>>(cfgPath);
            const sqlFile = spec.sql_file || '';
            const sql = (sqlFile && fs.existsSync(path.join(mod, sqlFile)))
              ? fs.readFileSync(path.join(mod, sqlFile), 'utf8')
              : spec.sql || '';
            if (sql) {
              sources.push({ label: `${ps.page}/${chartFile}`, sql, filePath: path.join(mod, sqlFile || chartFile) });
            }
          } catch { /* skip */ }
        }
      }

      // KPI JS embedded SQL
      if (bs.type === 'jsBlock' && bs.file) {
        const jsPath = path.join(mod, bs.file);
        if (fs.existsSync(jsPath)) {
          const code = fs.readFileSync(jsPath, 'utf8');
          const match = code.match(/sql:\s*`([^`]+)`/);
          if (match) {
            sources.push({ label: `${ps.page}/${bs.file}`, sql: match[1], filePath: jsPath });
          }
        }
      }
    }
  }

  return sources;
}
