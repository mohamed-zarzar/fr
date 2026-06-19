import type { OfficialTemplate, OfficialTemplateColumn } from '@/types/mark-record';

/** Input columns are the ones that have user-editable scores (kind === 'input' or undefined). */
export function getInputColumns(template: OfficialTemplate): OfficialTemplateColumn[] {
  return template.columns.filter(c => !c.kind || c.kind === 'input');
}

/** Computed columns reference other columns and derive their value automatically. */
export function getComputedColumns(template: OfficialTemplate): OfficialTemplateColumn[] {
  return template.columns.filter(c => c.kind === 'computed');
}

/**
 * Compute the derived value for a computed column given the current scores map.
 * Returns undefined when no source column has a value yet.
 */
export function computeColumnValue(
  column: OfficialTemplateColumn,
  scores: Record<string, number | ''>,
): number | undefined {
  if (column.kind !== 'computed' || !column.formula) return undefined;
  const { op, columnIds } = column.formula;
  const values: number[] = [];
  for (const id of columnIds) {
    const v = scores[id];
    if (v !== '' && v !== undefined) values.push(Number(v));
  }
  if (values.length === 0) return undefined;
  const sum = values.reduce((a, b) => a + b, 0);
  return op === 'sum' ? sum : Math.round((sum / values.length) * 100) / 100;
}

/**
 * Derive the maxScore for a computed column from the referenced input columns.
 */
export function computeColumnMax(
  column: OfficialTemplateColumn,
  allColumns: OfficialTemplateColumn[],
): number {
  if (column.kind !== 'computed' || !column.formula) return column.maxScore;
  const { op, columnIds } = column.formula;
  const maxes = columnIds.map(id => allColumns.find(c => c.id === id)?.maxScore ?? 0);
  if (maxes.length === 0) return 0;
  const total = maxes.reduce((a, b) => a + b, 0);
  return op === 'sum' ? total : Math.round((total / maxes.length) * 100) / 100;
}

/**
 * Total score and maxScore for a record, counting only input columns.
 */
export function computeInputTotal(
  template: OfficialTemplate,
  scores: Record<string, number>,
): { total: number; max: number } {
  const inputs = getInputColumns(template);
  const total = inputs.reduce((a, c) => a + (scores[c.id] ?? 0), 0);
  const max = inputs.reduce((a, c) => a + c.maxScore, 0);
  return { total, max };
}

/**
 * Strip computed column ids from a scores object so we never persist derived values.
 */
export function stripComputedScores(
  template: OfficialTemplate,
  scores: Record<string, number | ''>,
): Record<string, number> {
  const inputIds = new Set(getInputColumns(template).map(c => c.id));
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(scores)) {
    if (inputIds.has(k) && v !== '' && v !== undefined) {
      out[k] = Number(v);
    }
  }
  return out;
}
