import assert from 'node:assert/strict';
import { getTaskSortValue, sortTasks } from './sorting';
import type { Task } from './types';

const tasks = [
  { id: '单10', productName: '产品10', startTime: '', plannedQuantity: 100 },
  { id: '单2', productName: '产品2', startTime: '2026-10-16T00:00:00', plannedQuantity: 10 },
  { id: '单1', productName: '产品2', startTime: '2026-10-17T00:00:00', plannedQuantity: 10 },
  { id: '单3', productName: '镭射金', startTime: 'invalid', plannedQuantity: 0 },
] as Task[];
const original = [...tasks];

// Compare with previous ordering semantics, including ascending ID tie breaks
// for both directions and undated history mixed with dated production orders.
for (const fieldId of ['productName', 'startTime', 'plannedQuantity', 'id']) {
  for (const direction of ['asc', 'desc'] as const) {
    const expected = [...tasks].sort((a, b) => {
      const av = getTaskSortValue(a, fieldId);
      const bv = getTaskSortValue(b, fieldId);
      const comparison = typeof av === 'number' && typeof bv === 'number' ? av - bv
        : String(av).localeCompare(String(bv), 'zh-CN', { numeric: true, sensitivity: 'base' });
      return comparison ? comparison * (direction === 'asc' ? 1 : -1) : a.id.localeCompare(b.id, 'zh-CN', { numeric: true });
    });
    assert.deepEqual(sortTasks(tasks, { fieldId, direction }), expected);
  }
}
assert.deepEqual(tasks, original, 'sorting must not mutate the source');
console.log('sorting tests passed');
