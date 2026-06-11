import assert from 'node:assert/strict';
import { PROCESS_FLOW_ORDER, getFilteredProcessTasks, getProcessCardGridColumns, getProcessStageTheme, getProcessStages, getProcessSummaryText, getVisibleProcessTasks, groupProcessTasks, isProcessFieldVisible, mergeNewProcessFields, resolveProcessFlowStages } from './ProcessCardView';

assert.deepEqual(
  getProcessStages('模压').map(stage => stage.status),
  ['done', 'active', 'pending'],
);

assert.deepEqual(
  getProcessStages('分切').map(stage => stage.status),
  ['done', 'done', 'active'],
);

assert.deepEqual(PROCESS_FLOW_ORDER, ['涂布', '模压', '分切']);
assert.deepEqual(resolveProcessFlowStages(['分切', '涂布', '模压']).map(stage => stage.id), ['分切', '涂布', '模压']);
assert.deepEqual(resolveProcessFlowStages(['分切', '未知', '涂布']).map(stage => stage.id), ['分切', '涂布']);
assert.deepEqual(resolveProcessFlowStages([]).map(stage => stage.id), ['涂布', '模压', '分切']);
assert.deepEqual(
  resolveProcessFlowStages(['复合', '涂布'], [
    { id: 'A', process: '涂布' },
    { id: 'B', process: '分切' },
    { id: 'C', process: '复合' },
    { id: 'D', process: '复合' },
  ] as any).map(stage => stage.id),
  ['复合', '涂布', '分切'],
);

assert.deepEqual(
  getProcessStages('未知工艺').map(stage => stage.status),
  ['active', 'pending', 'pending'],
);

assert.deepEqual(
  getProcessStages('B', [
    { id: 'A', label: 'A', englishLabel: 'Stage A' },
    { id: 'B', label: 'B', englishLabel: 'Stage B' },
    { id: 'C', label: 'C', englishLabel: 'Stage C' },
  ]).map(stage => stage.status),
  ['done', 'active', 'pending'],
);

assert.equal(getProcessStageTheme('涂布').accentClass, 'bg-blue-500');
assert.equal(getProcessStageTheme('模压').accentClass, 'bg-amber-500');
assert.equal(getProcessStageTheme('分切').accentClass, 'bg-emerald-500');
assert.equal(getProcessStageTheme('未知工艺').accentClass, 'bg-blue-500');

assert.equal(getProcessCardGridColumns('sm'), 'grid-cols-[repeat(auto-fill,minmax(260px,1fr))]');
assert.equal(getProcessCardGridColumns('md'), 'grid-cols-[repeat(auto-fill,minmax(320px,1fr))]');
assert.equal(getProcessCardGridColumns('lg'), 'grid-cols-[repeat(auto-fill,minmax(400px,1fr))]');

const grouped = groupProcessTasks([
  { id: 'A', process: '涂布' },
  { id: 'B', process: '模压' },
  { id: 'C', process: '涂布' },
] as any, 'process');
assert.deepEqual(Object.keys(grouped), ['涂布', '模压']);
assert.equal(grouped['涂布'].length, 2);
assert.deepEqual(groupProcessTasks([{ id: 'A', process: '涂布' }] as any, 'none'), { 所有流程卡: [{ id: 'A', process: '涂布' }] });

assert.deepEqual(
  mergeNewProcessFields(['id', 'process'], ['id', 'process', 'specification'], ['id', 'process', 'specification']),
  ['id', 'process'],
);
assert.deepEqual(
  mergeNewProcessFields(['id', 'process'], ['id', 'process', 'customField'], ['id', 'process']),
  ['id', 'process', 'customField'],
);

assert.equal(isProcessFieldVisible(new Set(['id', 'productName']), 'specification'), false);
assert.equal(isProcessFieldVisible(new Set(['id', 'productName']), 'productName'), true);

assert.equal(getProcessSummaryText(20, 100), '当前显示 20 / 100 张流程卡');
assert.equal(getProcessSummaryText(100, 100), '当前显示 100 张流程卡');

const visibleTasks = getVisibleProcessTasks(
  Array.from({ length: 80 }, (_, index) => ({ id: String(index), process: '涂布' })) as any,
  48,
);
assert.equal(visibleTasks.length, 48);
assert.equal(visibleTasks[47].id, '47');
assert.equal(getVisibleProcessTasks([{ id: 'A', process: '涂布' }] as any, 48).length, 1);

const filterTasks = [
  { id: 'FC-001', process: '涂布', productName: '亮金', machineName: 'A1', specification: '12μm', operator: '张三', notes: '加急', startTime: '2026-06-10T08:00:00.000Z' },
  { id: 'FC-002', process: '分切', productName: '哑银', machineName: 'B2', specification: '18μm', operator: '李四', notes: '', startTime: '2026-06-11T08:00:00.000Z' },
] as any;
assert.deepEqual(getFilteredProcessTasks(filterTasks, '').map((task: any) => task.id), ['FC-001', 'FC-002']);
assert.deepEqual(getFilteredProcessTasks(filterTasks, '亮金').map((task: any) => task.id), ['FC-001']);
assert.deepEqual(getFilteredProcessTasks(filterTasks, 'B2').map((task: any) => task.id), ['FC-002']);
assert.deepEqual(getFilteredProcessTasks(filterTasks, '2026-06-10').map((task: any) => task.id), ['FC-001']);
assert.deepEqual(getFilteredProcessTasks(filterTasks, '', { process: { operator: 'equals', value: '涂布' } }).map((task: any) => task.id), ['FC-001']);
assert.deepEqual(getFilteredProcessTasks(filterTasks, '', { notes: { operator: 'isEmpty', value: '' } }).map((task: any) => task.id), ['FC-002']);
assert.deepEqual(getFilteredProcessTasks(filterTasks, '', { productName: { operator: 'notContains', value: '亮' } }).map((task: any) => task.id), ['FC-002']);
