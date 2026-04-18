import React, { useState, useEffect, useRef, useMemo } from 'react';
import { format } from 'date-fns';
import { Task } from '../types';
import { cn } from './MetricCard';
import { Columns, Rows, Check, ListTree, ChevronDown, ChevronRight, GripVertical, FilterX } from 'lucide-react';
import { useAutoScroll } from '../hooks/useAutoScroll';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface TableViewProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onProcessCardClick: (url: string) => void;
  isAutoScrolling?: boolean;
}

type Spacing = 'compact' | 'normal' | 'relaxed';
const spacingStyles = {
  compact: 'px-2 py-1',
  normal: 'px-4 py-2',
  relaxed: 'px-6 py-4',
};

const COLUMNS = [
  { id: 'id', label: '流程卡号', defaultWidth: 120, groupable: false },
  { id: 'process', label: '工艺', defaultWidth: 100, groupable: true },
  { id: 'machineName', label: '机台', defaultWidth: 120, groupable: true },
  { id: 'productName', label: '品名颜色', defaultWidth: 200, groupable: true },
  { id: 'specification', label: '规格', defaultWidth: 150, groupable: true },
  { id: 'plannedQuantity', label: '预计数量/m', defaultWidth: 120, groupable: false },
  { id: 'actualOutput', label: '实际产出', defaultWidth: 120, groupable: false },
  { id: 'slittingQuantity', label: '分切数量', defaultWidth: 120, groupable: false },
  {id: 'shippedQuantity', label: '实际出货数量', defaultWidth: 120, groupable: false },
  { id: 'operator', label: '操作员', defaultWidth: 100, groupable: true },
  { id: 'notes', label: '工艺备注', defaultWidth: 200, groupable: true },
];

