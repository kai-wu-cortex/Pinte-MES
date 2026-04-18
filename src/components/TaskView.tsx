import React, { useState, useMemo } from 'react';
import { Task } from '../types';
import { cn } from './MetricCard';
import { format } from 'date-fns';
import { Clock, User, Settings, FileText, LayoutGrid, Settings2, Check, Hash, Box, Activity, ListTree, FilterX } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';

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

interface TaskViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onProcessCardClick: (task: Task) => void;
}

const TASK_FIELDS = [
  { id: 'id', label: '流程卡号', icon: Hash },
  { id: 'process', label: '工艺', icon: Settings },
  { id: 'machineName', label: '机台', icon: Settings },
  { id: 'productName', label: '品名颜色', icon: Box },
  { id: 'specification', label: '规格', icon: Box },
  { id: 'plannedQuantity', label: '预计数量/m', icon: Activity },
  { id: 'actualOutput', label: '实际产出', icon: Activity },
  { id: 'slittingQuantity', label: '分切数量', icon: Activity },
  { id: 'shippedQuantity', label: '实际出货数量', icon: Activity },
  { id: 'operator', label: '操作员', icon: User },
  { id: 'notes', label: '工艺备注', icon: FileText },
  { id: 'time', label: '计划时间', icon: Clock },
];

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onProcessCardClick: (url: string) => void;
  size: 'sm' | 'md' | 'lg';
  visibleFields: Set<string>;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, onProcessCardClick, size, visibleFields }) => {
  const sizeClasses = {
    sm: 'p-2 gap-1 text-[10px]',
    md: 'p-3 gap-2 text-xs',
    lg: 'p-4 gap-3 text-sm'
  };

  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  return (
    <div 
      onClick={onClick}
      className={cn("bg-slate-800/80 border border-slate-700 hover:border-blue-500/50 transition-all rounded-lg flex flex-col shadow-lg cursor-pointer hover:-translate-y-0.5", sizeClasses[size])}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {visibleFields.has('id') && (
              <span 
                className={cn("font-mono text-blue-400 bg-blue-900/20 px-1.5 py-0.5 rounded cursor-pointer hover:underline shrink-0", size === 'sm' ? 'text-[9px]' : size === 'md' ? 'text-[10px]' : 'text-xs')}
                onClick={(e) => { e.stopPropagation(); onProcessCardClick(task); }}
              >
                {task.id}
              </span>
            )}
            {visibleFields.has('process') && <span className={cn("text-slate-500 break-words", size === 'sm' ? 'text-[9px]' : size === 'md' ? 'text-[10px]' : 'text-xs')}>{task.process}</span>}
          </div>
          {visibleFields.has('productName') && <h4 className={cn("text-slate-200 font-medium break-words", size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base')} title={task.productName}>{task.productName}</h4>}
        </div>
      </div>
      
      <div className={cn("grid gap-1.5 mt-1", size === 'sm' ? 'grid-cols-1' : 'grid-cols-2')}>
        {visibleFields.has('machineName') && (
          <div className="flex items-center text-slate-400 gap-1.5">
            <Settings className={cn("shrink-0", iconSize)} />
            <span className="break-words">{task.machineName}</span>
          </div>
        )}
        {visibleFields.has('operator') && (
          <div className="flex items-center text-slate-400 gap-1.5">
            <User className={cn("shrink-0", iconSize)} />
            <span className="break-words">{task.operator}</span>
          </div>
        )}
        {visibleFields.has('specification') && (
          <div className="flex items-center text-slate-400 gap-1.5">
            <Box className={cn("shrink-0", iconSize)} />
            <span className="break-words">{task.specification}</span>
          </div>
        )}
        {visibleFields.has('plannedQuantity') && (
          <div className="flex items-center text-slate-400 gap-1.5">
            <Activity className={cn("shrink-0", iconSize)} />
            <span className="break-words">{task.plannedQuantity}m</span>
          </div>
        )}
        {visibleFields.has('time') && (
          <div className={cn("flex items-center text-slate-400 gap-1.5", size !== 'sm' && "col-span-2")}>
            <Clock className={cn("shrink-0", iconSize)} />
            <span className="break-words">{format(new Date(task.startTime), 'MM-dd HH:mm')} - {format(new Date(task.endTime), 'HH:mm')}</span>
          </div>
        )}
        {visibleFields.has('notes') && task.notes && (
          <div className={cn("flex items-center text-amber-400/80 gap-1.5", size !== 'sm' && "col-span-2")}>
            <FileText className={cn("shrink-0", iconSize)} />
            <span className="break-words">{task.notes}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function TaskView({ tasks, onTaskClick, onProcessCardClick }: TaskViewProps) {
  const [cardSize, setCardSize] = useLocalStorage<'sm' | 'md' | 'lg'>('mes_task_cardSize', 'md');
  const [visibleFieldsArr, setVisibleFieldsArr] = useLocalStorage<string[]>('mes_task_visibleFields', ['id', 'productName', 'machineName', 'operator', 'time']);
  const [groupBy, setGroupBy] = useLocalStorage<string>('mes_task_groupBy', 'none');
  const visibleFields = new Set(visibleFieldsArr);
  const [showFieldMenu, setShowFieldMenu] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showFilterMenu, setShowFilterMenu] = useState(false);

  // Migrate old filter format (string) to new format ({operator, value})
  const getInitialFilters = (): Record<string, FilterConfig> => {
    try {
      const item = window.localStorage.getItem('mes_task_filters');
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

  const [filters, setFilters] = useLocalStorage<Record<string, FilterConfig>>('mes_task_filters', getInitialFilters());

  const clearFilter = (fieldId: string) => {
    const newFilters = { ...filters };
    delete newFilters[fieldId];
    setFilters(newFilters);
  };

  // Apply all filters before grouping
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

  const toggleField = (id: string) => {
    const next = new Set(visibleFields);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);
    } else {
      next.add(id);
    }
    setVisibleFieldsArr(Array.from(next));
  };

  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') return { '所有任务': filteredTasks };

    return filteredTasks.reduce((acc, task) => {
      const key = String(task[groupBy as keyof Task] || '未分组');
      if (!acc[key]) acc[key] = [];
      acc[key].push(task);
      return acc;
    }, {} as Record<string, Task[]>);
  }, [tasks, groupBy]);

  const gridCols = {
    sm: 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8',
    md: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
    lg: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
  };

  const Toolbar = () => (
    <div className="flex justify-between items-center px-4 py-2 border-b border-blue-900/50 bg-slate-800/50 shrink-0">
      <div className="text-sm text-slate-400 font-medium">
        共 {filteredTasks.length} 条记录
      </div>
      <div className="flex items-center gap-3">
        {/* Filter Menu */}
        <div className="relative">
          <button
            onClick={() => { setShowFilterMenu(!showFilterMenu); setShowGroupMenu(false); setShowSizeMenu(false); setShowFieldMenu(false); }}
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
                {TASK_FIELDS.filter(f => f.id !== 'time').map(field => {
                  const config = filters[field.id];
                  const currentValue = config?.value || '';
                  const currentOperator = config?.operator || 'contains';
                  return (
                    <div key={field.id} className="px-3 py-2">
                      <label className="block text-xs text-slate-300 mb-1.5">{field.label}</label>
                      <div className="flex gap-1.5 mb-1.5">
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
                          className="w-28 bg-slate-900 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-slate-200 focus:outline-none focus:border-blue-500"
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
        {/* Group Menu */}
        <div className="relative">
          <button
            onClick={() => { setShowGroupMenu(!showGroupMenu); setShowSizeMenu(false); setShowFieldMenu(false); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <ListTree className="w-3.5 h-3.5" />
            分组: {groupBy === 'none' ? '无' : TASK_FIELDS.find(f => f.id === groupBy)?.label || groupBy}
          </button>
          {showGroupMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowGroupMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-slate-800 border border-blue-900/50 rounded-lg shadow-xl py-1 overflow-hidden">
                <button
                  onClick={() => { setGroupBy('none'); setShowGroupMenu(false); }}
                  className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-between"
                >
                  不分组
                  {groupBy === 'none' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                </button>
                {TASK_FIELDS.filter(f => f.id !== 'notes' && f.id !== 'time').map(field => (
                  <button
                    key={field.id}
                    onClick={() => { setGroupBy(field.id); setShowGroupMenu(false); }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-between"
                  >
                    {field.label}
                    {groupBy === field.id && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
        {/* Size Menu */}
        <div className="relative">
          <button 
            onClick={() => { setShowSizeMenu(!showSizeMenu); setShowGroupMenu(false); setShowFieldMenu(false); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            卡片大小
          </button>
          {showSizeMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowSizeMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-32 bg-slate-800 border border-blue-900/50 rounded-lg shadow-xl py-1 overflow-hidden">
                {[
                  { id: 'sm', label: '小' },
                  { id: 'md', label: '中' },
                  { id: 'lg', label: '大' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => { setCardSize(opt.id as any); setShowSizeMenu(false); }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-between"
                  >
                    {opt.label}
                    {cardSize === opt.id && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Field Menu */}
        <div className="relative">
          <button 
            onClick={() => { setShowFieldMenu(!showFieldMenu); setShowGroupMenu(false); setShowSizeMenu(false); }}
            className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors"
          >
            <Settings2 className="w-3.5 h-3.5" />
            显示设置
          </button>
          {showFieldMenu && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowFieldMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-slate-800 border border-blue-900/50 rounded-lg shadow-xl py-1 overflow-hidden">
                {TASK_FIELDS.map(field => (
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
  );

  return (
    <div className="flex flex-col h-full bg-slate-900/40 rounded-xl border border-blue-900/30 overflow-hidden">
      <Toolbar />
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-6">
          {Object.entries(groupedTasks as Record<string, Task[]>).map(([groupName, groupTasks]) => (
            <div key={groupName} className="space-y-3">
              {groupBy !== 'none' && (
                <h3 className="text-sm font-bold text-blue-100 bg-slate-800/50 px-3 py-1.5 rounded border border-blue-900/30">
                  {groupName} ({groupTasks.length})
                </h3>
              )}
              <div className={cn("grid gap-3", gridCols[cardSize as keyof typeof gridCols])}>
                {groupTasks.map(task => (
                  <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} onProcessCardClick={onProcessCardClick} size={cardSize as 'sm' | 'md' | 'lg'} visibleFields={visibleFields} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
