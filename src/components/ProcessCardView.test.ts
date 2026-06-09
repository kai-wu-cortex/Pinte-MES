import assert from 'node:assert/strict';
import { getProcessCardGridColumns, getProcessStageTheme, getProcessStages, groupProcessTasks, isProcessFieldVisible, mergeNewProcessFields } from './ProcessCardView';

assert.deepEqual(
  getProcessStages('模压').map(stage => stage.status),
  ['done', 'active', 'pending'],
);

assert.deepEqual(
  getProcessStages('分切').map(stage => stage.status),
  ['done', 'done', 'active'],
);

assert.deepEqual(
  getProcessStages('未知工艺').map(stage => stage.status),
  ['active', 'pending', 'pending'],
);

assert.equal(getProcessStageTheme('涂布').accentClass, 'bg-blue-500');
assert.equal(getProcessStageTheme('模压').accentClass, 'bg-amber-500');
assert.equal(getProcessStageTheme('分切').accentClass, 'bg-emerald-500');
assert.equal(getProcessStageTheme('未知工艺').accentClass, 'bg-blue-500');

assert.equal(getProcessCardGridColumns('sm'), 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8');
assert.equal(getProcessCardGridColumns('md'), 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6');
assert.equal(getProcessCardGridColumns('lg'), 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5');

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
