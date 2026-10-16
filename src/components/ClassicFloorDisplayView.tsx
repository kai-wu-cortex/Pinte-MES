import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { AlertTriangle, ArrowDownAZ, ArrowUpAZ, CalendarClock, Check, ChevronLeft, ChevronRight, FileSpreadsheet, Gauge, MonitorUp, Pause, Play, Settings2 } from 'lucide-react';
import { CustomFieldConfig, SortDirection, Task } from '../types';
import { DEFAULT_FIELD_CONFIG } from '../data';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { cn } from './MetricCard';
import { getTaskDateKey } from '../dateFilters';
import { getFloorPage, groupFloorMachines, type FloorMachineGroup } from '../floorDisplay';

interface FloorDisplayViewProps {
  tasks: Task[];
  fieldConfig: CustomFieldConfig[];
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
  if (process.includes('涂布')) return 'border-blue-400/50 bg-blue-500/15 text-blue-100 shadow-[0_0_8px_rgba(59,130,246,0.15)]';
  if (process.includes('模压')) return 'border-amber-400/50 bg-amber-500/15 text-amber-100 shadow-[0_0_8px_rgba(245,158,11,0.15)]';
  if (process.includes('分切')) return 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100 shadow-[0_0_8px_rgba(16,185,129,0.15)]';
  return 'border-cyan-400/50 bg-cyan-500/15 text-cyan-100 shadow-[0_0_8px_rgba(6,182,212,0.15)]';
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
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.04, 0.6) }}
      onClick={() => onTaskClick(task)}
      data-classic-floor-card
      className="group min-h-[140px] cursor-pointer overflow-hidden rounded-lg border border-slate-700/60 bg-gradient-to-br from-slate-900/80 to-slate-950/90 p-3.5 hover:border-cyan-300/40 hover:shadow-[0_0_20px_rgba(6,182,212,0.08)] transition-all duration-300 flex flex-col gap-2.5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] text-slate-500/80">{String(index + 1).padStart(2, '0')}</span>
            {showId && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onProcessCardClick(task);
                }}
                className="truncate font-mono text-sm font-bold text-cyan-200 group-hover:text-cyan-100 transition-colors"
              >
                {task.id || '未填卡号'}
              </button>
            )}
          </div>
          {showProduct && (
            <div className="mt-1.5 truncate text-[15px] font-semibold text-slate-50 group-hover:text-white transition-colors" title={task.productName}>
              {task.productName || '-'}
            </div>
          )}
        </div>
        {showProcess && (
          <span className={cn('shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider', getProcessTone(task.process))}>
            {task.process || '工艺'}
          </span>
        )}
      </div>

      {secondaryFields.length > 0 && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] mt-auto">
          {secondaryFields.map(field => (
            <div key={field.id} className={cn('min-w-0', field.id === 'specification' && 'col-span-2')}>
              <span className="block text-[9px] text-slate-500/70 uppercase tracking-wider mb-0.5">{field.label}</span>
              <span className="block truncate font-medium text-slate-200/90" title={formatFieldValue(task, field.id)}>
                {formatFieldValue(task, field.id) || '-'}
              </span>
            </div>
          ))}
        </div>
      )}

      {showNotes && (
        <div className={cn(
          'rounded-md border px-2.5 py-1.5 text-[11px] transition-colors',
          hasNote
            ? 'border-amber-300/30 bg-amber-400/8 text-amber-100/90'
            : 'border-slate-700/40 bg-slate-800/40 text-slate-500/60'
        )}>
          <span className="line-clamp-2">{hasNote ? task.notes : '无工艺备注'}</span>
        </div>
      )}
    </motion.div>
  );
};

