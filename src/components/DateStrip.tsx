import React, { useEffect, useRef, useState } from 'react';
import { addMonths, eachDayOfInterval, endOfMonth, format, startOfMonth } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import type { Task } from '../types';
import { cn } from './MetricCard';

interface DateStripProps {
  selectedDate: string | null;
  today: string;
  tasksByDate: Map<string, Task[]>;
  onSelect: (date: string | null) => void;
}

export const DateStrip = React.memo(function DateStrip({ selectedDate, today, tasksByDate, onSelect }: DateStripProps) {
  const [month, setMonth] = useState(() => (selectedDate ?? today).slice(0, 7));
  const activeRef = useRef<HTMLButtonElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const monthDate = new Date(`${month}-01T00:00:00`);
  const days = eachDayOfInterval({ start: startOfMonth(monthDate), end: endOfMonth(monthDate) });

  useEffect(() => {
    setMonth((selectedDate ?? today).slice(0, 7));
  }, [selectedDate, today]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const centerSelectedDay = () => {
      const button = activeRef.current;
      if (button) rail.scrollLeft = button.offsetLeft - rail.clientWidth / 2 + button.clientWidth / 2;
    };
    centerSelectedDay();
    const observer = new ResizeObserver(centerSelectedDay);
    observer.observe(rail);
    return () => observer.disconnect();
  }, [month, selectedDate, today]);

  return (
    <section aria-label="生产日期" className="shrink-0 min-w-0 border-y border-slate-700/70 bg-slate-900/50">
      <div className="flex items-center gap-2 px-2 pt-2 text-xs">
        <CalendarDays className="h-4 w-4 shrink-0 text-cyan-300" />
        <input
          type="month" aria-label="选择月份" value={month}
          onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value)) setMonth(event.target.value); }}
          className="w-36 min-w-0 bg-transparent text-slate-200 [color-scheme:dark] focus:outline-none focus:ring-1 focus:ring-blue-400"
        />
        <span className="ml-auto text-slate-400 whitespace-nowrap">
          {selectedDate ? `${selectedDate} · ${tasksByDate.get(selectedDate)?.length ?? 0} 单` : '全部日期'}
        </span>
        <button type="button" title="回到今天" aria-label="回到今天" onClick={() => { setMonth(today.slice(0, 7)); onSelect(today); }} className="p-1.5 text-cyan-300 hover:bg-slate-800 rounded">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-stretch gap-1 px-1">
        <button type="button" title="上一月" aria-label="上一月" onClick={() => setMonth(format(addMonths(monthDate, -1), 'yyyy-MM'))} className="shrink-0 px-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div ref={railRef} className="relative flex flex-1 min-w-0 gap-1 overflow-x-auto py-2" aria-label="日期列表">
          {days.map(day => {
            const key = format(day, 'yyyy-MM-dd');
            const count = tasksByDate.get(key)?.length ?? 0;
            const selected = selectedDate === key;
            const isToday = today === key;
            return (
              <button
                key={key} type="button" ref={key === (selectedDate ?? today) ? activeRef : undefined}
                aria-label={`${key}，${count} 张生产单`} aria-pressed={selected}
                title={`${format(day, 'yyyy年M月d日 EEEE', { locale: zhCN })} · ${count} 单`}
                onClick={() => onSelect(key)}
                className={cn('flex h-[62px] w-[54px] shrink-0 flex-col items-center justify-center gap-0.5 rounded border text-xs tabular-nums transition-colors',
                  selected ? 'border-blue-400 bg-blue-500/20 text-white' : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-100',
                  isToday && !selected && 'border-cyan-700 text-cyan-200')}
              >
                <span className="text-[10px]">{isToday ? '今天' : format(day, 'EEE', { locale: zhCN })}</span>
                <span className="text-sm font-semibold leading-4">{format(day, 'dd')}</span>
                <span className={cn('text-[10px] leading-3', count ? 'text-emerald-300' : 'text-slate-600')}>{count} 单</span>
              </button>
            );
          })}
        </div>
        <button type="button" title="下一月" aria-label="下一月" onClick={() => setMonth(format(addMonths(monthDate, 1), 'yyyy-MM'))} className="shrink-0 px-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  );
});
