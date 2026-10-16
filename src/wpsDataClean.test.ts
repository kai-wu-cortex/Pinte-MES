import assert from 'node:assert/strict';
import { cleanWpsTaskData, extractHeadersFromRawResponse, normalizeWpsHeader, parseWpsQuantity } from './wpsDataClean';
import { DEFAULT_FIELD_CONFIG } from './data';
import { isTaskOnDate } from './dateFilters';

const headers = ['计划生产日期', '工   艺', '机台', '流程卡号', '品名颜色', '规     格',
  '预计数量/m', '订单日期', '交货日期', '实际出货数量', '备          注'];
function response(rows: [number, (string | number | null)[]][]) {
  return { data: { range_data: rows.flatMap(([row_from, row]) => row.flatMap((cell_text, col_from) =>
    cell_text === null ? [] : [{ row_from, col_from, cell_text }])) } };
}

// Template layout, legacy mappings, spaced headers, sparse physical row numbers,
// formula details and notices reproduce the final workbook's failure modes.
const raw = response([
  [1, ['涂布生产计划(2026-10-17)']],
  [2, headers],
  [3, [null, '上色层', 'T2', null, 'SAMPLE-01', '12u*1305mm', 18000]],
  [4, [null, null, null, null, 'PTSF 01', '2098g']],
  [2945, ['2026年4月15日', '离型层', 'T1', null, 'SAMPLE-02', '12u*1305mm', '12,000m']],
  [3137, ['设备开机前请清洗干净']],
  [3976, ['2026年10月16日', '上色层', 'T1', '261016-01', 'SAMPLE-03', '12u*1305mm', '1000m', '2026/10/01', '2026/10/20', 0, '注意工艺参数']],
  [3977, ['2026年10月16日', '上胶层', 'T2', '261016-01', 'SAMPLE-03', '12u*1305mm', '1卷']],
  [3980, headers],
]);
const { tasks, headers: detected } = cleanWpsTaskData(raw);
assert.deepEqual(detected, headers);
assert.deepEqual(extractHeadersFromRawResponse(raw), headers);
assert.equal(tasks.length, 4);
assert.equal(tasks[0].startTime, '', 'undated history must not use the title date or today');
assert.equal(tasks[1].plannedQuantity, 12000);
assert.equal(tasks[2].plannedQuantity, 1000);
assert.equal(tasks[2].notes, '注意工艺参数');
assert.equal(tasks[2].specification, '12u*1305mm');
assert.equal(tasks[2].process, '上色层');
assert.ok(isTaskOnDate(tasks[2], new Date(2026, 9, 16)));
assert.ok(!isTaskOnDate(tasks[2], new Date(2026, 9, 20)));
assert.equal(tasks[2].fileWpsRow, 3976);
assert.equal(tasks[2].fileUrl, undefined, 'card number is not an attachment');
assert.equal(tasks[0].machineId, tasks[3].machineId, 'T2 must have a stable machine identity');
assert.equal(tasks[1].machineId, tasks[2].machineId);
assert.equal(tasks[2].id, tasks[3].id, 'keep distinct production stages sharing a card number');
assert.equal(tasks[3].plannedQuantity, 0, 'roll counts are not meter quantities');
assert.equal(tasks[3].plannedQuantityRaw, '1卷');

// Explicit user-selected date columns take precedence over template aliases.
const explicit = DEFAULT_FIELD_CONFIG.map(field => field.fieldId === 'startTime'
  ? { ...field, mappedColumn: '交货日期' } : field);
assert.ok(isTaskOnDate(cleanWpsTaskData(raw, explicit).tasks[2], new Date(2026, 9, 20)));
const disabled = DEFAULT_FIELD_CONFIG.map(field => field.fieldId === 'startTime'
  ? { ...field, mappedColumn: '' } : field);
assert.equal(cleanWpsTaskData(raw, disabled).tasks[2].startTime, '');

// Headers may be first, after a title, or after multiple blank/title rows.
for (const index of [0, 1, 5]) {
  const simple = response([[index, ['日期', '工艺', '机台', '流程卡号', '品名颜色']],
    [index + 3, ['2026/10/16', '涂布', 'T1', 'A-01', 'SAMPLE']]]);
  assert.equal(cleanWpsTaskData(simple).tasks.length, 1);
  assert.equal(cleanWpsTaskData(simple).tasks[0].fileWpsRow, index + 3);
}
const sparse = response([[0, ['日期', null, '流程卡号', null, '品名颜色']],
  [4, ['2026/10/16', null, 'A-01', null, 'SAMPLE']]]);
assert.deepEqual(extractHeadersFromRawResponse(sparse), ['日期', '', '流程卡号', '', '品名颜色']);
assert.equal(cleanWpsTaskData(sparse).tasks[0].productName, 'SAMPLE');
assert.deepEqual(cleanWpsTaskData({ data: { range_data: [] } }), { tasks: [], headers: [] });
assert.throws(() => cleanWpsTaskData(response([[0, ['非生产工作表']]])), /未识别到生产计划表头/);
assert.equal(normalizeWpsHeader('备\u200b　 注\n'), '备注');
assert.equal(parseWpsQuantity('18,000 米'), 18000);
assert.equal(parseWpsQuantity('１２０００ｍ'), 12000);
assert.equal(parseWpsQuantity('250.5m'), 250.5);
assert.equal(parseWpsQuantity('12000+500m'), 0);
assert.equal(parseWpsQuantity('500-1000m'), 0);
assert.equal(parseWpsQuantity(''), 0);

console.log('wpsDataClean tests passed');
