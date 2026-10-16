import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowDownAZ, ArrowUpAZ, CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardList, Factory, FileText, Pause, Play, RotateCw, Settings2 } from 'lucide-react';
import type { CustomFieldConfig, SortDirection, Task } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { getTaskDateKey } from '../dateFilters';
import { getFloorCapacity, getFloorPage, groupFloorMachines } from '../floorDisplay';
import type { FloorMachineGroup } from '../floorDisplay';
import { cn } from './MetricCard';
import './FloorDisplayView.css';

interface FloorDisplayViewProps {
  tasks: Task[];
  fieldConfig: CustomFieldConfig[];
  metrics: { totalOrders: number; todayCount: number; todayVolume: number };
  currentTime: string;
  sortLabel: string;
  sortDirection: SortDirection;
  onTaskClick: (task: Task) => void;
  onProcessCardClick: (task: Task) => void;
}

const DEFAULT_FIELDS = ['id', 'process', 'machineName', 'productName', 'specification', 'plannedQuantity', 'startTime', 'notes'];
const SPECIAL_FIELDS = new Set(['id', 'process', 'productName', 'notes']);
const numberFormat = new Intl.NumberFormat('zh-CN');

function taskKey(task: Task, index: number) {
  return task.fileWpsRow !== undefined ? `row:${task.fileWpsRow}` : `${task.id}:${index}`;
}

function fieldValue(task: Task, id: string) {
  const value = task[id];
  if (id === 'startTime' || id === 'endTime') return getTaskDateKey(String(value ?? '')) ?? '未排期';
  if (id === 'plannedQuantity') return `${numberFormat.format(task.plannedQuantity || 0)} m`;
  if (typeof value === 'number') return numberFormat.format(value);
  return String(value ?? '') || '-';
}

interface DisplayField { id: string; label: string }

const ProductionCard = React.memo(function ProductionCard({ task, index, fields, onTaskClick, onProcessCardClick }: {
  task: Task; index: number; fields: DisplayField[];
  onTaskClick: (task: Task) => void; onProcessCardClick: (task: Task) => void;
}) {
  const visible = new Set(fields.map(field => field.id));
  return (
    <article className="floor-order" data-floor-card onClick={() => onTaskClick(task)}>
      <div className="floor-order-head">
        <span className="floor-sequence">{String(index + 1).padStart(2, '0')}</span>
        {visible.has('process') && <span className={cn('floor-process', task.process.includes('胶') || task.process.includes('分切') ? 'floor-process-green' : '')}>{task.process || '未指定工艺'}</span>}
        {visible.has('id') && <button type="button" title="打开电子流程卡" onClick={event => { event.stopPropagation(); onProcessCardClick(task); }} className="floor-order-id">{task.id || '未填卡号'}<ChevronRight size={14} /></button>}
      </div>
      {visible.has('productName') && <h4 title={task.productName} className="floor-product">{task.productName || '未填写品名'}</h4>}
      <div className="floor-order-fields">
        {fields.filter(field => !SPECIAL_FIELDS.has(field.id)).map(field => (
          <div key={field.id} className="floor-field">
            <span className="floor-label">{field.label}</span>
            <span title={fieldValue(task, field.id)}>{fieldValue(task, field.id)}</span>
          </div>
        ))}
      </div>
      {visible.has('notes') && <p className="floor-order-note" title={task.notes || '无工艺备注'}><FileText size={14} /><span>{task.notes || '无工艺备注'}</span></p>}
    </article>
  );
});

