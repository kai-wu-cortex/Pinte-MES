import React, { useState, useMemo } from 'react';
import { Task, CustomFieldConfig } from '../types';
import { DEFAULT_FIELD_CONFIG } from '../data';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, isSameMonth } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, LayoutGrid, Check, Settings2, FilterX } from 'lucide-react';
import { cn } from './MetricCard';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface CalendarViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onProcessCardClick: (task: Task) => void;
}

type FilterOperator = 'contains' | 'notContains' | 'equals' | 'notEquals' | 'startsWith' | 'endsWith' | 'isEmpty' | 'isNotEmpty';

interface FilterConfig {
  operator: FilterOperator;
  value: string;
}

const OPERATOR_LABELS: Record<FilterOperator, string> = {
  contains: '包含',
  notContains: '不包含',
  equals: '等于',
  notEquals: '不等于',
  startsWith: '开头是',
  endsWith: '结尾是',
  isEmpty: '为空',
  isNotEmpty: '不为空',
};

function matchesFilter(value: string, operator: FilterOperator, filterValue: string): boolean {
  const v = value.toLowerCase();
  const f = filterValue.toLowerCase();
  switch (operator) {
    case 'contains':
      return v.includes(f);
    case 'notContains':
      return !v.includes(f);
    case 'equals':
      return v === f;
    case 'notEquals':
      return v !== f;
    case 'startsWith':
      return v.startsWith(f);
    case 'endsWith':
      return v.endsWith(f);
    case 'isEmpty':
      return v === '';
    case 'isNotEmpty':
      return v !== '';
  }
}

