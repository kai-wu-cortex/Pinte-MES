import assert from 'node:assert/strict';
import { getFloorCapacity, getFloorPage, groupFloorMachines } from './floorDisplay';
import type { Task } from './types';

const tasks = [
  { id: 'same-card', machineName: 'T1', plannedQuantity: 1000 },
  { id: 'same-card', machineName: 'T1', plannedQuantity: 19000 },
  { id: '', machineName: 'T2', plannedQuantity: 6000 },
  { id: '', machineName: '', plannedQuantity: 3000 },
] as Task[];
const grouped = groupFloorMachines(tasks);
assert.equal(grouped.length, 3);
assert.equal(grouped[0].volume, 20000);
assert.deepEqual(grouped[0].tasks, tasks.slice(0, 2));
assert.equal(grouped[2].machine, '未分配机台');
assert.deepEqual(getFloorCapacity(1200, 720), { columns: 3, rows: 3, pageSize: 9 });
assert.deepEqual(getFloorCapacity(650, 500), { columns: 2, rows: 2, pageSize: 4 });
assert.deepEqual(getFloorCapacity(350, 180), { columns: 1, rows: 1, pageSize: 1 });

const records = Array.from({ length: 37 }, (_, index) => index);
assert.deepEqual(Array.from({ length: 5 }, (_, page) => getFloorPage(records, page + 1, 9)).flat(), records);
assert.deepEqual(getFloorPage(records, 6, 9), records.slice(0, 9));
assert.deepEqual(getFloorPage([], 3, 9), []);
assert.deepEqual(getFloorPage(tasks, 4, 2), tasks.slice(2));
console.log('floorDisplay tests passed');
