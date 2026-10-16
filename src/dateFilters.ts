import { isSameDay } from 'date-fns';
import { Task } from './types';

export function parseTaskDate(value: string): Date | null {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function isTaskOnDate(task: Task, date: Date): boolean {
  const taskDate = parseTaskDate(task.startTime);
  return taskDate ? isSameDay(taskDate, date) : false;
}

export function filterTasksByToday(tasks: Task[], filterToday: boolean, today: Date = new Date()): Task[] {
  return filterToday ? tasks.filter(task => isTaskOnDate(task, today)) : tasks;
}

export function getTaskDateKey(value: string): string | null {
  const date = parseTaskDate(value);
  if (!date) return null;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function indexTasksByDate(tasks: Task[]): Map<string, Task[]> {
  const days = new Map<string, Task[]>();
  for (const task of tasks) {
    const key = getTaskDateKey(task.startTime);
    if (!key) continue;
    const day = days.get(key);
    if (day) day.push(task);
    else days.set(key, [task]);
  }
  return days;
}
