import React, { useState, useMemo, useEffect } from 'react';
import { TableView } from './components/TableView';
import { CalendarView } from './components/CalendarView';
import { TaskView } from './components/TaskView';
import { MetricCard } from './components/MetricCard';
import { TaskDetailModal } from './components/TaskDetailModal';
import { SettingsModal } from './components/SettingsModal';
import { ExcelPreviewModal } from './components/ExcelPreviewModal';
import { INITIAL_TASKS, MACHINES } from './data';
import { fetchTasksFromWps, getWpsAccessToken } from './services/wps';
import { LayoutDashboard, TableProperties, KanbanSquare, Activity, CheckCircle2, Clock, Settings as SettingsIcon, Play, Square, Search, Loader2 } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { cn } from './components/MetricCard';
import { motion, AnimatePresence } from 'motion/react';
import { Task } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';

type ViewMode = 'table' | 'calendar' | 'task';

export default function App() {
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('mes_viewMode', 'calendar');
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSyncing, setIsSyncing] = useState(false);
  
  const currentTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

  const metrics = useMemo(() => {
    const totalOrders = tasks.length;
    const todayTasks = tasks.filter(t => isSameDay(new Date(t.startTime), new Date()));
    const todayCount = todayTasks.length;
    const todayVolume = todayTasks.reduce((sum, t) => sum + (t.plannedQuantity || 0), 0);
    
    return { totalOrders, todayCount, todayVolume };
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t => 
        t.id.toLowerCase().includes(q) ||
        t.productName.toLowerCase().includes(q) ||
        t.machineName.toLowerCase().includes(q) ||
        t.operator.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q)
      );
    }
    return filtered;
  }, [tasks, searchQuery]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleProcessCardClick = (url?: string) => {
    if (url) setPreviewUrl(url);
  };

  // Common sync logic from WPS
  const syncTasksFromWps = async (): Promise<void> => {
    try {
      setIsSyncing(true);
      const token = await getWpsAccessToken();
      const wpsTasks = await fetchTasksFromWps(token);
      if (wpsTasks.length > 0) {
        setTasks(wpsTasks);
        console.log(`Synced ${wpsTasks.length} tasks from WPS`);
      } else {
        console.warn('No tasks found in WPS spreadsheet, keeping current data');
      }
    } catch (err) {
      console.error('WPS sync failed:', err);
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncWPS = async (
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    config: any
  ): Promise<void> => {
    await syncTasksFromWps();
  };

  // Auto sync on app start
  useEffect(() => {
    const autoSync = async () => {
      // Only auto-sync if WPS is configured
      if (import.meta.env.VITE_WPS_APP_ID && import.meta.env.VITE_WPS_SPREADSHEET_ID) {
        try {
          await syncTasksFromWps();
          console.log('Auto-sync completed on startup');
        } catch (err) {
          console.error('Auto WPS sync failed, using initial data:', err);
        }
      }
    };

    autoSync();
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30 flex flex-col">
      <header className="h-16 border-b border-blue-900/50 bg-slate-900/80 backdrop-blur-md flex items-center justify-between px-6 sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)]">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent tracking-wide">
            烫金膜生产排产看板
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input 
              type="text"
              placeholder="搜索任务..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-blue-900/50 rounded-lg py-1.5 pl-9 pr-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 w-48"
            />
          </div>

          <div className="flex bg-slate-950 rounded-lg p-1 border border-blue-900/50">
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                viewMode === 'table' ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              )}
            >
              <TableProperties className="w-4 h-4" />
              表格视图
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                viewMode === 'calendar' ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              日历视图
            </button>
            <button
              onClick={() => setViewMode('task')}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                viewMode === 'task' ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              )}
            >
              <KanbanSquare className="w-4 h-4" />
              任务视图
            </button>
          </div>
          
          <div className="text-sm font-mono text-blue-300 bg-blue-950/50 px-3 py-1.5 rounded-lg border border-blue-900/50 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {currentTime}
          </div>

          {isSyncing && (
            <div className="text-sm text-blue-300 bg-blue-950/50 px-3 py-1.5 rounded-lg border border-blue-900/50 flex items-center gap-2 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              同步中...
            </div>
          )}

          <button 
            onClick={() => setIsAutoScrolling(!isAutoScrolling)}
            className={cn(
              "p-2 rounded-lg transition-colors border flex items-center gap-2 text-sm font-medium",
              isAutoScrolling 
                ? "bg-blue-600/20 text-blue-400 border-blue-500/50 shadow-[0_0_10px_rgba(37,99,235,0.3)]" 
                : "text-slate-400 hover:text-white hover:bg-slate-800 border-transparent hover:border-slate-700"
            )}
            title="自动滚动屏幕"
          >
            {isAutoScrolling ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {isAutoScrolling ? '停止滚动' : '自动滚动'}
          </button>

          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
            title="数据源配置"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-6 flex flex-col gap-6 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
          <MetricCard title="所有生产单" value={metrics.totalOrders} icon={<LayoutDashboard className="w-5 h-5" />} />
          <MetricCard title="当日计划生产数" value={metrics.todayCount} icon={<Activity className="w-5 h-5" />} className="border-blue-500/30" />
          <MetricCard title="当日计划生产量" value={`${metrics.todayVolume} m`} icon={<CheckCircle2 className="w-5 h-5" />} className="border-emerald-500/30" />
        </div>

        <div className="flex-1 min-h-0 overflow-auto bg-slate-900/20 rounded-xl border border-blue-900/30 p-4 shadow-inner relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={viewMode}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {viewMode === 'table' && <TableView tasks={filteredTasks} onTaskClick={handleTaskClick} onProcessCardClick={handleProcessCardClick} isAutoScrolling={isAutoScrolling} />}
              {viewMode === 'calendar' && <CalendarView tasks={filteredTasks} onTaskClick={handleTaskClick} onProcessCardClick={handleProcessCardClick} isAutoScrolling={isAutoScrolling} />}
              {viewMode === 'task' && <TaskView tasks={filteredTasks} onTaskClick={handleTaskClick} onProcessCardClick={handleProcessCardClick} isAutoScrolling={isAutoScrolling} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {selectedTask && <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />}
      {previewUrl && <ExcelPreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onSync={handleSyncWPS} />}
    </div>
  );
}
