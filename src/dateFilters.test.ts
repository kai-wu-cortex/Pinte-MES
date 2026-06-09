import assert from 'node:assert/strict';
import { isTaskOnDate } from './dateFilters';

const today = new Date('2026-06-10T12:00:00.000Z');

assert.equal(isTaskOnDate({ startTime: '2026-06-10T08:00:00.000Z' } as any, today), true);
assert.equal(isTaskOnDate({ startTime: '2026-06-09T08:00:00' } as any, today), false);
assert.equal(isTaskOnDate({ startTime: '' } as any, today), false);
assert.equal(isTaskOnDate({ startTime: '不是日期' } as any, today), false);
