import React, { useState, useMemo, useEffect, useCallback, useRef, Suspense } from 'react';
import { MetricCard } from './components/MetricCard';
import { INITIAL_TASKS, MACHINES } from './data';
import { fetchTasksFromWps, getWpsAccessToken, getCellAttachments, cachedToken, syncTasksFromWps } from './services/wps';
import { LayoutDashboard, TableProperties, KanbanSquare, Activity, CheckCircle2, Clock, Settings as SettingsIcon, Search, Loader2, CheckCircle, XCircle, Factory, ArrowDownAZ, ArrowUpAZ, MonitorUp, Maximize2, Minimize2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from './components/MetricCard';
import { AnimatePresence, motion } from 'motion/react';
import { Task, CustomFieldConfig, SortConfig } from './types';
import { DEFAULT_FIELD_CONFIG } from './data';
import { useLocalStorage } from './hooks/useLocalStorage';
import { getNextDailySyncDelayMs } from './syncSchedule';
import { filterTasksByToday, isTaskOnDate } from './dateFilters';
import { DEFAULT_SORT_CONFIG, getSortFieldOptions, sortTasks } from './sorting';

// Lazy load heavy components that are not always visible
const TableView = React.lazy(() => import('./components/TableView').then(m => ({ default: m.TableView })));
const CalendarView = React.lazy(() => import('./components/CalendarView').then(m => ({ default: m.CalendarView })));
const TaskView = React.lazy(() => import('./components/TaskView').then(m => ({ default: m.TaskView })));
const ProcessCardView = React.lazy(() => import('./components/ProcessCardView').then(m => ({ default: m.ProcessCardView })));
const FloorDisplayView = React.lazy(() => import('./components/FloorDisplayView').then(m => ({ default: m.FloorDisplayView })));
const TaskDetailModal = React.lazy(() => import('./components/TaskDetailModal').then(m => ({ default: m.TaskDetailModal })));
const SettingsModal = React.lazy(() => import('./components/SettingsModal').then(m => ({ default: m.SettingsModal })));
const ExcelPreviewModal = React.lazy(() => import('./components/ExcelPreviewModal').then(m => ({ default: m.ExcelPreviewModal })));

type ViewMode = 'table' | 'calendar' | 'task' | 'processCard' | 'floor';

export default function App() {
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('mes_viewMode', 'calendar');
  const [tasks, setTasks] = useLocalStorage<Task[]>('mes_tasks', INITIAL_TASKS);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [previewTask, setPreviewTask] = useState<Task | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterToday, setFilterToday] = useState(false);
  const [sortConfig, setSortConfig] = useLocalStorage<SortConfig>('mes_sortConfig', DEFAULT_SORT_CONFIG);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isGettingToken, setIsGettingToken] = useState(false);
  const [tokenStatus, setTokenStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [tokenResponse, setTokenResponse] = useState<string>('');
  const [syncResponse, setSyncResponse] = useState<string>('');
  const [autoCode, setAutoCode] = useState<string | undefined>();

  // Load field configuration from localStorage
  const [fieldConfig, setFieldConfig] = useLocalStorage<CustomFieldConfig[]>('mes_field_mapping_config', DEFAULT_FIELD_CONFIG);

  // Toast notification for auto-sync events
  const [toast, setToast] = useState<{
    visible: boolean;
    message: string;
    type: 'success' | 'error';
  }>({ visible: false, message: '', type: 'success' });

  // Auto-hide toast after 3 seconds
  useEffect(() => {
    if (toast.visible) {
      const timer = setTimeout(() => {
        setToast(prev => ({ ...prev, visible: false }));
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toast.visible]);

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

  const [currentTime, setCurrentTime] = useState(format(new Date(), 'yyyy-MM-dd HH:mm'));

  // Auto-update clock every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(format(new Date(), 'yyyy-MM-dd HH:mm'));
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    handleFullscreenChange();
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const metrics = useMemo(() => {
    const today = new Date();
    const totalOrders = tasks.length;
    const todayTasks = tasks.filter(t => isTaskOnDate(t, today));
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
    return filterTasksByToday(filtered, filterToday);
  }, [tasks, searchQuery, filterToday]);

  const sortedTasks = useMemo(() => sortTasks(filteredTasks, sortConfig), [filteredTasks, sortConfig]);
  const sortFields = useMemo(() => getSortFieldOptions(fieldConfig), [fieldConfig]);
  const currentSortLabel = sortFields.find(field => field.id === sortConfig.fieldId)?.label || sortConfig.fieldId;
  const filteredViewKey = `${filterToday ? 'today' : 'all'}:${searchQuery}:${sortConfig.fieldId}:${sortConfig.direction}`;

  const showAllTasks = () => setFilterToday(false);
  const showTodayTasks = () => setFilterToday(true);

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const updateSortField = (fieldId: string) => {
    setSortConfig(prev => ({ ...prev, fieldId }));
  };

  const toggleSortDirection = () => {
    setSortConfig(prev => ({ ...prev, direction: prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const openFloorDisplay = () => {
    setViewMode('floor');
  };

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Browsers can block fullscreen unless the action is directly user initiated.
    }
  };

  // Handle process card click - open modal, modal handles getting attachment via WebOffice SDK
  const handleProcessCardClick = async (task: Task) => {
    setPreviewTask(task);
  };

  // Use ref to keep latest references without changing function identity
  const syncRef = useRef({ tasks, setTasks, setSyncResponse, setIsSyncing, setToast });
  syncRef.current = { tasks, setTasks, setSyncResponse, setIsSyncing, setToast };

  // Keep latest fieldConfig accessible from the stable sync callback without
  // invalidating it. Without this, the useCallback below would close over the
  // initial fieldConfig and ignore mappings saved later via SettingsModal.
  const fieldConfigRef = useRef(fieldConfig);
  useEffect(() => {
    fieldConfigRef.current = fieldConfig;
  }, [fieldConfig]);

  // Common sync logic from WPS (delegates to wps service)
  // useCallback with empty deps keeps function identity stable forever
  const handleSyncTasksFromWps = useCallback(async (config?: {
    appId: string;
    appKey: string;
    apiUrl: string;
    fileId: string;
    worksheetId?: number;
    rowFrom?: number;
    rowTo?: number;
    colFrom?: number;
    colTo?: number;
    fieldConfig?: CustomFieldConfig[];
  }): Promise<void> => {
    const startTime = Date.now();
    const { tasks, setTasks, setSyncResponse, setIsSyncing, setToast } = syncRef.current;
    const prevTaskCount = tasks.length;
    // Caller (SettingsModal "保存并同步") can pass the just-saved mapping so
    // the first sync after a config change already uses it; otherwise fall
    // back to the latest committed fieldConfig from the ref.
    const effectiveFieldConfig = config?.fieldConfig ?? fieldConfigRef.current;
    console.log(`[WPS Sync] Starting sync... (prev: ${prevTaskCount} tasks)`);
    try {
      setIsSyncing(true);
      const { tasks: wpsTasks, rawData } = await syncTasksFromWps({
        ...config,
        fieldConfig: effectiveFieldConfig,
      });
      const elapsed = Date.now() - startTime;
      setSyncResponse(JSON.stringify(rawData, null, 2));
      if (wpsTasks.length > 0) {
        setTasks(wpsTasks);
        const changed = wpsTasks.length !== prevTaskCount;
        const message = changed
          ? `自动同步完成: ${wpsTasks.length} 条生产单`
          : `自动同步完成: 数据已是最新 (${wpsTasks.length} 条)`;
        setToast({ visible: true, message, type: 'success' });
        console.log(`[WPS Sync] ✓ Completed in ${elapsed}ms - Synced ${wpsTasks.length} tasks from WPS`);
      } else {
        console.warn(`[WPS Sync] Completed in ${elapsed}ms - No tasks found in WPS spreadsheet, keeping current data`);
        setToast({ visible: true, message: '自动同步: 未找到任务数据', type: 'success' });
      }
    } catch (err) {
      const elapsed = Date.now() - startTime;
      console.error(`[WPS Sync] ✗ Failed after ${elapsed}ms:`, err);
      setSyncResponse(JSON.stringify({ error: String(err) }, null, 2));
      setToast({ visible: true, message: `自动同步失败: ${String(err)}`, type: 'error' });
      throw err;
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const handleSyncWPS = async (config: any): Promise<void> => {
    setSyncResponse('');
    await handleSyncTasksFromWps(config);
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

  // Load saved config from localStorage for auto sync
  const getSavedWpsConfig = () => {
    try {
      const saved = localStorage.getItem('wps_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed;
      }
    } catch {}
    return undefined;
  };

  // Auto sync on app start
  useEffect(() => {
    const autoSync = async () => {
      // Only auto-sync if WPS is configured
      if (import.meta.env.VITE_WPS_APP_ID && import.meta.env.VITE_WPS_SPREADSHEET_ID) {
        const savedConfig = getSavedWpsConfig();
        try {
          await handleSyncTasksFromWps(savedConfig);
          console.log('Auto-sync completed on startup');
        } catch (err) {
          console.error('Auto WPS sync failed, using initial/cached data:', err);
        }
      }
    };

    autoSync();
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const syncAndScheduleNext = async () => {
      if (import.meta.env.VITE_WPS_APP_ID && import.meta.env.VITE_WPS_SPREADSHEET_ID) {
        const savedConfig = getSavedWpsConfig();
        try {
          await handleSyncTasksFromWps(savedConfig);
          console.log('Scheduled WPS sync completed');
        } catch (err) {
          console.error('Scheduled WPS sync failed:', err);
        }
      }
      timer = setTimeout(syncAndScheduleNext, getNextDailySyncDelayMs());
    };

    timer = setTimeout(syncAndScheduleNext, getNextDailySyncDelayMs());
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-blue-500/30 flex flex-col">
      <header className="min-h-16 border-b border-blue-900/50 bg-slate-900/80 backdrop-blur-md flex items-center justify-between gap-3 px-4 py-2 sticky top-0 z-50">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(37,99,235,0.5)]">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-lg xl:text-xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent tracking-wide whitespace-nowrap">
            烫金膜生产排产看板
          </h1>
        </div>
        
        <div className="flex items-center justify-end gap-2 flex-wrap min-w-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="搜索任务..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-950 border border-blue-900/50 rounded-lg py-1.5 pl-9 pr-3 text-sm text-slate-200 focus:outline-none focus:border-blue-500 w-36 xl:w-48"
            />
          </div>

          <div className="flex bg-slate-950 rounded-lg p-1 border border-blue-900/50">
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                "flex items-center gap-1.5 px-2 xl:px-3 py-1.5 rounded-md text-xs xl:text-sm font-medium transition-all whitespace-nowrap",
                viewMode === 'table' ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              )}
            >
              <TableProperties className="w-4 h-4" />
              表格
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={cn(
                "flex items-center gap-1.5 px-2 xl:px-3 py-1.5 rounded-md text-xs xl:text-sm font-medium transition-all whitespace-nowrap",
                viewMode === 'calendar' ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              )}
            >
              <LayoutDashboard className="w-4 h-4" />
              日历
            </button>
            <button
              onClick={() => setViewMode('task')}
              className={cn(
                "flex items-center gap-1.5 px-2 xl:px-3 py-1.5 rounded-md text-xs xl:text-sm font-medium transition-all whitespace-nowrap",
                viewMode === 'task' ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              )}
            >
              <KanbanSquare className="w-4 h-4" />
              任务
            </button>
            <button
              onClick={() => setViewMode('processCard')}
              className={cn(
                "flex items-center gap-1.5 px-2 xl:px-3 py-1.5 rounded-md text-xs xl:text-sm font-medium transition-all whitespace-nowrap",
                viewMode === 'processCard' ? "bg-blue-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              )}
            >
              <Factory className="w-4 h-4" />
              流程
            </button>
            <button
              onClick={openFloorDisplay}
              className={cn(
                "flex items-center gap-1.5 px-2 xl:px-3 py-1.5 rounded-md text-xs xl:text-sm font-medium transition-all whitespace-nowrap",
                viewMode === 'floor' ? "bg-emerald-600 text-white shadow-md" : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
              )}
            >
              <MonitorUp className="w-4 h-4" />
              大屏
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 rounded-lg p-1 border border-blue-900/50">
            <ArrowDownAZ className="w-4 h-4 text-slate-500 ml-1" />
            <select
              value={sortConfig.fieldId}
              onChange={(event) => updateSortField(event.target.value)}
              className="bg-transparent py-1 pl-1 pr-2 text-xs xl:text-sm text-slate-200 focus:outline-none max-w-24 xl:max-w-32"
              title={`排序字段: ${currentSortLabel}`}
            >
              {sortFields.map(field => (
                <option key={field.id} value={field.id} className="bg-slate-900 text-slate-200">
                  {field.label}
                </option>
              ))}
            </select>
            <button
              onClick={toggleSortDirection}
              className="p-1.5 rounded-md text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
              title={sortConfig.direction === 'asc' ? '升序' : '降序'}
            >
              {sortConfig.direction === 'asc' ? <ArrowUpAZ className="w-4 h-4" /> : <ArrowDownAZ className="w-4 h-4" />}
            </button>
          </div>
          
          <div className="text-xs xl:text-sm font-mono text-blue-300 bg-blue-950/50 px-2 xl:px-3 py-1.5 rounded-lg border border-blue-900/50 flex items-center gap-2 whitespace-nowrap">
            <Clock className="w-4 h-4" />
            {currentTime}
          </div>

          {isSyncing && (
            <div className="text-sm text-blue-300 bg-blue-950/50 px-3 py-1.5 rounded-lg border border-blue-900/50 flex items-center gap-2 animate-pulse">
              <Loader2 className="w-4 h-4 animate-spin" />
              同步中...
            </div>
          )}

          <AnimatePresence>
            {toast.visible && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className={`text-sm px-3 py-1.5 rounded-lg border flex items-center gap-2 ${
                  toast.type === 'success'
                    ? 'text-green-100 bg-green-900/80 border-green-700/50'
                    : 'text-red-100 bg-red-900/80 border-red-700/50'
                }`}
              >
                {toast.type === 'success' ? (
                  <CheckCircle className="w-4 h-4" />
                ) : (
                  <XCircle className="w-4 h-4" />
                )}
                {toast.message}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-700"
            title="数据源配置"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
          <button
            onClick={toggleFullscreen}
            className={cn(
              "p-2 rounded-lg transition-colors border",
              isFullscreen
                ? "text-emerald-200 bg-emerald-500/15 border-emerald-400/30 hover:bg-emerald-500/25"
                : "text-slate-400 hover:text-white hover:bg-slate-800 border-transparent hover:border-slate-700"
            )}
            title={isFullscreen ? '退出全屏展示' : '进入全屏展示'}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        </div>
      </header>

      <main className={cn("flex-1 flex flex-col overflow-hidden", viewMode === 'floor' ? "p-3 gap-3" : "p-6 gap-6")}>
        {viewMode !== 'floor' && <div className="grid grid-cols-1 md:grid-cols-3 gap-4 shrink-0">
          <MetricCard
            title="所有生产单"
            value={metrics.totalOrders}
            icon={<LayoutDashboard className="w-5 h-5" />}
            onClick={showAllTasks}
            active={!filterToday}
          />
          <MetricCard
            title="当日计划生产数"
            value={metrics.todayCount}
            icon={<Activity className="w-5 h-5" />}
            className="border-blue-500/30"
            onClick={showTodayTasks}
            active={filterToday}
          />
          <MetricCard
            title="当日计划生产量"
            value={`${metrics.todayVolume} m`}
            icon={<CheckCircle2 className="w-5 h-5" />}
            className="border-emerald-500/30"
            onClick={showTodayTasks}
            active={filterToday}
          />
        </div>}

        <div className={cn("flex-1 min-h-0 overflow-auto bg-slate-900/20 border border-blue-900/30 shadow-inner relative", viewMode === 'floor' ? "rounded-lg p-2" : "rounded-xl p-4")}>
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
                {viewMode === 'table' && <TableView key={`table:${filteredViewKey}`} tasks={sortedTasks} sortConfig={sortConfig} onSortChange={setSortConfig} onTaskClick={handleTaskClick} onProcessCardClick={handleProcessCardClick} />}
                {viewMode === 'calendar' && <CalendarView key={`calendar:${filteredViewKey}`} tasks={sortedTasks} onTaskClick={handleTaskClick} onProcessCardClick={handleProcessCardClick} />}
                {viewMode === 'task' && <TaskView key={`task:${filteredViewKey}`} tasks={sortedTasks} onTaskClick={handleTaskClick} onProcessCardClick={handleProcessCardClick} />}
                {viewMode === 'processCard' && <ProcessCardView key={`process:${filteredViewKey}`} tasks={sortedTasks} totalTaskCount={tasks.length} onTaskClick={handleTaskClick} onProcessCardClick={handleProcessCardClick} />}
                {viewMode === 'floor' && <FloorDisplayView key={`floor:${filteredViewKey}`} tasks={sortedTasks} metrics={metrics} currentTime={currentTime} sortLabel={currentSortLabel} sortDirection={sortConfig.direction} onTaskClick={handleTaskClick} onProcessCardClick={handleProcessCardClick} />}
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
              open={showSettings}
              onClose={() => setShowSettings(false)}
              onSync={handleSyncWPS}
              onGetToken={handleGetToken}
              onRefreshToken={handleRefreshToken}
              tokenStatus={tokenStatus}
              isGettingToken={isGettingToken}
              initialCode={autoCode}
              tokenResponse={tokenResponse}
              syncResponse={syncResponse}
              onSaveFieldConfig={(config) => {
                // Update App state so next sync uses the new configuration
                setFieldConfig(config);
              }}
            />
          </Suspense>
        )}
      </AnimatePresence>
    </div>
  );
}
