import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { AlertTriangle, Check, ChevronsRight, Circle, CircleDot, Factory, Grid2X2, Layers, LayoutGrid, List, ListTree, Palette, Search, Settings2 } from 'lucide-react';
import { Task, CustomFieldConfig } from '../types';
import { DEFAULT_FIELD_CONFIG } from '../data';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { cn } from './MetricCard';

interface ProcessCardViewProps {
  tasks: Task[];
  totalTaskCount?: number;
  onTaskClick: (task: Task) => void;
  onProcessCardClick: (task: Task) => void;
}

type ProcessStageStatus = 'done' | 'active' | 'pending';

type ProcessStage = {
  id: string;
  label: string;
  englishLabel: string;
  status: ProcessStageStatus;
};

type CardSize = 'sm' | 'md' | 'lg';

type ProcessField = {
  id: string;
  label: string;
};

const PROCESS_CARD_GRID_COLUMNS: Record<CardSize, string> = {
  sm: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4',
  md: 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3',
  lg: 'grid-cols-1 lg:grid-cols-2',
};

const PROCESS_CARD_DEFAULT_FIELDS = ['id', 'process', 'productName', 'plannedQuantity', 'specification', 'machineName', 'startTime', 'notes'];
const PROCESS_CARD_PAGE_SIZE = 48;

export const PROCESS_FLOW_ORDER = ['涂布', '模压', '分切'];

const PROCESS_STAGE_CONFIG: Record<string, Omit<ProcessStage, 'status'>> = {
  涂布: { id: '涂布', label: '涂布', englishLabel: 'Coating' },
  模压: { id: '模压', label: '模压', englishLabel: 'Embossing' },
  分切: { id: '分切', label: '分切', englishLabel: 'Slitting' },
};

const PROCESS_STAGES = PROCESS_FLOW_ORDER.map(process => PROCESS_STAGE_CONFIG[process]);

export function resolveProcessFlowStages(flowOrder: string[], tasks: Task[] = []): Omit<ProcessStage, 'status'>[] {
  const taskProcesses = Array.from(new Set(tasks.map(task => task.process).filter(Boolean)));
  const configuredProcesses = flowOrder.filter(process => PROCESS_STAGE_CONFIG[process]);
  const processNames = taskProcesses.length > 0
    ? taskProcesses
    : configuredProcesses.length > 0
      ? configuredProcesses
      : PROCESS_FLOW_ORDER;
  const sortedProcessNames = [
    ...flowOrder.filter(process => processNames.includes(process)),
    ...processNames.filter(process => !flowOrder.includes(process)),
  ];

  return sortedProcessNames.map(process => PROCESS_STAGE_CONFIG[process] ?? {
    id: process,
    label: process,
    englishLabel: process,
  });
}

const PROCESS_STAGE_THEMES = {
  涂布: {
    accentClass: 'bg-blue-500',
    badgeClass: 'bg-blue-400/10 text-blue-200 border-blue-300/30',
  },
  模压: {
    accentClass: 'bg-amber-500',
    badgeClass: 'bg-amber-400/10 text-amber-200 border-amber-300/30',
  },
  分切: {
    accentClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-400/10 text-emerald-200 border-emerald-300/30',
  },
};

export function getProcessStageTheme(process: string) {
  return PROCESS_STAGE_THEMES[process as keyof typeof PROCESS_STAGE_THEMES] ?? PROCESS_STAGE_THEMES.涂布;
}

export function getProcessStages(process: string, flowOrder = PROCESS_STAGES): ProcessStage[] {
  const activeIndex = Math.max(0, flowOrder.findIndex(stage => stage.id === process));
  return flowOrder.map((stage, index) => ({
    ...stage,
    status: index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending',
  }));
}

export function getProcessCardGridColumns(size: CardSize): string {
  return PROCESS_CARD_GRID_COLUMNS[size];
}

