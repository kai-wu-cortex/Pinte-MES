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
