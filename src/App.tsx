import React, { useState, useMemo, useEffect, Suspense } from 'react';
import { MetricCard } from './components/MetricCard';
import { INITIAL_TASKS, MACHINES } from './data';
import { fetchTasksFromWps, getWpsAccessToken, getCellAttachments, cachedToken } from './services/wps';
import { LayoutDashboard, TableProperties, KanbanSquare, Activity, CheckCircle2, Clock, Settings as SettingsIcon, Search, Loader2 } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { cn } from './components/MetricCard';
import { AnimatePresence, motion } from 'motion/react';
import { Task } from './types';
import { useLocalStorage } from './hooks/useLocalStorage';

// Lazy load heavy components that are not always visible
const TableView = React.lazy(() => import('./components/TableView').then(m => ({ default: m.TableView })));
const CalendarView = React.lazy(() => import('./components/CalendarView').then(m => ({ default: m.CalendarView })));
const TaskView = React.lazy(() => import('./components/TaskView').then(m => ({ default: m.TaskView })));
const TaskDetailModal = React.lazy(() => import('./components/TaskDetailModal').then(m => ({ default: m.TaskDetailModal })));
const SettingsModal = React.lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const ExcelPreviewModal = React.lazy(() => import('./components/ExcelPreviewModal').then(m => ({ default: m.ExcelPreviewModal })));

type ViewMode = 'table' | 'calendar' | 'task';

