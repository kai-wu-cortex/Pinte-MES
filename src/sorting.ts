import { CustomFieldConfig, SortConfig, Task } from './types';

export const DEFAULT_SORT_CONFIG: SortConfig = {
  fieldId: 'startTime',
  direction: 'asc',
};

const NUMERIC_FIELDS = new Set(['plannedQuantity', 'actualOutput', 'slittingQuantity', 'shippedQuantity']);
const DATE_FIELDS = new Set(['startTime', 'endTime']);

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

  return [...tasks].sort((a, b) => {
    const aValue = getTaskSortValue(a, sortConfig.fieldId);
    const bValue = getTaskSortValue(b, sortConfig.fieldId);

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      if (aValue === bValue) return a.id.localeCompare(b.id, 'zh-CN', { numeric: true });
      return (aValue - bValue) * direction;
    }

    const compared = String(aValue).localeCompare(String(bValue), 'zh-CN', {
      numeric: true,
      sensitivity: 'base',
    });

    if (compared === 0) return a.id.localeCompare(b.id, 'zh-CN', { numeric: true });
    return compared * direction;
  });
}

export function getSortFieldOptions(fieldConfig: CustomFieldConfig[]) {
  return fieldConfig
    .filter(field => field.visible)
    .map(field => ({
      id: field.fieldId,
      label: field.displayName,
    }));
}
