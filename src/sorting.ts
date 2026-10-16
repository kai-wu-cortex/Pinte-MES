import { CustomFieldConfig, SortConfig, Task } from './types';

export const DEFAULT_SORT_CONFIG: SortConfig = {
  fieldId: 'startTime',
  direction: 'asc',
};

const NUMERIC_FIELDS = new Set(['plannedQuantity', 'actualOutput', 'slittingQuantity', 'shippedQuantity']);
const DATE_FIELDS = new Set(['startTime', 'endTime']);
const textCollator = new Intl.Collator('zh-CN', { numeric: true, sensitivity: 'base' });
const idCollator = new Intl.Collator('zh-CN', { numeric: true });

export function getTaskSortValue(task: Task, fieldId: string): string | number {
  const value = task[fieldId as keyof Task];

  if (DATE_FIELDS.has(fieldId)) {
    if (!value) return 0;
    const time = new Date(String(value)).getTime();
    return Number.isNaN(time) ? 0 : time;
  }

  if (NUMERIC_FIELDS.has(fieldId)) {
    const numberValue = Number(value);
    return Number.isNaN(numberValue) ? 0 : numberValue;
  }

  return String(value ?? '').trim();
}

export function sortTasks(tasks: Task[], sortConfig: SortConfig): Task[] {
  const direction = sortConfig.direction === 'asc' ? 1 : -1;

  return tasks.map(task => ({ task, value: getTaskSortValue(task, sortConfig.fieldId) })).sort((a, b) => {
    const aValue = a.value;
    const bValue = b.value;

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      if (aValue === bValue) return idCollator.compare(a.task.id, b.task.id);
      return (aValue - bValue) * direction;
    }

    const compared = textCollator.compare(String(aValue), String(bValue));

    if (compared === 0) return idCollator.compare(a.task.id, b.task.id);
    return compared * direction;
  }).map(entry => entry.task);
}

export function getSortFieldOptions(fieldConfig: CustomFieldConfig[]) {
  return fieldConfig
    .filter(field => field.visible)
    .map(field => ({
      id: field.fieldId,
      label: field.displayName,
    }));
}