export default function App() {
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('mes_viewMode', 'calendar');
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [previewTask, setPreviewTask] = useState<Task | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterToday, setFilterToday] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGettingToken, setIsGettingToken] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [tokenResponse, setTokenResponse] = useState<string>('');
  const [syncResponse, setSyncResponse] = useState<string>('');
  const [autoCode, setAutoCode] = useState<string | undefined>();

  // Extract code from URL search params on mount (for OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setAutoCode(code);
      // Open settings modal automatically when code is present in URL
      setShowSettings(true);
      // Clean up URL to remove code parameter
      const newUrl = window.location.origin + window.location.pathname;
      window.history.replaceState({}, document.title, newUrl);
    }
  }, []);

  const [currentTime, setCurrentTime] = useState(format(new Date(), 'yyyy-MM-dd HH:mm:ss'));

  // Auto-update clock every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(format(new Date(), 'yyyy-MM-dd HH:mm:ss'));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

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
        t.notes.toLowerCase().includes(q) ||
        t.process.toLowerCase().includes(q)
      );
    }
    if (filterToday) {
      filtered = filtered.filter(t => isSameDay(new Date(t.startTime), new Date()));
    }
    return filtered;
  }, [tasks, searchQuery, filterToday]);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  // Handle process card click - open modal, modal handles getting attachment via WebOffice SDK
  const handleProcessCardClick = async (task: Task) => {
    setPreviewTask(task);
  };

  // Common sync logic from WPS
  const syncTasksFromWps = async (config?: {
    appId: string;
    appKey: string;
    apiUrl: string;
    fileId: string;
    worksheetId?: number;
    rowFrom?: number;
    rowTo?: number;
    colFrom?: number;
    colTo?: number;
  }): Promise<void> => {
    try {
      setIsSyncing(true);
      const token = await getWpsAccessToken(undefined, config);
      const { tasks: wpsTasks, rawData } = await fetchTasksFromWps(token.access_token, {
        spreadsheetId: config?.fileId,
        worksheetId: config?.worksheetId,
        rowFrom: config?.rowFrom,
        rowTo: config?.rowTo,
        colFrom: config?.colFrom,
        colTo: config?.colTo,
        apiBase: config?.apiUrl,
      });
      setSyncResponse(JSON.stringify(rawData, null, 2));
      if (wpsTasks.length > 0) {
        setTasks(wpsTasks);
        console.log(`Synced ${wpsTasks.length} tasks from WPS`);
      } else {
        console.warn('No tasks found in WPS spreadsheet, keeping current data');
      }
    } catch (err) {
      console.error('WPS sync failed:', err);
      setSyncResponse(JSON.stringify({ error: String(err) }, null, 2));
      throw err;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleSyncWPS = async (config: any): Promise<void> => {
    setSyncResponse('');
    await syncTasksFromWps(config);
  };

  // Get access token with authorization code
  const handleGetToken = async (code: string, config?: {
    appId: string;
    appKey: string;
    apiUrl: string;
    redirectUri: string;
  }): Promise<void> => {
    setIsGettingToken(true);
    setTokenStatus('idle');
    setTokenResponse('');
    try {
      // getWpsAccessToken already handles the request through proxy
      const data = await getWpsAccessToken(code, config);
      setTokenResponse(JSON.stringify(data, null, 2));

      if (data.access_token) {
        setTokenStatus('success');
        console.log('Access token obtained successfully');
      } else {
        setTokenStatus('error');
        console.error('Failed to get access token:', data);
      }
    } catch (err) {
      console.error('Failed to get access token:', err);
      setTokenStatus('error');
      setTokenResponse(JSON.stringify({ error: String(err) }, null, 2));
    } finally {
      setIsGettingToken(false);
    }
  };

  // Refresh access token with refresh token
  const handleRefreshToken = async (): Promise<void> => {
    setIsGettingToken(true);
    setTokenStatus('idle');
    setTokenResponse('');
    try {
      // getWpsAccessToken already handles refresh token logic automatically
      const data = await getWpsAccessToken();
      setTokenResponse(JSON.stringify(data, null, 2));

      if (data.access_token) {
        setTokenStatus('success');
        console.log('Access token refreshed successfully');
      } else {
        setTokenStatus('error');
        console.error('Failed to refresh access token:', data);
      }
    } catch (err) {
      console.error('Failed to refresh access token:', err);
      setTokenStatus('error');
      setTokenResponse(JSON.stringify({ error: String(err) }, null, 2));
    } finally {
      setIsGettingToken(false);
    }
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
          <MetricCard
            title="所有生产单"
            value={metrics.totalOrders}
            icon={<LayoutDashboard className="w-5 h-5" />}
            onClick={() => setFilterToday(false)}
            active={!filterToday}
          />
          <MetricCard
            title="当日计划生产数"
            value={metrics.todayCount}
            icon={<Activity className="w-5 h-5" />}
            className="border-blue-500/30"
            onClick={() => setFilterToday(true)}
            active={filterToday}
          />
          <MetricCard
            title="当日计划生产量"
            value={`${metrics.todayVolume} m`}
            icon={<CheckCircle2 className="w-5 h-5" />}
            className="border-emerald-500/30"
            onClick={() => setFilterToday(true)}
            active={filterToday}
          />
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
              <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-blue-400" /></div>}>
                {viewMode === 'table' && <TableView tasks={filteredTasks} onTaskClick={handleTaskClick} onProcessCardClick={handleProcessCardClick} />}
                {viewMode === 'calendar' && <CalendarView tasks={filteredTasks} onTaskClick={handleTaskClick} onProcessCardClick={handleProcessCardClick} />}
                {viewMode === 'task' && <TaskView tasks={filteredTasks} onTaskClick={handleTaskClick} onProcessCardClick={handleProcessCardClick} />}
              </Suspense>
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      <AnimatePresence>
        {selectedTask && (
          <Suspense fallback={null}>
            <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
          </Suspense>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {previewTask && (
          <Suspense fallback={null}>
            <ExcelPreviewModal
              task={previewTask}
              mainFileId={(() => {
                const savedConfig = localStorage.getItem('wps_config');
                if (savedConfig) {
                  const parsed = JSON.parse(savedConfig);
                  return parsed.fileId || '';
                }
                return '';
              })()}
              onClose={() => setPreviewTask(null)}
            />
          </Suspense>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showSettings && (
          <Suspense fallback={null}>
            <SettingsModal
              onClose={() => setShowSettings(false)}
              onSync={handleSyncWPS}
              onGetToken={handleGetToken}
              onRefreshToken={handleRefreshToken}
              tokenStatus={tokenStatus}
              isGettingToken={isGettingToken}
              initialCode={autoCode}
              tokenResponse={tokenResponse}
              syncResponse={syncResponse}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}