export function FloorDisplayView({ tasks, fieldConfig, metrics, currentTime, sortLabel, sortDirection, onTaskClick, onProcessCardClick }: FloorDisplayViewProps) {
  const todayKey = currentTime.slice(0, 10);
  const [showFields, setShowFields] = useState(false);
  const [visibleFields, setVisibleFields] = useLocalStorage<string[]>('mes_floor_visibleFields', DEFAULT_FIELDS);
  const [playing, setPlaying] = useLocalStorage<boolean>('mes_floor_autoRotate', true);
  const [savedInterval, setIntervalSeconds] = useLocalStorage<number>('mes_floor_rotateSeconds', 20);
  const intervalSeconds = [10, 20, 30, 60].includes(savedInterval) ? savedInterval : 20;
  const [machine, setMachine] = useState('');
  const [page, setPage] = useState(1);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  const queueRef = useRef<HTMLDivElement>(null);
  const [capacity, setCapacity] = useState({ columns: 3, rows: 3, pageSize: 9 });
  const machinePageSize = capacity.rows >= 3 ? 2 : 1;
  const notePageSize = capacity.rows >= 3 ? 3 : 2;

  const fields = useMemo(() => fieldConfig.filter(field => field.visible).map(field => ({ id: field.fieldId, label: field.displayName })), [fieldConfig]);
  const cardFields = useMemo(() => fields.filter(field => visibleFields.includes(field.id)), [fields, visibleFields]);
  const todayTasks = useMemo(() => tasks.filter(task => getTaskDateKey(task.startTime) === todayKey), [tasks, todayKey]);
  const machineGroups = useMemo(() => groupFloorMachines(todayTasks), [todayTasks]);
  const effectiveMachine = machineGroups.some(group => group.machine === machine) ? machine : '';
  const queue = useMemo(() => effectiveMachine ? machineGroups.find(group => group.machine === effectiveMachine)?.tasks ?? [] : todayTasks, [todayTasks, machineGroups, effectiveMachine]);
  const noteTasks = useMemo(() => queue.filter(task => task.notes?.trim()), [queue]);
  const volume = useMemo(() => todayTasks.reduce((sum, task) => sum + (task.plannedQuantity || 0), 0), [todayTasks]);
  const queuePages = Math.max(1, Math.ceil(queue.length / capacity.pageSize));
  const machinePages = Math.max(1, Math.ceil(machineGroups.length / machinePageSize));
  const notePages = Math.max(1, Math.ceil(noteTasks.length / notePageSize));
  const pageCount = Math.max(queuePages, machinePages, notePages);
  const currentPage = Math.min(page, pageCount);
  const queuePage = ((currentPage - 1) % queuePages) + 1;
  const displayTasks = getFloorPage<Task>(queue, currentPage, capacity.pageSize);
  const displayMachines = getFloorPage<FloorMachineGroup>(machineGroups, currentPage, machinePageSize);
  const displayNotes = getFloorPage<Task>(noteTasks, currentPage, notePageSize);

  useLayoutEffect(() => {
    const element = queueRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      const next = getFloorCapacity(entry.contentRect.width, entry.contentRect.height);
      setCapacity(previous => previous.columns === next.columns && previous.rows === next.rows ? previous : next);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => { setPage(1); }, [todayTasks, effectiveMachine, capacity.pageSize]);
  useEffect(() => {
    const onVisibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);
  useEffect(() => {
    if (!playing || showFields || !pageVisible || pageCount < 2) return;
    const timer = window.setInterval(() => setPage(previous => previous >= pageCount ? 1 : previous + 1), intervalSeconds * 1000);
    return () => window.clearInterval(timer);
  }, [playing, showFields, pageVisible, pageCount, intervalSeconds, page]);

  const openTask = (task: Task) => { setPlaying(false); onTaskClick(task); };
  const openCard = (task: Task) => { setPlaying(false); onProcessCardClick(task); };
  const toggleField = (id: string) => setVisibleFields(previous => previous.includes(id)
    ? cardFields.length > 1 ? previous.filter(field => field !== id) : previous
    : [...previous, id]);

  return (
    <div className="floor-display">
      <header className="floor-summary">
        <div className="floor-title"><h2>生产执行看板</h2><span>{todayKey.replaceAll('-', '.')}</span></div>
        <div className="floor-metrics">
          <Metric label="当日生产单" value={numberFormat.format(todayTasks.length)} unit="单" />
          <Metric label="计划生产量" value={numberFormat.format(volume)} unit="m" />
          <Metric label="排产机台" value={numberFormat.format(machineGroups.filter(group => group.machine !== '未分配机台').length)} unit="台" />
          <Metric label="数据总量" value={numberFormat.format(metrics.totalOrders)} unit="单" />
        </div>
      </header>

      <div className="floor-layout">
        <section className="floor-queue" aria-label="当日生产队列">
          <div className="floor-section-header">
            <h3><ClipboardList size={20} />当日生产队列 <small>{queue.length} 单</small></h3>
            <div className="floor-queue-controls">
              <span className="floor-sort" title={`排序：${sortLabel}`}>{sortDirection === 'asc' ? <ArrowUpAZ size={15} /> : <ArrowDownAZ size={15} />}{sortLabel}</span>
              <select aria-label="机台筛选" value={effectiveMachine} onChange={event => setMachine(event.target.value)}>
                <option value="">全部机台</option>
                {machineGroups.map(group => <option key={group.machine} value={group.machine}>{group.machine}</option>)}
              </select>
              <div className="floor-fields-menu">
                <button type="button" title="卡片字段" aria-label="卡片字段" aria-expanded={showFields} onClick={() => setShowFields(!showFields)} className="floor-icon-button"><Settings2 size={18} /></button>
                {showFields && <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowFields(false)} />
                  <div className="floor-field-popup">
                    {fields.map(field => <button type="button" role="menuitemcheckbox" aria-checked={visibleFields.includes(field.id)} key={field.id} onClick={() => toggleField(field.id)}>{field.label}{visibleFields.includes(field.id) && <Check size={14} />}</button>)}
                  </div>
                </>}
              </div>
            </div>
          </div>
          <div ref={queueRef} className="floor-queue-viewport">
            {displayTasks.length ? <div className="floor-queue-grid" style={{ gridTemplateColumns: `repeat(${capacity.columns}, minmax(0, 1fr))`, gridTemplateRows: `repeat(${capacity.rows}, minmax(0, 1fr))` }}>
              {displayTasks.map((task, index) => <ProductionCard key={taskKey(task, index)} task={task} index={(queuePage - 1) * capacity.pageSize + index} fields={cardFields} onTaskClick={openTask} onProcessCardClick={openCard} />)}
            </div> : <div className="floor-empty"><CalendarDays size={28} /><span>当日暂无符合条件的生产安排</span></div>}
          </div>
        </section>

        <aside className="floor-sidebar">
          <section className="floor-machines" aria-label="机台生产安排">
            <div className="floor-section-header"><h3><Factory size={20} />机台生产安排</h3><small>{machineGroups.length} 组</small></div>
            <div className="floor-machine-list">
              {displayMachines.map(group => <div className="floor-machine" key={group.machine}>
                <button type="button" className="floor-machine-heading" title={`查看${group.machine}生产单`} aria-pressed={effectiveMachine === group.machine} onClick={() => setMachine(effectiveMachine === group.machine ? '' : group.machine)}>
                  <strong>{group.machine}</strong><span>{group.tasks.length} 单</span><b>{numberFormat.format(group.volume)} <small>m</small></b>
                </button>
                <div className="floor-volume-track" title={`计划米数占当日计划米数 ${volume ? Math.round(group.volume / volume * 100) : 0}%`}><div style={{ width: `${volume ? Math.min(100, Math.max(0, group.volume / volume * 100)) : 0}%` }} /></div>
                <div className="floor-machine-orders">
                  {group.tasks.slice(0, 4).map((task, index) => <button type="button" key={taskKey(task, index)} onClick={() => openTask(task)} title={task.productName}>{task.id || task.productName || '未填卡号'}</button>)}
                  {group.tasks.length > 4 && <button type="button" onClick={() => setMachine(group.machine)}>+{group.tasks.length - 4} 单</button>}
                </div>
              </div>)}
              {!displayMachines.length && <p className="floor-muted">暂无机台安排</p>}
            </div>
          </section>
          <section className="floor-notes" aria-label="工艺备注">
            <div className="floor-section-header"><h3><FileText size={20} />工艺备注</h3><small>{noteTasks.length} 条</small></div>
            <div className="floor-note-list">
              {displayNotes.map((task, index) => <button type="button" key={taskKey(task, index)} className="floor-note" onClick={() => openTask(task)} title={task.notes}>
                <span>{task.id || '未填卡号'}<small>{task.machineName}</small></span><p>{task.notes}</p>
              </button>)}
              {!displayNotes.length && <p className="floor-muted">暂无工艺备注</p>}
            </div>
          </section>
        </aside>
      </div>

      <footer className="floor-footer">
        <div className="floor-pagination">
          <button type="button" title="上一展示页" aria-label="上一展示页" disabled={pageCount <= 1} onClick={() => setPage(currentPage <= 1 ? pageCount : currentPage - 1)} className="floor-icon-button"><ChevronLeft size={18} /></button>
          <span aria-live="polite">展示 {currentPage} / {pageCount}</span>
          <button type="button" title="下一展示页" aria-label="下一展示页" disabled={pageCount <= 1} onClick={() => setPage(currentPage >= pageCount ? 1 : currentPage + 1)} className="floor-icon-button"><ChevronRight size={18} /></button>
          <small>队列 {queuePage}/{queuePages}<span className="floor-footer-note-count">　备注 {(currentPage - 1) % notePages + 1}/{notePages}</span></small>
        </div>
        <div className="floor-rotation"><RotateCw size={16} /><span>自动轮播</span>
          <select aria-label="轮播间隔" value={intervalSeconds} onChange={event => setIntervalSeconds(Number(event.target.value))}>{[10, 20, 30, 60].map(seconds => <option key={seconds} value={seconds}>{seconds} 秒</option>)}</select>
          <button type="button" title={playing ? '暂停轮播' : '开始轮播'} aria-label={playing ? '暂停轮播' : '开始轮播'} onClick={() => setPlaying(!playing)} className="floor-icon-button">{playing ? <Pause size={18} /> : <Play size={18} />}</button>
        </div>
      </footer>
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return <div className="floor-metric"><span>{label}</span><strong>{value}<small>{unit}</small></strong></div>;
}