export function ClassicFloorDisplayView({ tasks, fieldConfig, metrics, currentTime, sortLabel, sortDirection, onTaskClick: onOpenTask, onProcessCardClick: onOpenCard }: FloorDisplayViewProps) {
  const [showFieldMenu, setShowFieldMenu] = useState(false);
  const [visibleFieldsArr, setVisibleFieldsArr] = useLocalStorage<string[]>('mes_floor_visibleFields', FLOOR_CARD_DEFAULT_FIELDS);
  const [page, setPage] = useState(1);
  const [playing, setPlaying] = useLocalStorage<boolean>('mes_floor_autoRotate', true);
  const [savedInterval, setIntervalSeconds] = useLocalStorage<number>('mes_floor_rotateSeconds', 20);
  const intervalSeconds = [10, 20, 30, 60].includes(savedInterval) ? savedInterval : 20;
  const todayKey = currentTime.slice(0, 10);
  const onTaskClick = (task: Task) => { setPlaying(false); onOpenTask(task); };
  const onProcessCardClick = (task: Task) => { setPlaying(false); onOpenCard(task); };

  const floorFields = useMemo(() => {
    const fields = fieldConfig
      .filter(field => field.visible)
      .map(field => ({ id: field.fieldId, label: field.displayName }));
    return fields.length > 0 ? fields : DEFAULT_FIELD_CONFIG.map(field => ({ id: field.fieldId, label: field.displayName }));
  }, [fieldConfig]);

  const fieldIds = useMemo<Set<string>>(() => new Set(floorFields.map(field => field.id)), [floorFields]);
  const visibleFields = useMemo<Set<string>>(() => new Set(visibleFieldsArr.filter(id => fieldIds.has(id))), [visibleFieldsArr, fieldIds]);
  const visibleCardFields = useMemo(() => floorFields.filter(field => visibleFields.has(field.id)), [floorFields, visibleFields]);

  const todayTasks = useMemo(() => tasks.filter(task => getTaskDateKey(task.startTime) === todayKey), [tasks, todayKey]);
  const allMachineGroups = useMemo(() => groupFloorMachines(todayTasks), [todayTasks]);
  const noteTasks = useMemo(() => todayTasks.filter(task => task.notes?.trim()), [todayTasks]);
  const pageCount = Math.max(1, Math.ceil(todayTasks.length / 24), Math.ceil(noteTasks.length / 12), Math.ceil(allMachineGroups.length / 8));
  const currentPage = Math.min(page, pageCount);
  const displayTasks = getFloorPage<Task>(todayTasks, currentPage, 24);
  const machineGroups = getFloorPage<FloorMachineGroup>(allMachineGroups, currentPage, 8);
  const displayNotes = getFloorPage<Task>(noteTasks, currentPage, 12);

  useEffect(() => { setPage(1); }, [todayTasks]);
  useEffect(() => {
    if (!playing || showFieldMenu || pageCount < 2) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setPage(previous => previous >= pageCount ? 1 : previous + 1);
    }, intervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [playing, showFieldMenu, pageCount, intervalSeconds, page]);

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
    <div className="classic-floor-display h-full min-h-0 flex flex-col gap-2 overflow-hidden bg-slate-950 text-slate-100">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="shrink-0 flex flex-wrap items-center justify-between gap-4 rounded-xl border border-cyan-400/20 bg-gradient-to-r from-slate-900/90 via-slate-900/80 to-cyan-950/30 px-5 py-3.5 backdrop-blur-sm"
      >
        <div className="min-w-[14rem]">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-400/20">
              <MonitorUp className="w-5 h-5 text-cyan-300" />
            </div>
            <h2 className="whitespace-nowrap text-xl 2xl:text-2xl font-bold tracking-wide bg-gradient-to-r from-slate-50 to-cyan-100 bg-clip-text text-transparent">
              生产执行大屏
            </h2>
            <span className="rounded-md border border-cyan-300/25 bg-cyan-300/8 px-2.5 py-1 text-[11px] font-mono text-cyan-100/90">
              排序: {sortLabel} {sortDirection === 'asc' ? '↑' : '↓'}
            </span>
          </div>
          <p className="mt-1.5 max-w-xl text-xs text-slate-400/80">{todayKey} · {todayTasks.length} 条当日生产安排</p>
        </div>
        <div className="flex min-w-0 max-w-full flex-wrap items-center gap-3 text-right">
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="rounded-lg border border-cyan-400/25 bg-slate-950/60 px-4 py-2.5"
          >
            <div className="text-[10px] text-slate-500/80 uppercase tracking-wider">当前时间</div>
            <div className="font-mono text-xl font-bold text-cyan-200 tracking-wider">{currentTime}</div>
          </motion.div>
          <div className="grid grid-cols-3 gap-2">
            <MetricBox label="生产单" value={metrics.totalOrders} delay={0.1} />
            <MetricBox label="今日单数" value={metrics.todayCount} delay={0.2} />
            <MetricBox label="今日米数" value={`${metrics.todayVolume}m`} delay={0.3} />
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="classic-floor-layout grid flex-1 min-h-0 grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-2 overflow-y-auto xl:overflow-hidden">
        {/* Production Queue */}
        <motion.section
          initial={{ opacity: 0, x: -12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="classic-floor-queue min-h-0 flex flex-col rounded-xl border border-slate-700/50 bg-gradient-to-b from-slate-900/60 to-slate-950/60 overflow-hidden"
        >
          <div className="shrink-0 flex items-center justify-between border-b border-slate-700/50 px-4 py-2.5 bg-slate-800/30">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-cyan-500/10 border border-cyan-400/15">
                <CalendarClock className="w-4 h-4 text-cyan-300" />
              </div>
              <h3 className="text-sm font-bold text-slate-100">当日生产队列</h3>
              <span className="text-[11px] text-slate-500/80 font-mono">
                {displayTasks.length} / {todayTasks.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowFieldMenu(!showFieldMenu)}
                  className="flex items-center gap-1.5 rounded-md border border-slate-700/60 bg-slate-950/50 px-2.5 py-1.5 text-xs text-slate-300 hover:border-cyan-300/40 hover:bg-slate-800/50 transition-colors"
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
              <div className="flex items-center gap-1 text-cyan-300/80">
                {sortDirection === 'asc' ? <ArrowUpAZ className="w-4 h-4" /> : <ArrowDownAZ className="w-4 h-4" />}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
            {displayTasks.length > 0 ? (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-2.5 content-start">
                {displayTasks.map((task, index) => (
                  <ProductionCard
                    key={task.fileWpsRow !== undefined ? `row:${task.fileWpsRow}` : `${task.id}:${index}`}
                    task={task}
                    index={((currentPage - 1) % Math.max(1, Math.ceil(todayTasks.length / 24))) * 24 + index}
                    fields={visibleCardFields}
                    onTaskClick={onTaskClick}
                    onProcessCardClick={onProcessCardClick}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-slate-800/50 text-sm text-slate-500/60">
                当日暂无生产安排
              </div>
            )}
          </div>
        </motion.section>

        {/* Sidebar */}
        <motion.aside
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.25 }}
          className="classic-floor-sidebar min-h-[480px] xl:min-h-0 grid grid-rows-[1fr_1fr] gap-2"
        >
          {/* Machine Groups */}
          <section className="min-h-0 rounded-xl border border-slate-700/50 bg-gradient-to-b from-slate-900/60 to-slate-950/60 overflow-hidden">
            <PanelHeader icon={<Gauge className="w-4 h-4 text-emerald-300" />} title="机台生产安排" count={`${allMachineGroups.length} 组`} />
            <div className="h-full overflow-y-auto p-2.5 space-y-2 pb-12 custom-scrollbar">
              {machineGroups.map((group, groupIndex) => (
                <motion.div
                  key={group.machine}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.3 + groupIndex * 0.05 }}
                  className="rounded-lg border border-slate-700/40 bg-slate-950/40 p-2.5 hover:border-slate-600/50 transition-colors"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/80" />
                      <span className="font-semibold text-slate-100 text-[13px]">{group.machine}</span>
                    </div>
                    <span className="text-[10px] text-slate-500/70 font-mono">{group.tasks.length} 单</span>
                  </div>
                  <div className="space-y-1">
                    {group.tasks.slice(0, 6).map((task, index) => (
                      <button
                        key={task.fileWpsRow !== undefined ? `row:${task.fileWpsRow}` : `${task.id}:${index}`}
                        onClick={() => onTaskClick(task)}
                        className="grid w-full grid-cols-[5.5rem_minmax(0,1fr)_4.5rem] gap-2 rounded-md bg-slate-900/60 px-2.5 py-1.5 text-left text-[11px] hover:bg-slate-800/70 hover:border-slate-700/50 border border-transparent transition-all"
                      >
                        <span className="font-mono text-cyan-200/90 truncate">{task.id || '未填卡号'}</span>
                        <span className="text-slate-300/80 truncate">{task.productName}</span>
                        <span className="font-mono text-slate-500/70 text-right">{formatPlanTime(task.startTime)}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </section>

          {/* Notes */}
          <section className="min-h-0 rounded-xl border border-slate-700/50 bg-gradient-to-b from-slate-900/60 to-slate-950/60 overflow-hidden">
            <PanelHeader icon={<AlertTriangle className="w-4 h-4 text-amber-300" />} title="工艺备注" count={`${noteTasks.length} 条备注`} />
            <div className="h-full min-h-0 overflow-y-auto p-2.5 pb-12 space-y-1.5 custom-scrollbar">
              {displayNotes.map((task, noteIndex) => (
                <motion.button
                  key={task.fileWpsRow !== undefined ? `row:${task.fileWpsRow}` : `${task.id}:${noteIndex}`}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.25, delay: 0.4 + noteIndex * 0.03 }}
                  onClick={() => onTaskClick(task)}
                  className="block w-full rounded-lg border border-amber-300/15 bg-amber-400/5 px-3 py-2 text-left text-[11px] hover:border-amber-300/40 hover:bg-amber-400/10 transition-all"
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-amber-100/90 font-bold">{task.id || '未填卡号'}</span>
                    <span className="text-slate-400/70">{task.machineName}</span>
                    <span className="ml-auto font-mono text-slate-500/60 text-[10px]">{formatPlanTime(task.startTime)}</span>
                  </div>
                  <span className="block truncate text-amber-200/70 leading-relaxed">{task.notes}</span>
                </motion.button>
              ))}
              {noteTasks.length === 0 && (
                <div className="flex h-24 items-center justify-center rounded-lg border border-slate-800/50 text-xs text-slate-500/50">
                  暂无工艺备注
                </div>
              )}
            </div>
          </section>
        </motion.aside>
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-700/50 bg-slate-900/60 px-3 py-2 text-xs text-slate-400">
        <div className="flex items-center gap-3">
          <button type="button" aria-label="上一展示页" title="上一展示页" disabled={pageCount <= 1} onClick={() => setPage(currentPage <= 1 ? pageCount : currentPage - 1)} className="p-1 rounded hover:bg-slate-800 disabled:opacity-30"><ChevronLeft size={16} /></button>
          <span aria-live="polite">展示 {currentPage} / {pageCount}</span>
          <button type="button" aria-label="下一展示页" title="下一展示页" disabled={pageCount <= 1} onClick={() => setPage(currentPage >= pageCount ? 1 : currentPage + 1)} className="p-1 rounded hover:bg-slate-800 disabled:opacity-30"><ChevronRight size={16} /></button>
        </div>
        <div className="flex items-center gap-2">
          <span>自动轮播</span>
          <select aria-label="轮播间隔" value={intervalSeconds} onChange={event => setIntervalSeconds(Number(event.target.value))} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200">{[10, 20, 30, 60].map(seconds => <option key={seconds} value={seconds}>{seconds} 秒</option>)}</select>
          <button type="button" aria-label={playing ? '暂停轮播' : '开始轮播'} title={playing ? '暂停轮播' : '开始轮播'} onClick={() => setPlaying(!playing)} className="p-1 rounded hover:bg-slate-800">{playing ? <Pause size={16} /> : <Play size={16} />}</button>
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value, delay = 0 }: { label: string; value: string | number; delay?: number }) {
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4, delay }}
      className="min-w-[5.5rem] rounded-lg border border-slate-700/50 bg-gradient-to-b from-slate-900/70 to-slate-950/80 px-3 py-2 hover:border-slate-600/50 transition-colors"
    >
      <div className="flex items-center justify-end gap-1 text-[10px] text-slate-500/70 uppercase tracking-wider">
        <FileSpreadsheet className="w-3 h-3" />
        {label}
      </div>
      <div className="font-mono text-lg font-bold text-slate-100 tracking-tight">{value}</div>
    </motion.div>
  );
}

function PanelHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count: string }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-700/50 px-4 py-2.5 bg-slate-800/20">
      <div className="flex items-center gap-2.5">
        <div className="p-1 rounded-md bg-slate-800/50">
          {icon}
        </div>
        <h3 className="text-sm font-bold text-slate-100">{title}</h3>
      </div>
      <span className="text-[10px] text-slate-500/70 font-mono">{count}</span>
    </div>
  );
}