export function TableView({ tasks, onTaskClick, onProcessCardClick, isAutoScrolling = false }: TableViewProps) {
  const scrollRef = useAutoScroll(isAutoScrolling);
  const [spacing, setSpacing] = useLocalStorage<Spacing>('mes_table_spacing', 'compact');
  const [columnOrder, setColumnOrder] = useLocalStorage<string[]>('mes_table_columnOrder', COLUMNS.map(c => c.id));
  const [visibleColsArr, setVisibleColsArr] = useLocalStorage<string[]>('mes_table_visibleCols', COLUMNS.map(c => c.id));
  const visibleCols = new Set(visibleColsArr);
  const [showColMenu, setShowColMenu] = useState(false);
  const [showSpacingMenu, setShowSpacingMenu] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const [groupBy, setGroupBy] = useLocalStorage<string>('mes_table_groupBy', 'none');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useLocalStorage<Record<string, string>>('mes_table_filters', {});

  const clearFilter = (colId: string) => {
    const newFilters = { ...filters };
    delete newFilters[colId];
    setFilters(newFilters);
  };

  const toggleCol = (id: string) => {
    const next = new Set(visibleCols);
    if (next.has(id)) {
      if (next.size > 1) next.delete(id);
    } else {
      next.add(id);
    }
    setVisibleColsArr(Array.from(next));
  };
  
  // Reorder COLUMNS based on columnOrder
  const orderedColumns = useMemo(() => {
    return [...COLUMNS].sort((a, b) => columnOrder.indexOf(a.id) - columnOrder.indexOf(b.id));
  }, [columnOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      setColumnOrder((items) => {
        const oldIndex = items.indexOf(active.id);
        const newIndex = items.indexOf(over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };
  
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem('mes_table_col_widths');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    const initial: Record<string, number> = {};
    COLUMNS.forEach(c => initial[c.id] = c.defaultWidth);
    return initial;
  });

  useEffect(() => {
    localStorage.setItem('mes_table_col_widths', JSON.stringify(colWidths));
  }, [colWidths]);

  const handleResizeStart = (e: React.MouseEvent, colId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    const startX = e.clientX;
    const startWidth = colWidths[colId] || 100;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(60, startWidth + (moveEvent.clientX - startX));
      setColWidths(prev => ({ ...prev, [colId]: newWidth }));
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const spacingStyles = {
    compact: 'py-1.5 px-3 text-xs',
    normal: 'py-3 px-4 text-sm',
    relaxed: 'py-5 px-6 text-sm',
  };

  const cellClass = cn("font-medium transition-colors duration-200", spacingStyles[spacing]);

  useEffect(() => {
    if (groupBy !== 'none') {
      const keys = new Set<string>();
      tasks.forEach(task => {
        let key = String(task[groupBy as keyof Task]);
        keys.add(key);
      });
      setExpandedGroups(keys);
    }
  }, [groupBy, tasks]);

  const toggleGroup = (groupName: string) => {
    const next = new Set(expandedGroups);
    if (next.has(groupName)) next.delete(groupName);
    else next.add(groupName);
    setExpandedGroups(next);
  };

  // Apply all column filters before grouping
  const filteredTasks = useMemo(() => {
    let result = tasks;
    const filterEntries = Object.entries(filters).filter(([_, value]) => value.trim() !== '');
    if (filterEntries.length === 0) return result;

    return result.filter(task => {
      return filterEntries.every(([colId, filterValue]) => {
        const value = String(task[colId as keyof Task] || '').toLowerCase();
        return value.includes(filterValue.trim().toLowerCase());
      });
    });
  }, [tasks, filters]);

  const groupedTasks = React.useMemo<Record<string, Task[]>>(() => {
    if (groupBy === 'none') return { '所有任务': filteredTasks };
    const groups: Record<string, Task[]> = {};
    filteredTasks.forEach(task => {
      let key = String(task[groupBy as keyof Task]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(task);
    });
    return groups;
  }, [filteredTasks, groupBy]);

  return (
    <div className="w-full h-full flex flex-col rounded-xl border border-blue-900/50 bg-slate-900/50 backdrop-blur-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex justify-between items-center px-4 py-2 border-b border-blue-900/50 bg-slate-800/50 shrink-0">
        <div className="text-sm text-slate-400 font-medium">
          共 {tasks.length} 条记录
        </div>
        <div className="flex items-center gap-3">
          {/* Group Menu */}
          <div className="relative">
            <button 
              onClick={() => { setShowGroupMenu(!showGroupMenu); setShowColMenu(false); setShowSpacingMenu(false); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <ListTree className="w-3.5 h-3.5" />
              分组
            </button>
            {showGroupMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowGroupMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-32 bg-slate-800 border border-blue-900/50 rounded-lg shadow-xl py-1 overflow-hidden">
                  <button
                    onClick={() => { setGroupBy('none'); setShowGroupMenu(false); }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-between"
                  >
                    不分组
                    {groupBy === 'none' && <Check className="w-3.5 h-3.5 text-blue-400" />}
                  </button>
                  {COLUMNS.filter(c => c.groupable).map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => { setGroupBy(opt.id); setShowGroupMenu(false); }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-between"
                    >
                      按{opt.label}
                      {groupBy === opt.id && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Spacing Menu */}
          <div className="relative">
            <button 
              onClick={() => { setShowSpacingMenu(!showSpacingMenu); setShowColMenu(false); setShowGroupMenu(false); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <Rows className="w-3.5 h-3.5" />
              行距
            </button>
            {showSpacingMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowSpacingMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-32 bg-slate-800 border border-blue-900/50 rounded-lg shadow-xl py-1 overflow-hidden">
                  {[
                    { id: 'compact', label: '紧凑' },
                    { id: 'normal', label: '标准' },
                    { id: 'relaxed', label: '宽松' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => { setSpacing(opt.id as Spacing); setShowSpacingMenu(false); }}
                      className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white flex items-center justify-between"
                    >
                      {opt.label}
                      {spacing === opt.id && <Check className="w-3.5 h-3.5 text-blue-400" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Columns Menu */}
          <div className="relative">
            <button 
              onClick={() => { setShowColMenu(!showColMenu); setShowSpacingMenu(false); setShowGroupMenu(false); }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors"
            >
              <Columns className="w-3.5 h-3.5" />
              列显示
            </button>
            {showColMenu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowColMenu(false)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-slate-800 border border-blue-900/50 rounded-lg shadow-xl py-1 overflow-hidden">
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={orderedColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
                      {orderedColumns.map(col => (
                        <SortableMenuItem key={col.id} col={col} visibleCols={visibleCols} toggleCol={toggleCol} />
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Table Container */}
      <div className="flex-1 overflow-auto relative" ref={scrollRef}>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedColumns.map(c => c.id)} strategy={horizontalListSortingStrategy}>
            <table className="w-full text-left text-slate-300 min-w-max">
              <thead className="text-xs text-blue-300 uppercase bg-slate-800/80 sticky top-0 z-10 shadow-sm">
                <tr>
                  {orderedColumns.map(col => visibleCols.has(col.id) && (
                    <SortableHeader key={col.id} col={col} spacing={spacing} colWidths={colWidths} handleResizeStart={handleResizeStart} filters={filters} setFilters={setFilters} />
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-blue-900/30">
                {(Object.entries(groupedTasks) as [string, Task[]][]).map(([groupName, groupTasks]) => {
                  const isExpanded = groupBy === 'none' || expandedGroups.has(groupName);
                  
                  return (
                    <React.Fragment key={groupName}>
                      {groupBy !== 'none' && (
                        <tr 
                          className="bg-slate-800/90 border-y border-blue-900/50 cursor-pointer hover:bg-slate-700/80 transition-colors"
                          onClick={() => toggleGroup(groupName)}
                        >
                          <td colSpan={visibleCols.size} className="px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-blue-400" /> : <ChevronRight className="w-4 h-4 text-blue-400" />}
                              <span className="font-bold text-blue-100 text-sm">{groupName}</span>
                              <span className="text-xs text-slate-400 bg-slate-900/50 px-2 py-0.5 rounded-full">{groupTasks.length} 项</span>
                            </div>
                          </td>
                        </tr>
                      )}
                      {isExpanded && groupTasks.map((task) => (
                        <tr 
                          key={task.id} 
                          onClick={() => onTaskClick(task)}
                          className="hover:bg-slate-800/80 transition-colors group cursor-pointer"
                        >
                          {orderedColumns.map(col => visibleCols.has(col.id) && (
                            <td 
                              key={col.id}
                              className={cn(cellClass, col.id === 'notes' ? "whitespace-normal break-words min-w-[200px]" : "truncate", col.id === 'id' && "text-blue-400 font-mono cursor-pointer hover:underline")}
                              onClick={(e) => { 
                                if (col.id === 'id') { e.stopPropagation(); onProcessCardClick(task.fileUrl || ''); }
                              }}
                            >
                              {col.id === 'notes' ? task.notes : task[col.id as keyof Task]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}

function SortableMenuItem({ col, visibleCols, toggleCol }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: col.id });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center px-4 py-2 text-xs text-slate-300 hover:bg-slate-700 hover:text-white">
      <div {...attributes} {...listeners} className="cursor-grab mr-2">
        <GripVertical className="w-3.5 h-3.5 text-slate-500" />
      </div>
      <button onClick={() => toggleCol(col.id)} className="flex-1 text-left flex items-center justify-between">
        {col.label}
        {visibleCols.has(col.id) && <Check className="w-3.5 h-3.5 text-blue-400" />}
      </button>
    </div>
  );
}

function SortableHeader({ col, spacing, colWidths, handleResizeStart, filters, setFilters }: any) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: col.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    width: colWidths[col.id]
  };
  const currentFilter = filters[col.id] || '';

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value) {
      setFilters({ ...filters, [col.id]: value });
    } else {
      const newFilters = { ...filters };
      delete newFilters[col.id];
      setFilters(newFilters);
    }
  };

  return (
    <th
      ref={setNodeRef}
      style={style}
      className={cn("font-medium border-b border-blue-900/50 bg-slate-800/90 backdrop-blur-md relative group select-none", spacingStyles[spacing])}
    >
      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <div {...attributes} {...listeners} className="cursor-grab">
            <GripVertical className="w-3 h-3 text-slate-500" />
          </div>
          <div className="truncate pr-4 font-medium">{col.label}</div>
        </div>
        <div className="relative mt-1">
          <input
            type="text"
            value={currentFilter}
            onChange={handleFilterChange}
            placeholder={`筛选...`}
            className={cn(
              "w-full bg-slate-900/80 border rounded px-2 py-0.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500",
              currentFilter ? "border-blue-400" : "border-slate-700"
            )}
          />
          {currentFilter && (
            <button
              onClick={() => {
                const newFilters = { ...filters };
                delete newFilters[col.id];
                setFilters(newFilters);
              }}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <FilterX className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      <div
        className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/50 group-hover:bg-blue-500/30 z-20"
        onMouseDown={(e) => handleResizeStart(e, col.id)}
      />
    </th>
  );
}
