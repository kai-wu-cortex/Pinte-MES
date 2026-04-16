import React, { useState } from 'react';
import { Task } from '../types';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, startOfMonth, endOfMonth, isSameDay, addMonths, subMonths, addWeeks, subWeeks, isSameMonth } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, LayoutGrid, Check, Settings2 } from 'lucide-react';
import { cn } from './MetricCard';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useLocalStorage } from '../hooks/useLocalStorage';

interface CalendarViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onProcessCardClick: (url: string) => void;
  isAutoScrolling?: boolean;
}

const CALENDAR_FIELDS = [
  { id: 'id', label: '流程卡号' },
  { id: 'productName', label: '品名颜色' },
  { id: 'machineName', label: '机台' },
  { id: 'operator', label: '操作员' },
  { id: 'plannedQuantity', label: '预计数量' },
  { id: 'notes', label: '工艺备注' },
];

export function CalendarView({ tasks, onTaskClick, onProcessCardClick, isAutoScrolling = false }: CalendarViewProps) {
  const scrollRef = useAutoScroll(isAutoScrolling);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useLocalStorage<'month' | 'week'>('mes_calendar_viewType', 'month');
  const [visibleFieldsArr, setVisibleFieldsArr] = useLocalStorage<string[]>('mes_calendar_visibleFields', ['id', 'productName', 'machineName']);
  const visibleFields = new Set(visibleFieldsArr);
  const [showFieldMenu, setShowFieldMenu] = useState(false);

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
    const next = new Set(visibleFields);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);
    } else {
      next.add(id);
    }
    setVisibleFieldsArr(Array.from(next));
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
      <div className="flex-1 overflow-auto" ref={scrollRef}>
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
              const dayTasks = tasks.filter(t => isSameDay(new Date(t.startTime), day));
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
                        {visibleFields.has('id') && (
                          <div 
                            className="font-mono font-bold cursor-pointer hover:underline"
                            onClick={(e) => { e.stopPropagation(); onProcessCardClick(task.fileUrl || ''); }}
                          >
                            {task.id}
                          </div>
                        )}
                        {visibleFields.has('productName') && <div className="truncate">{task.productName}</div>}
                        {visibleFields.has('machineName') && <div className="truncate text-slate-500">{task.machineName}</div>}
                        {visibleFields.has('operator') && <div className="truncate text-slate-500">{task.operator}</div>}
                        {visibleFields.has('plannedQuantity') && <div className="truncate text-slate-500">{task.plannedQuantity}m</div>}
                        {visibleFields.has('notes') && <div className="text-slate-500 whitespace-normal break-words">{task.notes}</div>}
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
