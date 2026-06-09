import assert from 'node:assert/strict';
import { PROCESS_FLOW_ORDER, getProcessCardGridColumns, getProcessStageTheme, getProcessStages, getProcessSummaryText, getVisibleProcessTasks, groupProcessTasks, isProcessFieldVisible, mergeNewProcessFields, resolveProcessFlowStages } from './ProcessCardView';

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

assert.equal(getProcessCardGridColumns('sm'), 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4');
assert.equal(getProcessCardGridColumns('md'), 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3');
assert.equal(getProcessCardGridColumns('lg'), 'grid-cols-1 lg:grid-cols-2');

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