export function CalendarView({ tasks, onTaskClick, onProcessCardClick }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useLocalStorage<'month' | 'week'>('mes_calendar_viewType', 'month');
  const [fieldConfig, setFieldConfig] = useLocalStorage<CustomFieldConfig[]>('mes_field_mapping_config', DEFAULT_FIELD_CONFIG);

  // Generate CALENDAR_FIELDS from field config
  const CALENDAR_FIELDS = useMemo((): { id: string; label: string }[] => {
    return fieldConfig
      .filter(field => field.visible)
      .map(field => ({
        id: field.fieldId,
        label: field.displayName,
      }));
  }, [fieldConfig]);

  // Initialize visible fields and intersect with fields marked as visible in fieldConfig
  // This ensures only fields marked visible in fieldConfig can be shown in the calendar view
  const fieldConfigVisibleIds = useMemo(() => {
    return new Set(fieldConfig.filter(f => f.visible).map(f => f.fieldId));
  }, [fieldConfig]);

  const [visibleFieldsArr, setVisibleFieldsArr] = useLocalStorage<string[]>(
    'mes_calendar_visibleFields',
    DEFAULT_FIELD_CONFIG.filter(field => field.visible).slice(0, 3).map(field => field.fieldId)
  );


  // Intersect: only keep fields that are both marked visible in fieldConfig AND selected in visibleFieldsArr
  const visibleFields = useMemo((): Set<string> => {
    return new Set(visibleFieldsArr.filter(id => fieldConfigVisibleIds.has(id)));
  }, [visibleFieldsArr, fieldConfigVisibleIds]);
  const [showFieldMenu, setShowFieldMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Migrate old filter format (string) to new format ({operator, value})
  const getInitialFilters = (): Record<string, FilterConfig> => {
    try {
      const item = window.localStorage.getItem('mes_calendar_filters');
      if (!item) return {};
      const parsed = JSON.parse(item);
      if (!parsed || typeof parsed === 'string' || Array.isArray(parsed)) {
        return {};
      }
      const result: Record<string, FilterConfig> = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === 'string') {
          result[key] = { operator: 'contains', value };
        } else {
          result[key] = value as FilterConfig;
        }
      }
      return result;
    } catch {
      return {};
    }
  };

  const [filters, setFilters] = useLocalStorage<Record<string, FilterConfig>>('mes_calendar_filters', getInitialFilters());

  const clearFilter = (fieldId: string) => {
    const newFilters = { ...filters };
    delete newFilters[fieldId];
    setFilters(newFilters);
  };

  // Apply all filters
  const filteredTasks = useMemo(() => {
    let result = tasks;
    const filterEntries = Object.entries(filters).filter(([_, config]) => {
      return config.operator === 'isEmpty' || config.operator === 'isNotEmpty' || config.value.trim() !== '';
    });
    if (filterEntries.length === 0) return result;

    return result.filter(task => {
      return filterEntries.every(([fieldId, config]) => {
        const { operator, value: filterValue } = config;
        const cellValue = String(task[fieldId as keyof Task] || '');
        return matchesFilter(cellValue, operator, filterValue);
      });
    });
  }, [tasks, filters]);

  const startDate = viewType === 'month'
    ? startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 }) 
    : startOfWeek(currentDate, { weekStartsOn: 1 });
  const endDate = viewType === 'month' 
    ? endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 }) 
    : endOfWeek(currentDate, { weekStartsOn: 1 });
    
  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const handlePrev = () => {
    setCurrentDate(prev => viewType === 'month' ? subMonths(prev, 1) : subWeeks(prev, 1));
  };

  const handleNext = () => {
    setCurrentDate(prev => viewType === 'month' ? addMonths(prev, 1) : addWeeks(prev, 1));
  };

  const toggleField = (id: string) => {
    // Only allow toggling fields that are marked as visible in fieldConfig
    if (!fieldConfigVisibleIds.has(id)) return;

    const next = new Set(visibleFields);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);
    } else {
      next.add(id);
    }
    setVisibleFieldsArr(Array.from(next) as string[]);
  };

  return (
    <div className="w-full h-full flex flex-col rounded-xl border border-blue-900/50 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex justify-between items-center px-4 py-3 border-b border-blue-900/50 bg-slate-800/50 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-900/50 rounded-lg p-1 border border-slate-700">
            <button 
              onClick={() => setViewType('month')}
              className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors", viewType === 'month' ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200")}
            >
              月视图
            </button>
            <button 
              onClick={() => setViewType('week')}
              className={cn("px-3 py-1 rounded-md text-xs font-medium transition-colors", viewType === 'week' ? "bg-blue-600 text-white" : "text-slate-400 hover:text-slate-200")}
            >
              周视图
            </button>
          </div>
          
          <div className="flex items-center gap-2">
            <button onClick={handlePrev} className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-slate-200 min-w-[100px] text-center">
              {format(currentDate, viewType === 'month' ? 'yyyy年 MM月' : 'yyyy年 MM月', { locale: zhCN })}
            </span>
            <button onClick={handleNext} className="p-1.5 hover:bg-slate-700 rounded-md text-slate-400 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Filter Menu */}
          <div className="relative">
            <button
              onClick={() => setShowFilterMenu(!showFilterMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
              筛选
              {Object.keys(filters).length > 0 && (
                <span className="bg-blue-500 text-white text-[10px] px-1 py-0.5 rounded-full">
                  {Object.keys(filters).length}
                </span>
              )}
            </button>
            {showFilterMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFilterMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-72 bg-slate-800 border border-blue-900/50 rounded-lg shadow-xl py-2 overflow-hidden max-h-80 overflow-y-auto">
                  {CALENDAR_FIELDS.map(field => {
                    const config = filters[field.id];
                    const currentValue = config?.value || '';
                    const currentOperator = config?.operator || 'contains';
                    return (
                      <div key={field.id} className="px-3 py-2">
                          <div className="flex gap-1.5 mb-1">
                          <select
                            value={currentOperator}
                            onChange={(e) => {
                              const operator = e.target.value as FilterOperator;
                              if (!currentValue && !['isEmpty', 'isNotEmpty'].includes(operator)) {
                                const newFilters = { ...filters };
                                delete newFilters[field.id];
                                setFilters(newFilters);
                              } else {
                                setFilters({ ...filters, [field.id]: { operator, value: currentValue } });
                              }
                            }}
                            className="w-24 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-blue-500"
                          >
                            {(Object.entries(OPERATOR_LABELS) as [FilterOperator, string][]).map(([op, label]) => (
                              <option key={op} value={op}>{label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="relative">
                          {!['isEmpty', 'isNotEmpty'].includes(currentOperator) && (
                            <input
                              type="text"
                              value={currentValue}
                              onChange={(e) => {
                                const value = e.target.value;
                                const operator = currentOperator;
                                if (value || operator === 'isEmpty' || operator === 'isNotEmpty') {
                                  setFilters({ ...filters, [field.id]: { operator, value } });
                                } else {
                                  const newFilters = { ...filters };
                                  delete newFilters[field.id];
                                  setFilters(newFilters);
                                }
                              }}
                              placeholder={`筛选${field.label}...`}
                              className={cn(
                                "w-full bg-slate-900 border rounded px-2 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500",
                                filters[field.id] ? "border-blue-400" : "border-slate-700"
                              )}
                            />
                          )}
                          {filters[field.id] && !['isEmpty', 'isNotEmpty'].includes(currentOperator) && (
                            <button
                              onClick={() => clearFilter(field.id)}
                              className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                              <FilterX className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Field Settings Menu */}
          <div className="relative">
            <button
              onClick={() => setShowFieldMenu(!showFieldMenu)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <Settings2 className="w-3.5 h-3.5" />
              显示设置
            </button>
            {showFieldMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFieldMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-slate-800 border border-blue-900/50 rounded-lg shadow-xl py-1 overflow-hidden">
                  {CALENDAR_FIELDS.map(field => (
                    <button
                      key={field.id}
                      onClick={() => toggleField(field.id)}
                      className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-between"
                    >
                      {field.label}
                      {visibleFields.has(field.id) && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[800px] h-full flex flex-col">
          {/* Days Header */}
          <div className="grid grid-cols-7 border-b border-blue-900/50 bg-slate-800/80 shrink-0">
            {['一', '二', '三', '四', '五', '六', '日'].map(day => (
              <div key={day} className="py-2 text-center text-xs font-medium text-slate-400">
                周{day}
              </div>
            ))}
          </div>
          
          {/* Days Grid */}
          <div className="flex-1 grid grid-cols-7 auto-rows-fr">
            {days.map((day, i) => {
              // Safe date parsing
              const dayTasks = filteredTasks.filter(t => {
                try {
                  return isSameDay(new Date(t.startTime), day);
                } catch {
                  return false;
                }
              });
              const isCurrentMonth = isSameMonth(day, currentDate);
              
              return (
                <div 
                  key={day.toISOString()} 
                  className={cn(
                    "border-b border-r border-blue-900/30 p-2 flex flex-col gap-1 min-h-[120px]",
                    !isCurrentMonth && "bg-slate-900/80 opacity-50",
                    i % 7 === 6 && "border-r-0"
                  )}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className={cn(
                      "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                      isSameDay(day, new Date()) ? "bg-blue-600 text-white" : "text-slate-400"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {dayTasks.length > 0 && (
                      <span className="text-[10px] text-slate-500">{dayTasks.length} 项</span>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 custom-scrollbar">
                    {dayTasks.map(task => (
                      <div
                        key={task.id}
                        onClick={() => onTaskClick(task)}
                        className="text-[10px] p-1.5 rounded border border-blue-900/30 bg-blue-900/10 text-slate-300 cursor-pointer hover:opacity-80 transition-opacity flex flex-col gap-0.5"
                      >
                        {/* Render fields dynamically based on visibleFields */}
                        {CALENDAR_FIELDS.filter(field => visibleFields.has(field.id)).map(field => {
                          const value = task[field.id as keyof Task];

                          // Special handling for id field with click handler
                          if (field.id === 'id') {
                            return (
                              <div
                                key={field.id}
                                className="font-mono font-bold cursor-pointer hover:underline"
                                onClick={(e) => { e.stopPropagation(); onProcessCardClick(task); }}
                              >
                                {value}
                              </div>
                            );
                          }

                          // Special handling for plannedQuantity to add 'm' suffix
                          if (field.id === 'plannedQuantity') {
                            return (
                              <div key={field.id} className="truncate text-slate-500">
                                {value}m
                              </div>
                            );
                          }

                          // Special handling for notes to allow wrapping
                          if (field.id === 'notes') {
                            return value ? (
                              <div key={field.id} className="text-slate-500 whitespace-normal break-words">
                                {value}
                              </div>
                            ) : null;
                          }

                          // Special handling for date fields
                          if (field.id === 'startTime' || field.id === 'endTime') {
                            try {
                              const dateValue = new Date(value as string);
                              return (
                                <div key={field.id} className="truncate text-slate-500">
                                  {format(dateValue, 'MM-dd HH:mm')}
                                </div>
                              );
                            } catch {
                              return null;
                            }
                          }

                          // Default rendering for all other fields
                          return value ? (
                            <div key={field.id} className="truncate text-slate-500">
                              {value}
                            </div>
                          ) : null;
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
