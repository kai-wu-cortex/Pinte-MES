import type { Task } from './types';

export interface FloorMachineGroup {
  machine: string;
  tasks: Task[];
  volume: number;
}

export function groupFloorMachines(tasks: Task[]): FloorMachineGroup[] {
  const groups = new Map<string, FloorMachineGroup>();
  for (const task of tasks) {
    const machine = task.machineName || '未分配机台';
    let group = groups.get(machine);
    if (!group) {
      group = { machine, tasks: [], volume: 0 };
      groups.set(machine, group);
    }
    group.tasks.push(task);
    group.volume += task.plannedQuantity || 0;
  }
  return [...groups.values()];
}

export function getFloorCapacity(width: number, height: number) {
  const columns = width >= 900 ? 3 : width >= 580 ? 2 : 1;
  const rows = Math.max(1, Math.min(4, Math.floor((height + 12) / 232)));
  return { columns, rows, pageSize: columns * rows };
}

/** Independent panels wrap at their own page count, so no records are dropped. */
export function getFloorPage<T>(items: T[], page: number, size: number): T[] {
  const pages = Math.max(1, Math.ceil(items.length / size));
  const start = ((page - 1) % pages) * size;
  return items.slice(start, start + size);
}
