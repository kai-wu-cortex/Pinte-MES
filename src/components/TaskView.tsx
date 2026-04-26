import React, { useState, useMemo } from 'react';
import { Task, CustomFieldConfig } from '../types';
import { DEFAULT_FIELD_CONFIG } from '../data';
import { cn } from './MetricCard';
import { format } from 'date-fns';
import { Calendar, Clock, User, Settings, FileText, LayoutGrid, Settings2, Check, Hash, Box, Activity, ListTree } from 'lucide-react';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface TaskViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onProcessCardClick: (task: Task) => void;
}

// Helper to get icon for a field
function getFieldIcon(fieldId: string) {
  const iconMap: Record<string, any> = {
    startTime: Calendar,
    id: Hash,
    process: Settings,
    machineName: Settings,
    productName: Box,
    specification: Box,
    plannedQuantity: Activity,
    actualOutput: Activity,
    slittingQuantity: Activity,
    shippedQuantity: Activity,
    notes: FileText,
    operator: User,
  };
  return iconMap[fieldId] || Box;
}

interface TaskField {
  id: string;
  label: string;
  icon: any;
}

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onProcessCardClick: (url: string) => void;
  size: 'sm' | 'md' | 'lg';
  visibleFields: Set<string>;
  taskFields: TaskField[];
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, onProcessCardClick, size, visibleFields, taskFields }) => {
  const sizeClasses = {
    sm: 'p-2 gap-1 text-[10px]',
    md: 'p-3 gap-2 text-xs',
    lg: 'p-4 gap-3 text-sm'
  };

  const iconSize = size === 'sm' ? 'w-3 h-3' : size === 'md' ? 'w-3.5 h-3.5' : 'w-4 h-4';

  // Render field value with special handling for certain fields
  const renderFieldValue = (fieldId: string) => {
    if (fieldId === 'id') {
      return (
        <span
          className={cn("font-mono text-blue-400 bg-blue-900/20 px-1.5 py-0.5 rounded cursor-pointer hover:underline shrink-0", size === 'sm' ? 'text-[9px]' : size === 'md' ? 'text-[10px]' : 'text-xs')}
          onClick={(e) => { e.stopPropagation(); onProcessCardClick(task); }}
        >
          {task.id}
        </span>
      );
    }

    if (fieldId === 'startTime') {
      return (
        <span className="break-words">
          {(() => {
            try {
              return format(new Date(task.startTime), 'MM-dd HH:mm');
            } catch {
              return '';
            }
          })()}
          {task.endTime && ` - ${(() => {
            try {
              return format(new Date(task.endTime), 'HH:mm');
            } catch {
              return '';
            }
          })()}`}
        </span>
      );
    }

    if (fieldId === 'notes') {
      return <span className="break-words">{task.notes || ''}</span>;
    }

    return <span className="break-words">{task[fieldId as keyof Task] || ''}</span>;
  };

  // Split fields into header fields (id, process, productName) and body fields
  const headerFieldIds = ['id', 'process', 'productName'];
  const headerFields = taskFields.filter(f => headerFieldIds.includes(f.id) && visibleFields.has(f.id));
  const bodyFields = taskFields.filter(f => !headerFieldIds.includes(f.id) && visibleFields.has(f.id));

  // Get field icon component
  const getIcon = (fieldId: string) => {
    const field = taskFields.find(f => f.id === fieldId);
    return field?.icon || Box;
  };

  return (
    <div
      onClick={onClick}
      className={cn("bg-slate-800/80 border border-slate-700 hover:border-blue-500/50 transition-all rounded-lg flex flex-col shadow-lg cursor-pointer hover:-translate-y-0.5", sizeClasses[size])}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {visibleFields.has('id') && renderFieldValue('id')}
            {visibleFields.has('process') && <span className={cn("text-slate-500 break-words", size === 'sm' ? 'text-[9px]' : size === 'md' ? 'text-[10px]' : 'text-xs')}>{task.process}</span>}
          </div>
          {visibleFields.has('productName') && <h4 className={cn("text-slate-200 font-medium break-words", size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base')} title={task.productName}>{task.productName}</h4>}
        </div>
      </div>

      <div className={cn("grid gap-1.5 mt-1", size === 'sm' ? 'grid-cols-1' : 'grid-cols-2')}>
        {bodyFields.map(field => {
          const Icon = getIcon(field.id);
          const isFullWidth = field.id === 'startTime' || field.id === 'notes';
          const isNotes = field.id === 'notes';

          if (isNotes && !task.notes) return null;

          return (
            <div
              key={field.id}
              className={cn(
                "flex items-center gap-1.5",
                isNotes ? "text-amber-400/80" : "text-slate-400",
                size !== 'sm' && isFullWidth && "col-span-2"
              )}
            >
              <Icon className={cn("shrink-0", iconSize)} />
              {renderFieldValue(field.id)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TaskView({ tasks, onTaskClick, onProcessCardClick }: TaskViewProps) {
  const [fieldConfig, setFieldConfig] = useLocalStorage<CustomFieldConfig[]>('mes_field_mapping_config', DEFAULT_FIELD_CONFIG);
  const [cardSize, setCardSize] = useLocalStorage<'sm' | 'md' | 'lg'>('mes_task_cardSize', 'md');

  // Generate TASK_FIELDS from field config
  const TASK_FIELDS = useMemo(() => {
    return fieldConfig
      .filter(field => field.visible)
      .map(field => ({
        id: field.fieldId,
        label: field.displayName,
        icon: getFieldIcon(field.fieldId),
      }));
  }, [fieldConfig]);

  // Initialize visible fields and intersect with fields marked as visible in fieldConfig
  // This ensures only fields marked visible in fieldConfig can be shown in the task view
  const fieldConfigVisibleIds = useMemo(() => {
    return new Set(fieldConfig.filter(f => f.visible).map(f => f.fieldId));
  }, [fieldConfig]);

  const [visibleFieldsArr, setVisibleFieldsArr] = useLocalStorage<string[]>('mes_task_visibleFields', (TASK_FIELDS.map(f => f.id) as unknown) as string[]);

  // Intersect: only keep fields that are both marked visible in fieldConfig AND selected in visibleFieldsArr
  const visibleFields = useMemo((): Set<string> => {
    return new Set(visibleFieldsArr.filter(id => fieldConfigVisibleIds.has(id)));
  }, [visibleFieldsArr, fieldConfigVisibleIds]);

  const [groupBy, setGroupBy] = useLocalStorage<string>('mes_task_groupBy', 'none');
  const [showFieldMenu, setShowFieldMenu] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);

  const toggleField = (id: string) => {
    // Only allow toggling fields that are marked as visible in fieldConfig
    if (!fieldConfigVisibleIds.has(id)) return;

    const next = new Set<string>(visibleFields);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);
    } else {
      next.add(id);
    }
    setVisibleFieldsArr(Array.from(next));
  };

  const groupedTasks = useMemo(() => {
    if (groupBy === 'none') return { '所有任务': tasks };

    return tasks.reduce((acc, task) => {
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
        共 {tasks.length} 条记录
      </div>
      <div className="flex items-center gap-3">
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
                {TASK_FIELDS.filter(f => f.id !== 'notes').map(field => (
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
                  <TaskCard key={task.id} task={task} onClick={() => onTaskClick(task)} onProcessCardClick={onProcessCardClick} size={cardSize as 'sm' | 'md' | 'lg'} visibleFields={visibleFields} taskFields={TASK_FIELDS} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
