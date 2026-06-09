import assert from 'node:assert/strict';
import { filterTasksByToday, isTaskOnDate } from './dateFilters';

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