export function groupProcessTasks(tasks: Task[], groupBy: string): Record<string, Task[]> {
  if (groupBy === 'none') return { 所有流程卡: tasks };

  return tasks.reduce((acc, task) => {
    const key = String(task[groupBy as keyof Task] || '未分组');
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {} as Record<string, Task[]>);
}

export function mergeNewProcessFields(currentVisible: string[], currentAvailable: string[], previousAvailable: string[]): string[] {
  const addedFields = currentAvailable.filter(id => !previousAvailable.includes(id));
  return addedFields.length > 0 ? [...currentVisible, ...addedFields] : currentVisible;
}

export function isProcessFieldVisible(visibleFields: Set<string>, fieldId: string): boolean {
  return visibleFields.has(fieldId);
}

export function getProcessSummaryText(visibleCount: number, totalCount: number): string {
  if (visibleCount === totalCount) return `当前显示 ${visibleCount} 张流程卡`;
  return `当前显示 ${visibleCount} / ${totalCount} 张流程卡`;
}

export function getVisibleProcessTasks(tasks: Task[], visibleLimit: number): Task[] {
  return tasks.slice(0, visibleLimit);
}

export function getFilteredProcessTasks(tasks: Task[], query: string): Task[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return tasks;

  return tasks.filter(task => [
    task.id,
    task.process,
    task.productName,
    task.machineName,
    task.specification,
    task.operator,
    task.notes,
    formatDate(task.startTime),
  ].some(value => String(value || '').toLowerCase().includes(normalizedQuery)));
}

function formatDate(value: string): string {
  try {
    return format(new Date(value), 'yyyy-MM-dd');
  } catch {
    return '';
  }
}

function getProgressWidth(stages: ProcessStage[]): string {
  const activeIndex = stages.findIndex(stage => stage.status === 'active');
  if (activeIndex <= 0) return '0%';
  if (activeIndex === 1) return '50%';
  return '100%';
}

function StageIcon({ stage, className }: { stage: ProcessStage; className?: string }) {
  if (stage.status === 'done') return <Check className={className} />;
  if (stage.id === '涂布') return <Layers className={className} />;
  if (stage.id === '模压') return <Palette className={className} />;
  return <ChevronsRight className={className} />;
}

function ProcessStageTimeline({ process, flowStages }: { process: string; flowStages: Omit<ProcessStage, 'status'>[] }) {
  const stages = getProcessStages(process, flowStages);
  const progressWidth = getProgressWidth(stages);

  return (
    <div className="flex-1 flex items-center justify-between relative px-8 min-w-[320px]">
      <div className="absolute top-1/2 left-8 right-8 h-0.5 bg-slate-700/80 -translate-y-1/2 z-0 rounded-full" />
      <div
        className="absolute top-1/2 left-8 h-0.5 bg-cyan-300 -translate-y-1/2 z-0 origin-left rounded-full shadow-[0_0_8px_rgba(0,229,255,0.65)]"
        style={{ width: `calc(${progressWidth} - 4rem)` }}
      />
      {stages.map(stage => {
        const active = stage.status === 'active';
        const done = stage.status === 'done';
        return (
          <div key={stage.id} className={cn('relative z-10 flex flex-col items-center', stage.status === 'pending' && 'opacity-45')}>
            <div className={cn(
              'flex items-center justify-center mb-1.5 border transition-all',
              active
                ? 'w-10 h-10 rounded-xl bg-slate-950 border-2 border-cyan-300 text-cyan-200 shadow-[0_0_16px_rgba(0,229,255,0.45)] scale-110'
                : done
                  ? 'w-8 h-8 rounded-lg bg-slate-700/80 border-cyan-300/70 text-cyan-300 shadow-[0_0_10px_rgba(0,229,255,0.2)]'
                  : 'w-8 h-8 rounded-lg bg-slate-950 border-slate-600 text-slate-500'
            )}>
              <StageIcon stage={stage} className={active ? 'w-5 h-5' : 'w-4 h-4'} />
            </div>
            <span className={cn('font-mono text-[10px] font-bold tracking-wider', active ? 'text-cyan-200' : done ? 'text-slate-100' : 'text-slate-500')}>
              {stage.label}
            </span>
            <span className={cn('font-mono text-[8px] uppercase', active ? 'text-cyan-300' : 'text-slate-500')}>
              {active ? 'In Progress' : done ? stage.englishLabel : 'Pending'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

const ProcessGridCard: React.FC<{ task: Task; onTaskClick: (task: Task) => void; onProcessCardClick: (task: Task) => void; size: CardSize; visibleFields: Set<string>; flowStages: Omit<ProcessStage, 'status'>[] }> = ({ task, onTaskClick, onProcessCardClick, size, visibleFields, flowStages }) => {
  const stages = getProcessStages(task.process, flowStages);
  const theme = getProcessStageTheme(task.process);
  const activeStage = stages.find(stage => stage.status === 'active') ?? stages[0];
  const cardSizeClasses = {
    sm: 'min-h-[170px]',
    md: 'min-h-[210px]',
    lg: 'min-h-[250px]',
  };
  const bodySizeClasses = {
    sm: 'p-3 gap-3',
    md: 'p-4 gap-4',
    lg: 'p-5 gap-5',
  };
  const labelClass = size === 'sm' ? 'text-[9px]' : 'text-[10px]';
  const valueClass = size === 'lg' ? 'text-base' : size === 'md' ? 'text-sm' : 'text-xs';

  return (
    <div
      onClick={() => onTaskClick(task)}
      className={cn('relative overflow-hidden rounded-lg border border-slate-700/80 bg-slate-900/80 shadow-sm transition-shadow hover:shadow-[0_0_18px_rgba(0,229,255,0.14)] cursor-pointer flex flex-col', cardSizeClasses[size])}
    >
      <div className={cn('absolute left-0 top-0 bottom-0 w-1', theme.accentClass)} />
      <div className={cn('flex flex-col flex-1', bodySizeClasses[size])}>
        <div className="flex justify-between items-start gap-3">
          {visibleFields.has('id') && (
            <div>
              <span className={cn('block mb-1 font-mono font-bold tracking-[0.14em] text-slate-500 uppercase', labelClass)}>流程卡号</span>
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onProcessCardClick(task);
                }}
                className={cn('font-mono font-semibold text-slate-100 hover:text-cyan-300 hover:underline', valueClass)}
              >
                {task.id}
              </button>
            </div>
          )}
          {visibleFields.has('process') && (
            <span className={cn('font-mono text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase shrink-0', theme.badgeClass)}>
              {activeStage.label}
            </span>
          )}
        </div>

        <div className={cn('grid gap-x-4', size === 'sm' ? 'grid-cols-1 gap-y-2' : 'grid-cols-2 gap-y-3')}>
          {visibleFields.has('productName') && (
            <div>
              <span className={cn('block mb-1 font-mono font-bold tracking-[0.12em] text-slate-500 uppercase', labelClass)}>品名颜色</span>
              <span className={cn('font-medium text-slate-100', valueClass)}>{task.productName || '-'}</span>
            </div>
          )}
          {visibleFields.has('plannedQuantity') && (
            <div>
              <span className={cn('block mb-1 font-mono font-bold tracking-[0.12em] text-slate-500 uppercase', labelClass)}>预计数量</span>
              <span className={cn('font-mono font-medium text-slate-100', valueClass)}>{task.plannedQuantity || 0}m</span>
            </div>
          )}
          {visibleFields.has('specification') && (
            <div className={size === 'sm' ? '' : 'col-span-2'}>
              <span className={cn('block mb-1 font-mono font-bold tracking-[0.12em] text-slate-500 uppercase', labelClass)}>规格</span>
              <span className={cn('text-slate-200', valueClass)}>{task.specification || '-'}</span>
            </div>
          )}
          {(visibleFields.has('machineName') || visibleFields.has('startTime')) && (
            <div className={cn('flex gap-3 text-slate-400', size === 'sm' ? 'flex-col text-[10px]' : 'col-span-2 items-center justify-between text-[11px]')}>
              {visibleFields.has('machineName') && <span>机台: {task.machineName || '未分配'}</span>}
              {visibleFields.has('startTime') && <span>{formatDate(task.startTime)}</span>}
            </div>
          )}
          {visibleFields.has('notes') && task.notes && (
            <div className={cn('text-amber-200 bg-amber-400/10 border border-amber-300/30 rounded px-2 py-1', size === 'sm' ? 'text-[10px]' : 'col-span-2 text-[11px]')}>
              {task.notes}
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto border-t border-slate-700/80 bg-slate-950/55 p-3 flex justify-between items-center text-[11px] font-medium text-slate-500">
        {stages.map((stage, index) => {
          const done = stage.status === 'done';
          const active = stage.status === 'active';
          return (
            <React.Fragment key={stage.id}>
              {index > 0 && <div className="w-4 h-px bg-slate-700" />}
              <div className={cn('flex items-center gap-1', done ? 'text-emerald-400' : active ? 'text-cyan-300' : 'text-slate-500')}>
                {done ? <Check className="w-3.5 h-3.5" /> : active ? <CircleDot className="w-3.5 h-3.5" /> : <Circle className="w-3.5 h-3.5" />}
                {stage.label}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

const ProcessRow: React.FC<{ task: Task; onTaskClick: (task: Task) => void; onProcessCardClick: (task: Task) => void; visibleFields: Set<string>; flowStages: Omit<ProcessStage, 'status'>[] }> = ({ task, onTaskClick, onProcessCardClick, visibleFields, flowStages }) => {
  const hasAlert = Boolean(task.notes?.trim());

  return (
    <div
      onClick={() => onTaskClick(task)}
      className="bg-slate-900/80 rounded-lg border border-slate-700/80 shadow-sm overflow-hidden hover:shadow-[0_0_15px_rgba(0,229,255,0.12)] hover:border-cyan-300/50 transition-all flex flex-row items-center p-3 gap-6 min-h-[88px] cursor-pointer"
    >
      <div className="flex flex-col gap-1 w-72 shrink-0 border-r border-slate-700/80 pr-4">
        <div className="flex items-center gap-2 mb-0.5">
          {isProcessFieldVisible(visibleFields, 'id') && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onProcessCardClick(task);
              }}
              className="font-mono text-sm font-bold text-slate-100 leading-none hover:text-cyan-300 hover:underline"
            >
              {task.id}
            </button>
          )}
          {isProcessFieldVisible(visibleFields, 'startTime') && (
            <span className="font-mono text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded border border-slate-700">
              {formatDate(task.startTime)}
            </span>
          )}
          {isProcessFieldVisible(visibleFields, 'machineName') && (
            <span className="font-mono text-[9px] font-bold text-slate-950 bg-cyan-300 px-1.5 py-0.5 rounded">
              {task.machineName || '未分配'}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px]">
          {isProcessFieldVisible(visibleFields, 'productName') && (
            <div className="flex gap-1">
              <span className="text-slate-500 uppercase">品名颜色:</span>
              <span className="font-mono font-medium text-cyan-300">{task.productName}</span>
            </div>
          )}
          {isProcessFieldVisible(visibleFields, 'specification') && (
            <div className="flex gap-1">
              <span className="text-slate-500 uppercase">规格:</span>
              <span className="font-mono font-medium text-slate-200">{task.specification}</span>
            </div>
          )}
          {isProcessFieldVisible(visibleFields, 'plannedQuantity') && (
            <div className="flex gap-1">
              <span className="text-slate-500 uppercase">预计数量:</span>
              <span className="font-mono font-medium text-slate-200">{task.plannedQuantity || 0}m</span>
            </div>
          )}
        </div>
      </div>

      <ProcessStageTimeline process={task.process} flowStages={flowStages} />

      <div className="w-80 shrink-0 flex flex-col justify-center border-l border-slate-700/80 pl-4">
        <div className="flex justify-between items-center mb-1">
          <span className="text-[9px] text-slate-500">
            {isProcessFieldVisible(visibleFields, 'machineName') ? `Machine: ${task.machineName || '未分配'}` : ''}
          </span>
          <span className={cn(
            'font-medium text-[10px] px-2 py-0.5 rounded-full border shadow-[0_0_8px_rgba(0,229,255,0.18)]',
            hasAlert ? 'text-amber-200 bg-amber-400/10 border-amber-300/35' : 'text-cyan-200 bg-cyan-400/10 border-cyan-300/30'
          )}>
            {hasAlert ? 'Alert' : 'In Progress'}
          </span>
        </div>
        {isProcessFieldVisible(visibleFields, 'notes') && (
          <div className={cn(
            'rounded p-1.5 text-[9px] border flex items-start gap-1',
            hasAlert ? 'bg-amber-400/10 border-amber-300/30' : 'bg-slate-950/50 border-slate-700/80'
          )}>
            {hasAlert && <AlertTriangle className="w-3 h-3 text-amber-300 shrink-0 mt-0.5" />}
            <span className={cn('block leading-tight', hasAlert ? 'text-slate-100' : 'text-slate-400')}>
              {task.notes || '暂无工艺备注'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ProcessCardView({ tasks, totalTaskCount = tasks.length, onTaskClick, onProcessCardClick }: ProcessCardViewProps) {
  const [fieldConfig] = useLocalStorage<CustomFieldConfig[]>('mes_field_mapping_config', DEFAULT_FIELD_CONFIG);
  const [displayMode, setDisplayMode] = useState<'list' | 'grid'>('list');
  const [cardSize, setCardSize] = useLocalStorage<CardSize>('mes_process_cardSize', 'md');
  const [groupBy, setGroupBy] = useLocalStorage<string>('mes_process_groupBy', 'none');
  const [flowOrder, setFlowOrder] = useLocalStorage<string[]>('mes_process_flowOrder', PROCESS_FLOW_ORDER);
  const [showFieldMenu, setShowFieldMenu] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [showFlowMenu, setShowFlowMenu] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(PROCESS_CARD_PAGE_SIZE);
  const processFields = useMemo<ProcessField[]>(() => {
    return fieldConfig
      .filter(field => field.visible && PROCESS_CARD_DEFAULT_FIELDS.includes(field.fieldId))
      .map(field => ({ id: field.fieldId, label: field.displayName }));
  }, [fieldConfig]);
  const availableFieldIds = useMemo(() => processFields.map(field => field.id), [processFields]);
  const fieldConfigVisibleIds = useMemo<Set<string>>(() => new Set(availableFieldIds), [availableFieldIds]);
  const [visibleFieldsArr, setVisibleFieldsArr] = useLocalStorage<string[]>('mes_process_visibleFields', [...PROCESS_CARD_DEFAULT_FIELDS]);
  const previousAvailableFieldIdsRef = useRef<string[]>(availableFieldIds);

  useEffect(() => {
    const nextVisible = mergeNewProcessFields(visibleFieldsArr, availableFieldIds, previousAvailableFieldIdsRef.current);
    previousAvailableFieldIdsRef.current = availableFieldIds;
    if (nextVisible !== visibleFieldsArr) setVisibleFieldsArr(nextVisible);
  }, [availableFieldIds, visibleFieldsArr, setVisibleFieldsArr]);

  useEffect(() => {
    setVisibleLimit(PROCESS_CARD_PAGE_SIZE);
  }, [tasks, groupBy, displayMode, filterQuery]);

  const visibleFields = useMemo<Set<string>>(() => new Set(visibleFieldsArr.filter(id => fieldConfigVisibleIds.has(id))), [visibleFieldsArr, fieldConfigVisibleIds]);
  const filteredProcessTasks = useMemo(() => getFilteredProcessTasks(tasks, filterQuery), [tasks, filterQuery]);
  const sortedTasks = useMemo(() => {
    return [...filteredProcessTasks].sort((a, b) => a.id.localeCompare(b.id));
  }, [filteredProcessTasks]);
  const flowStages = useMemo(() => resolveProcessFlowStages(flowOrder, sortedTasks), [flowOrder, sortedTasks]);
  const moveFlowStage = (stageId: string, direction: -1 | 1) => {
    const currentOrder = flowStages.map(stage => stage.id);
    const index = currentOrder.indexOf(stageId);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= currentOrder.length) return;
    const nextOrder = [...currentOrder];
    [nextOrder[index], nextOrder[nextIndex]] = [nextOrder[nextIndex], nextOrder[index]];
    setFlowOrder(nextOrder);
  };
  const visibleTasks = useMemo(() => getVisibleProcessTasks(sortedTasks, visibleLimit), [sortedTasks, visibleLimit]);
  const groupedTasks = useMemo(() => groupProcessTasks(visibleTasks, groupBy), [visibleTasks, groupBy]);
  const toggleField = (id: string) => {
    if (!fieldConfigVisibleIds.has(id)) return;
    const next = new Set<string>(visibleFields);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);
    } else {
      next.add(id);
    }
    setVisibleFieldsArr(Array.from(next));
  };

  return (
    <div className="h-full flex flex-col gap-4 overflow-hidden min-w-0">
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
            <Factory className="w-5 h-5 text-cyan-300" />
            流程卡号视图
          </h2>
          <p className="mt-1 text-xs font-mono text-slate-400">
            {getProcessSummaryText(sortedTasks.length, totalTaskCount)}{sortedTasks.length > visibleTasks.length ? `，已加载 ${visibleTasks.length} 张` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input
              type="text"
              value={filterQuery}
              onChange={(event) => setFilterQuery(event.target.value)}
              placeholder="筛选流程卡..."
              className="w-44 bg-slate-950 border border-slate-700 rounded-md py-1 pl-8 pr-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => { setShowGroupMenu(!showGroupMenu); setShowSizeMenu(false); setShowFieldMenu(false); setShowFlowMenu(false); }}
              className="bg-slate-950 hover:bg-slate-800 text-slate-200 px-3 py-1 rounded-md font-mono text-xs transition-colors border border-slate-700 flex items-center gap-1"
            >
              <ListTree className="w-3 h-3" /> 分组: {groupBy === 'none' ? '无' : processFields.find(field => field.id === groupBy)?.label || groupBy}
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
                  {processFields.filter(field => field.id !== 'notes').map(field => (
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
          <div className="relative">
            <button
              onClick={() => { setShowFlowMenu(!showFlowMenu); setShowGroupMenu(false); setShowSizeMenu(false); setShowFieldMenu(false); }}
              className="bg-slate-950 hover:bg-slate-800 text-slate-200 px-3 py-1 rounded-md font-mono text-xs transition-colors border border-slate-700 flex items-center gap-1"
            >
              <ChevronsRight className="w-3 h-3" /> 流转顺序: {flowStages.map(stage => stage.label).join(' → ')}
            </button>
            {showFlowMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFlowMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-64 bg-slate-800 border border-blue-900/50 rounded-lg shadow-xl py-2 overflow-hidden">
                  {flowStages.map((stage, index) => (
                    <div key={stage.id} className="flex items-center justify-between px-3 py-2 text-xs text-slate-300">
                      <span className="font-mono">{index + 1}. {stage.label}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => moveFlowStage(stage.id, -1)}
                          disabled={index === 0}
                          className="px-2 py-0.5 rounded border border-slate-600 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700"
                        >
                          上移
                        </button>
                        <button
                          onClick={() => moveFlowStage(stage.id, 1)}
                          disabled={index === flowStages.length - 1}
                          className="px-2 py-0.5 rounded border border-slate-600 text-slate-300 disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-700"
                        >
                          下移
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="border-t border-slate-700 mt-1 pt-1 px-2">
                    <button
                      onClick={() => setFlowOrder(PROCESS_FLOW_ORDER)}
                      className="w-full text-left px-2 py-1.5 text-xs text-cyan-200 hover:bg-slate-700 rounded"
                    >
                      恢复默认：涂布 → 模压 → 分切
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => { setShowSizeMenu(!showSizeMenu); setShowGroupMenu(false); setShowFieldMenu(false); setShowFlowMenu(false); }}
              className="bg-slate-950 hover:bg-slate-800 text-slate-200 px-3 py-1 rounded-md font-mono text-xs transition-colors border border-slate-700 flex items-center gap-1"
            >
              <LayoutGrid className="w-3 h-3" /> 卡片大小
            </button>
            {showSizeMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSizeMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-32 bg-slate-800 border border-blue-900/50 rounded-lg shadow-xl py-1 overflow-hidden">
                  {[
                    { id: 'sm', label: '小' },
                    { id: 'md', label: '中' },
                    { id: 'lg', label: '大' },
                  ].map(option => (
                    <button
                      key={option.id}
                      onClick={() => { setCardSize(option.id as CardSize); setShowSizeMenu(false); }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-between"
                    >
                      {option.label}
                      {cardSize === option.id && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => { setShowFieldMenu(!showFieldMenu); setShowGroupMenu(false); setShowSizeMenu(false); setShowFlowMenu(false); }}
              className="bg-slate-950 hover:bg-slate-800 text-slate-200 px-3 py-1 rounded-md font-mono text-xs transition-colors border border-slate-700 flex items-center gap-1"
            >
              <Settings2 className="w-3 h-3" /> 显示设置
            </button>
            {showFieldMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowFieldMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-slate-800 border border-blue-900/50 rounded-lg shadow-xl py-1 overflow-hidden">
                  {processFields.map(field => (
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
          <div className="flex items-center bg-slate-950 rounded-md border border-slate-700 overflow-hidden mr-2">
            <button
              onClick={() => setDisplayMode('list')}
              className={cn(
                'px-2 py-1 transition-colors flex items-center justify-center',
                displayMode === 'list' ? 'text-cyan-300 bg-slate-800' : 'text-slate-400 hover:bg-slate-800 hover:text-cyan-300'
              )}
              title="列表视图"
              aria-label="列表视图"
            >
              <List className="w-4 h-4" />
            </button>
            <div className="w-px h-3 bg-slate-700" />
            <button
              onClick={() => setDisplayMode('grid')}
              className={cn(
                'px-2 py-1 transition-colors flex items-center justify-center',
                displayMode === 'grid' ? 'text-cyan-300 bg-slate-800' : 'text-slate-400 hover:bg-slate-800 hover:text-cyan-300'
              )}
              title="网格视图"
              aria-label="网格视图"
            >
              <Grid2X2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {sortedTasks.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-slate-500 border border-slate-800 rounded-lg bg-slate-950/40">
          <Search className="w-4 h-4 mr-2" /> 没有匹配的流程卡
        </div>
      ) : (
        <section className="flex-1 overflow-y-auto overflow-x-hidden pr-2 pb-4 space-y-5 min-w-0">
          {Object.entries(groupedTasks as Record<string, Task[]>).map(([groupName, groupTasks]) => (
            <div key={groupName} className="space-y-3">
              {groupBy !== 'none' && (
                <h3 className="text-sm font-bold text-blue-100 bg-slate-800/50 px-3 py-1.5 rounded border border-blue-900/30">
                  {groupName} ({groupTasks.length})
                </h3>
              )}
              {displayMode === 'grid' ? (
                <div className={cn('grid gap-3 content-start', getProcessCardGridColumns(cardSize))}>
                  {groupTasks.map(task => (
                    <ProcessGridCard
                      key={task.id}
                      task={task}
                      onTaskClick={onTaskClick}
                      onProcessCardClick={onProcessCardClick}
                      size={cardSize}
                      visibleFields={visibleFields}
                      flowStages={flowStages}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {groupTasks.map(task => (
                    <ProcessRow
                      key={task.id}
                      task={task}
                      onTaskClick={onTaskClick}
                      onProcessCardClick={onProcessCardClick}
                      visibleFields={visibleFields}
                      flowStages={flowStages}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
          {visibleTasks.length < sortedTasks.length && (
            <div className="flex justify-center pt-1">
              <button
                onClick={() => setVisibleLimit(limit => limit + PROCESS_CARD_PAGE_SIZE)}
                className="px-4 py-2 rounded-lg border border-cyan-400/30 bg-cyan-400/10 text-cyan-100 text-xs font-mono hover:bg-cyan-400/20 transition-colors"
              >
                加载更多流程卡（{visibleTasks.length}/{sortedTasks.length}）
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
