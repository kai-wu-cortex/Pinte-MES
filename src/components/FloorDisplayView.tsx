import React, { useMemo, useState } from 'react';
import { format, isToday } from 'date-fns';
import { AlertTriangle, ArrowDownAZ, ArrowUpAZ, CalendarClock, Check, FileSpreadsheet, Gauge, MonitorUp, Settings2 } from 'lucide-react';
import { CustomFieldConfig, SortDirection, Task } from '../types';
import { DEFAULT_FIELD_CONFIG } from '../data';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { cn } from './MetricCard';

interface FloorDisplayViewProps {
  tasks: Task[];
  metrics: {
    totalOrders: number;
    todayCount: number;
    todayVolume: number;
  };
  currentTime: string;
  sortLabel: string;
  sortDirection: SortDirection;
  onTaskClick: (task: Task) => void;
  onProcessCardClick: (task: Task) => void;
}

const FLOOR_CARD_DEFAULT_FIELDS = ['id', 'process', 'machineName', 'productName', 'specification', 'plannedQuantity', 'startTime', 'notes'];

function formatPlanTime(value: string): string {
  if (!value) return '未排期';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '未排期';
  return format(date, 'MM-dd HH:mm');
}

function getProcessTone(process: string) {
  if (process.includes('涂布')) return 'border-blue-400/40 bg-blue-500/10 text-blue-100';
  if (process.includes('模压')) return 'border-amber-400/40 bg-amber-500/10 text-amber-100';
  if (process.includes('分切')) return 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100';
  return 'border-cyan-400/40 bg-cyan-500/10 text-cyan-100';
}

function formatFieldValue(task: Task, fieldId: string): string {
  if (fieldId === 'startTime' || fieldId === 'endTime') return formatPlanTime(String(task[fieldId] || ''));
  if (fieldId === 'plannedQuantity') return `${task.plannedQuantity || 0}m`;
  return String(task[fieldId as keyof Task] ?? '');
}

const ProductionCard: React.FC<{
  task: Task;
  index: number;
  fields: { id: string; label: string }[];
  onTaskClick: (task: Task) => void;
  onProcessCardClick: (task: Task) => void;
}> = ({ task, index, fields, onTaskClick, onProcessCardClick }) => {
  const hasNote = Boolean(task.notes?.trim());
  const showId = fields.some(field => field.id === 'id');
  const showProcess = fields.some(field => field.id === 'process');
  const showProduct = fields.some(field => field.id === 'productName');
  const showNotes = fields.some(field => field.id === 'notes');
  const secondaryFields = fields.filter(field => !['id', 'process', 'productName', 'notes'].includes(field.id));

  return (
    <div
      onClick={() => onTaskClick(task)}
      className="min-h-[150px] cursor-pointer overflow-hidden rounded-lg border border-slate-700/70 bg-slate-950/65 p-3 hover:border-cyan-300/50 hover:bg-slate-900 flex flex-col gap-2"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-slate-500">{String(index + 1).padStart(2, '0')}</span>
            {showId && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onProcessCardClick(task);
                }}
                className="truncate font-mono text-sm font-bold text-cyan-200 hover:underline"
              >
                {task.id}
              </button>
            )}
          </div>
          {showProduct && (
            <div className="mt-1 truncate text-base font-semibold text-slate-50" title={task.productName}>
              {task.productName || '-'}
            </div>
          )}
        </div>
        {showProcess && (
          <span className={cn('shrink-0 rounded border px-2 py-0.5 text-xs font-medium', getProcessTone(task.process))}>
            {task.process || '工艺'}
          </span>
        )}
      </div>

      {secondaryFields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
          {secondaryFields.map(field => (
            <div key={field.id} className={cn('min-w-0', field.id === 'specification' && 'col-span-2')}>
              <span className="block text-[9px] text-slate-500">{field.label}</span>
              <span className="block truncate font-medium text-slate-200" title={formatFieldValue(task, field.id)}>
                {formatFieldValue(task, field.id) || '-'}
              </span>
            </div>
          ))}
        </div>
      )}

      {showNotes && (
        <div className={cn('mt-auto rounded border px-2 py-1 text-[11px]', hasNote ? 'border-amber-300/25 bg-amber-400/10 text-amber-100' : 'border-slate-800 bg-slate-900/70 text-slate-500')}>
          <span className="line-clamp-2">{hasNote ? task.notes : '无工艺备注'}</span>
        </div>
      )}
    </div>
  );
};

