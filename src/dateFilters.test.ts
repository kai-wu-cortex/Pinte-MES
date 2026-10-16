import assert from 'node:assert/strict';
import { filterTasksByToday, getTaskDateKey, indexTasksByDate, isTaskOnDate } from './dateFilters';

const today = new Date('2026-06-10T12:00:00.000Z');

assert.equal(isTaskOnDate({ startTime: '2026-06-10T08:00:00.000Z' } as any, today), true);
assert.equal(isTaskOnDate({ startTime: '2026-06-09T08:00:00' } as any, today), false);
assert.equal(isTaskOnDate({ startTime: '' } as any, today), false);
assert.equal(isTaskOnDate({ startTime: '不是日期' } as any, today), false);

const tasks = [
  { id: 'today', startTime: '2026-06-10T08:00:00.000Z' },
  { id: 'tomorrow', startTime: '2026-06-11T08:00:00.000Z' },
  { id: 'invalid', startTime: '不是日期' },
] as any;

assert.deepEqual(filterTasksByToday(tasks, false, today).map((task: any) => task.id), ['today', 'tomorrow', 'invalid']);
assert.deepEqual(filterTasksByToday(tasks, true, today).map((task: any) => task.id), ['today']);

const indexed = indexTasksByDate([
  { id: 'first', startTime: '2026-10-16T00:00:00' },
  { id: 'second', startTime: '2026-10-16T23:59:59' },
  { id: 'next', startTime: '2026-10-17T00:00:00' },
  { id: 'undated', startTime: '' },
  { id: 'invalid', startTime: '不是日期' },
] as any);
assert.deepEqual(indexed.get('2026-10-16')?.map(task => task.id), ['first', 'second']);
assert.deepEqual(indexed.get('2026-10-17')?.map(task => task.id), ['next']);
assert.equal(indexed.size, 2);
assert.equal(getTaskDateKey(''), null);
assert.equal(getTaskDateKey('不是日期'), null);
assert.equal(getTaskDateKey('2026-10-16T00:00:00'), '2026-10-16');
