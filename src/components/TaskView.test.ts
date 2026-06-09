import assert from 'node:assert/strict';
import { formatTaskPlanDate } from './TaskView';

assert.equal(formatTaskPlanDate('2026-06-10T08:30:00'), '06-10 08:30');
assert.equal(formatTaskPlanDate('不是日期'), '');