export function FloorDisplayView({ tasks, metrics, currentTime, sortLabel, sortDirection, onTaskClick, onProcessCardClick }: FloorDisplayViewProps) {
  const [fieldConfig] = useLocalStorage<CustomFieldConfig[]>('mes_field_mapping_config', DEFAULT_FIELD_CONFIG);
  const [showFieldMenu, setShowFieldMenu] = useState(false);
  const [visibleFieldsArr, setVisibleFieldsArr] = useLocalStorage<string[]>('mes_floor_visibleFields', FLOOR_CARD_DEFAULT_FIELDS);

  const floorFields = useMemo(() => {
    const fields = fieldConfig
      .filter(field => field.visible)
      .map(field => ({ id: field.fieldId, label: field.displayName }));
    return fields.length > 0 ? fields : DEFAULT_FIELD_CONFIG.map(field => ({ id: field.fieldId, label: field.displayName }));
  }, [fieldConfig]);

  const fieldIds = useMemo<Set<string>>(() => new Set(floorFields.map(field => field.id)), [floorFields]);
  const visibleFields = useMemo<Set<string>>(() => new Set(visibleFieldsArr.filter(id => fieldIds.has(id))), [visibleFieldsArr, fieldIds]);
  const visibleCardFields = useMemo(() => floorFields.filter(field => visibleFields.has(field.id)), [floorFields, visibleFields]);

  const todayTasks = useMemo(() => {
    return tasks.filter(task => {
      const date = new Date(task.startTime);
      return !Number.isNaN(date.getTime()) && isToday(date);
    });
  }, [tasks]);

  const displayTasks = useMemo(() => todayTasks.slice(0, 24), [todayTasks]);

  const machineGroups = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    tasks.forEach(task => {
      const key = task.machineName || '未分配机台';
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });

    return Object.entries(groups)
      .map(([machine, machineTasks]) => ({ machine, tasks: machineTasks.slice(0, 6), count: machineTasks.length }))
      .slice(0, 8);
  }, [tasks]);

  const noteTasks = useMemo(() => tasks.filter(task => task.notes?.trim()).slice(0, 12), [tasks]);

  const toggleField = (id: string) => {
    const next = new Set<string>(visibleFields);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);
    } else {
      next.add(id);
    }
    setVisibleFieldsArr(Array.from(next));
  };

  return (
    <div className="h-full min-h-0 flex flex-col gap-2 overflow-hidden bg-slate-950 text-slate-100">
      <div className="shrink-0 flex items-center justify-between gap-3 rounded-lg border border-cyan-400/25 bg-slate-900/80 px-4 py-3">
        <div className="min-w-[14rem]">
          <div className="flex items-center gap-3">
            <MonitorUp className="w-6 h-6 text-cyan-300" />
            <h2 className="whitespace-nowrap text-xl 2xl:text-2xl font-bold tracking-wide text-slate-50">生产执行大屏</h2>
            <span className="rounded border border-cyan-300/30 bg-cyan-300/10 px-2 py-0.5 text-xs font-mono text-cyan-100">
              排序: {sortLabel} {sortDirection === 'asc' ? '升序' : '降序'}
            </span>
          </div>
          <p className="mt-1 max-w-xl text-xs text-slate-400">按当前筛选和排序生成当日生产卡片，突出机台负载和工艺备注。</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-right">
          <div className="rounded border border-slate-700 bg-slate-950/70 px-3 py-2">
            <div className="text-[10px] text-slate-500">当前时间</div>
            <div className="font-mono text-lg text-cyan-200">{currentTime}</div>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <MetricBox label="生产单" value={metrics.totalOrders} />
            <MetricBox label="今日单数" value={metrics.todayCount} />
            <MetricBox label="今日米数" value={`${metrics.todayVolume}m`} />
          </div>
        </div>
      </div>

      <div className="grid flex-1 min-h-0 grid-cols-1 xl:grid-cols-[1.55fr_1fr] gap-2 overflow-y-auto xl:overflow-hidden">
        <section className="min-h-0 flex flex-col rounded-lg border border-slate-700/70 bg-slate-900/55 overflow-hidden">
          <div className="shrink-0 flex items-center justify-between border-b border-slate-700/70 px-3 py-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-cyan-300" />
              <h3 className="text-sm font-bold text-slate-100">当日生产队列</h3>
              <span className="text-xs text-slate-500">显示 {displayTasks.length} / {todayTasks.length} 单</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowFieldMenu(!showFieldMenu)}
                  className="flex items-center gap-1 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-xs text-slate-200 hover:border-cyan-300/50"
                >
                  <Settings2 className="w-3.5 h-3.5" />
                  字段
                </button>
                {showFieldMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowFieldMenu(false)} />
                    <div className="absolute right-0 top-full z-50 mt-1 max-h-72 w-44 overflow-y-auto rounded-lg border border-blue-900/50 bg-slate-800 py-1 shadow-xl">
                      {floorFields.map(field => (
                        <button
                          key={field.id}
                          onClick={() => toggleField(field.id)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-slate-300 hover:bg-slate-700 hover:text-white"
                        >
                          {field.label}
                          {visibleFields.has(field.id) && <Check className="w-3.5 h-3.5 text-blue-400" />}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {sortDirection === 'asc' ? <ArrowUpAZ className="w-4 h-4 text-cyan-300" /> : <ArrowDownAZ className="w-4 h-4 text-cyan-300" />}
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {displayTasks.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2 content-start">
                {displayTasks.map((task, index) => (
                  <ProductionCard
                    key={task.id}
                    task={task}
                    index={index}
                    fields={visibleCardFields}
                    onTaskClick={onTaskClick}
                    onProcessCardClick={onProcessCardClick}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded border border-slate-800 text-sm text-slate-500">
                当日暂无生产安排
              </div>
            )}
          </div>
        </section>

        <aside className="min-h-[480px] xl:min-h-0 grid grid-rows-[1fr_0.95fr] gap-2">
          <section className="min-h-0 rounded-lg border border-slate-700/70 bg-slate-900/55 overflow-hidden">
            <PanelHeader icon={<Gauge className="w-4 h-4 text-emerald-300" />} title="机台生产安排" count={`${machineGroups.length} 组`} />
            <div className="h-full overflow-y-auto p-2 space-y-2 pb-12">
              {machineGroups.map(group => (
                <div key={group.machine} className="rounded border border-slate-700/70 bg-slate-950/55 p-2">
                  <div className="mb-1.5 flex items-center justify-between">
                    <span className="font-semibold text-slate-100">{group.machine}</span>
                    <span className="text-[10px] text-slate-500">共 {group.count} 单</span>
                  </div>
                  <div className="space-y-1">
                    {group.tasks.map(task => (
                      <button
                        key={task.id}
                        onClick={() => onTaskClick(task)}
                        className="grid w-full grid-cols-[5.8rem_minmax(0,1fr)_4.5rem] gap-2 rounded bg-slate-900 px-2 py-1 text-left text-[11px] hover:bg-slate-800"
                      >
                        <span className="font-mono text-cyan-200 truncate">{task.id}</span>
                        <span className="text-slate-300 truncate">{task.productName}</span>
                        <span className="font-mono text-slate-500 text-right">{formatPlanTime(task.startTime)}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="min-h-0 rounded-lg border border-slate-700/70 bg-slate-900/55 overflow-hidden">
            <PanelHeader icon={<AlertTriangle className="w-4 h-4 text-amber-300" />} title="工艺备注" count={`${noteTasks.length} 条备注`} />
            <div className="h-full min-h-0 overflow-y-auto p-2 pb-12 space-y-1.5">
              {noteTasks.map(task => (
                <button key={task.id} onClick={() => onTaskClick(task)} className="block w-full rounded border border-amber-300/20 bg-amber-400/10 px-2 py-1.5 text-left text-[11px] hover:border-amber-300/50">
                  <span className="font-mono text-amber-100">{task.id}</span>
                  <span className="ml-2 text-slate-300">{task.machineName}</span>
                  <span className="ml-2 text-slate-500">{formatPlanTime(task.startTime)}</span>
                  <span className="block truncate text-amber-200/85">{task.notes}</span>
                </button>
              ))}
              {noteTasks.length === 0 && <div className="flex h-24 items-center justify-center rounded border border-slate-800 text-xs text-slate-500">暂无工艺备注</div>}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function MetricBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-24 rounded border border-slate-700 bg-slate-950/70 px-3 py-2">
      <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500">
        <FileSpreadsheet className="w-3 h-3" />
        {label}
      </div>
      <div className="font-mono text-lg font-bold text-slate-100">{value}</div>
    </div>
  );
}

function PanelHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-700/70 px-3 py-2">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-bold text-slate-100">{title}</h3>
      </div>
      <span className="text-[10px] text-slate-500">{count}</span>
    </div>
  );
}
