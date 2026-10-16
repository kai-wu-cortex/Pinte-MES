import type { CustomFieldConfig, Task } from './types';
import { DEFAULT_FIELD_CONFIG, MACHINES } from './data';
import { convertWpsDateValue } from './wpsDateConvert';

const FIELD_ALIASES: Record<string, string[]> = {
  startTime: ['日期', '计划生产日期', '生产日期', '排产日期'],
  id: ['流程卡号'],
  process: ['工艺'],
  machineName: ['机台'],
  productName: ['品名颜色'],
  specification: ['规格'],
  plannedQuantity: ['预计数量/m', '预计数量/米', '预计数量'],
  actualOutput: ['实际产出'],
  slittingQuantity: ['分切数量'],
  shippedQuantity: ['实际出货数量'],
  notes: ['备注', '工艺备注'],
};
const NUMBER_FIELDS = new Set(['plannedQuantity', 'actualOutput', 'slittingQuantity', 'shippedQuantity']);

export function normalizeWpsHeader(value: unknown): string {
  return String(value ?? '').normalize('NFKC').replace(/[\s\u200B-\u200D\uFEFF]/g, '').toLowerCase();
}

interface SheetRow {
  index: number;
  cells: string[];
}

function readRows(rawData: any): SheetRow[] {
  const cells = rawData?.data?.range_data;
  if (!Array.isArray(cells)) return [];
  const rows = new Map<number, string[]>();
  for (const cell of cells) {
    if (!Number.isInteger(cell.row_from) || cell.row_from < 0 ||
      !Number.isInteger(cell.col_from) || cell.col_from < 0) continue;
    const row = rows.get(cell.row_from) ?? [];
    row[cell.col_from] = String(cell.cell_text ?? '').trim();
    rows.set(cell.row_from, row);
  }
  return [...rows].sort(([a], [b]) => a - b).map(([index, row]) => ({ index, cells: row }));
}

function findHeader(rows: SheetRow[], config: CustomFieldConfig[]): SheetRow | undefined {
  const known = new Set([
    ...Object.values(FIELD_ALIASES).flat(), ...config.map(field => field.mappedColumn),
  ].map(normalizeWpsHeader).filter(Boolean));
  let best: SheetRow | undefined;
  let bestScore = 1;
  for (const row of rows) {
    const score = new Set(row.cells.map(normalizeWpsHeader).filter(value => known.has(value))).size;
    if (score > bestScore) {
      best = row;
      bestScore = score;
    }
  }
  return best;
}

export function extractHeadersFromRawResponse(rawData: any): string[] {
  const header = findHeader(readRows(rawData), DEFAULT_FIELD_CONFIG);
  return header ? Array.from(header.cells, value => value ?? '') : [];
}

/** Meter suffixes are accepted; roll counts, ranges and expressions are not meters. */
export function parseWpsQuantity(raw: string): number {
  const text = raw.normalize('NFKC').trim().replace(/[,\s]/g, '');
  const match = text.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(?:m|米)?$/i);
  if (!match) return 0;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : 0;
}

export function cleanWpsTaskData(rawData: any, config: CustomFieldConfig[] = DEFAULT_FIELD_CONFIG): { tasks: Task[]; headers: string[] } {
  const rows = readRows(rawData);
  if (!rows.length) return { tasks: [], headers: [] };
  const header = findHeader(rows, config);
  if (!header) throw new Error('未识别到生产计划表头，请检查工作表及同步范围');
  const headers = Array.from(header.cells, value => value ?? '');
  const columns = new Map<string, number>();
  headers.forEach((name, index) => {
    const normalized = normalizeWpsHeader(name);
    if (normalized && !columns.has(normalized)) columns.set(normalized, index);
  });
  const fieldColumns = new Map<string, number>();
  for (const field of config) {
    const mapped = normalizeWpsHeader(field.mappedColumn);
    if (!mapped) continue;
    let column = columns.get(mapped);
    const aliases = FIELD_ALIASES[field.fieldId] ?? [];
    // Respect explicit custom mappings. Only a recognized legacy name may fall
    // back to another known name for the same field in a newer sheet template.
    if (column === undefined && aliases.some(alias => normalizeWpsHeader(alias) === mapped)) {
      column = aliases.map(alias => columns.get(normalizeWpsHeader(alias))).find(index => index !== undefined);
    }
    if (column !== undefined) fieldColumns.set(field.fieldId, column);
  }

  const tasks: Task[] = [];
  for (const row of rows) {
    if (row.index <= header.index) continue;
    const getValue = (field: string) => row.cells[fieldColumns.get(field) ?? -1] ?? '';
    // Exclude recipe lines, blank separators, repeated headers and merged notices.
    // An absent card number or date alone does not disqualify a production row.
    if (!(getValue('process') && (getValue('productName') || getValue('id') || getValue('machineName') || getValue('specification'))) &&
      !(getValue('id') && getValue('productName'))) continue;
    if (row.cells.filter(value => columns.has(normalizeWpsHeader(value))).length >= 2) continue;

    const task: Task = {
      id: '', process: '', machineName: '', machineId: '', productName: '', specification: '',
      plannedQuantity: 0, actualOutput: 0, slittingQuantity: 0, shippedQuantity: 0,
      startTime: '', operator: '', notes: '', fileWpsRow: row.index,
    };
    for (const field of config) {
      const value = getValue(field.fieldId);
      if (NUMBER_FIELDS.has(field.fieldId) || field.fieldId.endsWith('Quantity')) {
        task[field.fieldId] = parseWpsQuantity(value);
      } else if (/date|time/i.test(field.fieldId)) {
        task[field.fieldId] = convertWpsDateValue(value);
      } else {
        task[field.fieldId] = value;
      }
    }
    // Preserve original quantities for non-meter values, without inflating meter totals.
    if (getValue('plannedQuantity')) task.plannedQuantityRaw = getValue('plannedQuantity');
    if (!task.machineId) {
      task.machineId = MACHINES.find(machine => machine.name === task.machineName)?.id ??
        (task.machineName ? `WPS-MACHINE-${encodeURIComponent(task.machineName)}` : 'WPS-UNASSIGNED');
    }
    const attachmentColumn = headers.findIndex(name => /电子.*流程卡|流程卡.*附件|电子流程卡|附件/.test(normalizeWpsHeader(name)));
    const fileColumn = fieldColumns.get('fileUrl') ?? (attachmentColumn >= 0 ? attachmentColumn : undefined);
    if (fileColumn !== undefined) {
      task.fileUrl = row.cells[fileColumn] || undefined;
      task.fileWpsCol = fileColumn;
    }
    tasks.push(task);
  }
  return { tasks, headers };
}
