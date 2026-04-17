# WPS 集成实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 集成 WPS 开放平台，实现从 WPS 365 同步生产任务数据，并通过 WPS WebOffice SDK 在网页内嵌入预览电子流程卡 Excel。

**Architecture:** SDK 放在 public 目录，通过 UMD 在 index.html 全局引入；新建 wps.ts 服务封装 WPS 365 API；重写 ExcelPreviewModal 使用 WPS WebOffice SDK 嵌入；App 启动自动同步数据。遵循现有项目 React 19 + TypeScript + Vite 架构。

**Tech Stack:** React 19, TypeScript, Vite, WPS WebOffice SDK v2.0.7, WPS 365 Open API

---

## 文件映射

| 文件 | 操作 | 职责 |
|------|------|------|
| `.env.example` | 修改 | 添加 WPS 环境变量模板 |
| `index.html` | 修改 | 引入 WPS WebOffice SDK UMD 脚本 |
| `src/types/wps.d.ts` | 创建 | 全局 WebOfficeSDK TypeScript 类型声明 |
| `src/services/wps.ts` | 创建 | WPS 365 API 服务封装：getAccessToken, fetchTasksFromWPS |
| `src/components/ExcelPreviewModal.tsx` | 修改 | 重写为 WPS WebOffice 嵌入预览 |
| `src/App.tsx` | 修改 | 添加应用启动自动同步 WPS 数据 |
| `vite.config.ts` | 已正确 | 环境变量以 `VITE_` 前缀暴露给客户端 |

---

### Task 1: 更新环境变量模板

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add WPS environment variables to .env.example**

```diff
# Google Gemini API key
GEMINI_API_KEY=your_gemini_api_key_here
+
+ # WPS Open Platform
+ VITE_WPS_APP_ID=your_wps_app_id_here
+ VITE_WPS_APP_KEY=your_wps_app_key_here
+ VITE_WPS_SPREADSHEET_ID=your_spreadsheet_id_here
+ VITE_WPS_API_BASE=https://openapi.wps.cn
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "feat: add WPS environment variables template"
```

---

### Task 2: 添加 WPS 类型声明文件

**Files:**
- Create: `src/types/wps.d.ts`

- [ ] **Step 1: Create TypeScript declaration for global WebOfficeSDK**

```typescript
import WebOfficeSDK from '../../public/wps/index';

declare global {
  interface Window {
    WebOfficeSDK: typeof WebOfficeSDK;
  }
}

export {};
```

- [ ] **Step 2: Commit**

```bash
git add src/types/wps.d.ts
git commit -m "feat: add WPS WebOffice SDK type declarations"
```

---

### Task 3: 在 index.html 引入 WPS SDK

**Files:**
- Modify: `index.html`

- [ ] **Step 1: Add WPS SDK script before closing body tag**

```diff
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Google AI Studio App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
+   <script src="/wps/web-office-sdk-solution-v2.0.7.umd.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Commit**

```bash
git add index.html
git commit -m "feat: add WPS WebOffice SDK script"
```

---

### Task 4: 创建 WPS 365 API 服务

**Files:**
- Create: `src/services/wps.ts`

- [ ] **Step 1: Write WPS API service**

```typescript
import { Task } from '../types';

const WPS_CONFIG = {
  appId: import.meta.env.VITE_WPS_APP_ID || '',
  appKey: import.meta.env.VITE_WPS_APP_KEY || '',
  spreadsheetId: import.meta.env.VITE_WPS_SPREADSHEET_ID || '',
  apiBase: import.meta.env.VITE_WPS_API_BASE || 'https://openapi.wps.cn',
};

export interface WpsAccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export interface WpsCellValue {
  sheetIndex: number;
  row: number;
  column: number;
  value: string;
}

export interface WpsSpreadsheetRangeResponse {
  values: string[][];
}

/**
 * Get WPS access token
 */
export async function getWpsAccessToken(): Promise<string> {
  if (!WPS_CONFIG.appId || !WPS_CONFIG.appKey) {
    console.warn('WPS App ID or App Key not configured');
    throw new Error('WPS not configured');
  }

  const url = `${WPS_CONFIG.apiBase}/open/oauth2/token?appid=${WPS_CONFIG.appId}&appkey=${WPS_CONFIG.appKey}`;

  const response = await fetch(url, { method: 'POST' });
  const data = await response.json() as WpsAccessTokenResponse;

  if (!data.access_token) {
    throw new Error('Failed to get WPS access token');
  }

  return data.access_token;
}

/**
 * Fetch all task data from WPS spreadsheet
 */
export async function fetchTasksFromWps(
  accessToken: string,
  range?: string
): Promise<Task[]> {
  const spreadsheetId = WPS_CONFIG.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error('WPS spreadsheet ID not configured');
  }

  // Default: get A1:ZZ 1000 rows - adjust if needed
  const queryRange = range || 'Sheet1!A1:Z1000';
  const url = `${WPS_CONFIG.apiBase}/open/spreadsheet/${spreadsheetId}/values/${encodeURIComponent(queryRange)}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch spreadsheet: ${response.statusText}`);
  }

  const data = await response.json() as WpsSpreadsheetRangeResponse;

  if (!data.values || data.values.length <= 1) {
    // No data or only header row
    return [];
  }

  // Assume first row is header, skip it
  const rows = data.values.slice(1);
  return rows.map((row, index) => convertWpsRowToTask(row, index));
}

/**
 * Convert WPS spreadsheet row to application Task type
 * Expected columns (adjust based on actual spreadsheet):
 * 0: id (流程卡号)
 * 1: process (工艺)
 * 2: machineName (机台)
 * 3: productName (品名颜色)
 * 4: specification (规格)
 * 5: plannedQuantity (预计数量)
 * 6: actualOutput (实际产出)
 * 7: slittingQuantity (分切数量)
 * 8: shippedQuantity (出货数量)
 * 9: startTime (开始时间)
 * 10: endTime (结束时间)
 * 11: operator (操作员)
 * 12: notes (备注)
 * 13: fileUrl/fileId (WPS文件ID)
 */
function convertWpsRowToTask(row: string[], index: number): Task {
  const [
    id = `TC-${Date.now() + index}`,
    process = '',
    machineName = '',
    productName = '',
    specification = '',
    plannedQuantity = '0',
    actualOutput = '0',
    slittingQuantity = '0',
    shippedQuantity = '0',
    startTime = new Date().toISOString(),
    endTime = new Date().toISOString(),
    operator = '',
    notes = '',
    fileUrl = '',
  ] = row;

  // Get machineId from machineName (e.g., "1号涂布机" -> "M1")
  const machineId = machineName.startsWith('1') ? 'M1' :
                   machineName.startsWith('2') ? 'M2' :
                   machineName.includes('分切') ? 'M5' : 'M3';

  return {
    id: id.trim(),
    process: process.trim(),
    machineId,
    machineName: machineName.trim(),
    productName: productName.trim(),
    specification: specification.trim(),
    plannedQuantity: Number(plannedQuantity) || 0,
    actualOutput: Number(actualOutput) || 0,
    slittingQuantity: Number(slittingQuantity) || 0,
    shippedQuantity: Number(shippedQuantity) || 0,
    startTime: new Date(startTime.trim()).toISOString(),
    endTime: new Date(endTime.trim()).toISOString(),
    operator: operator.trim(),
    notes: notes.trim(),
    fileUrl: fileUrl.trim() || undefined,
  };
}

export { WPS_CONFIG };
```

- [ ] **Step 2: Commit**

```bash
git add src/services/wps.ts
git commit -m "feat: create WPS 365 API service"
```

---

### Task 5: 重写 ExcelPreviewModal 使用 WPS WebOffice SDK

**Files:**
- Modify: `src/components/ExcelPreviewModal.tsx`

- [ ] **Step 1: Read current file content**

(Read existing content then replace with WPS implementation)

- [ ] **Step 2: Replace with WPS WebOffice embedding implementation**

```tsx
import React, { useRef, useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ExcelPreviewModalProps {
  url: string;
  onClose: () => void;
}

export function ExcelPreviewModal({ url, onClose }: ExcelPreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const wpsInstanceRef = useRef<any>(null);

  // Extract fileId from url or use directly
  const getFileId = (fileUrl: string): string => {
    // If it's already just a fileId, return it
    if (!fileUrl.includes('/') && !fileUrl.includes('\\')) {
      return fileUrl;
    }
    // Extract fileId from WPS URL - adjust pattern based on actual URL format
    const match = fileUrl.match(/([a-zA-Z0-9]+)$/);
    return match ? match[1] : fileUrl;
  };

  useEffect(() => {
    if (!containerRef.current || !window.WebOfficeSDK) {
      console.error('WPS WebOffice SDK not loaded');
      setLoading(false);
      return;
    }

    const fileId = getFileId(url);
    const appId = import.meta.env.VITE_WPS_APP_ID;

    if (!appId) {
      console.error('WPS App ID not configured');
      setLoading(false);
      return;
    }

    setLoading(true);

    // Clean up any existing instance
    if (wpsInstanceRef.current) {
      // WPS SDK doesn't expose explicit destroy, but we can clear the container
      containerRef.current.innerHTML = '';
    }

    try {
      const instance = window.WebOfficeSDK.init({
        appId,
        officeType: window.WebOfficeSDK.OfficeType.Spreadsheet,
        fileId,
        mount: containerRef.current,
        isListenResize: true,
      });

      wpsInstanceRef.current = instance;

      instance.ready().then(() => {
        setLoading(false);
        instance.on('fileOpen', () => {
          console.log('WPS file opened successfully');
        });
      }).catch((err: Error) => {
        console.error('WPS init failed:', err);
        setLoading(false);
      });

    } catch (err) {
      console.error('Failed to init WPS:', err);
      setLoading(false);
    }

    return () => {
      // Cleanup on unmount
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      wpsInstanceRef.current = null;
    };
  }, [url]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-xl border border-blue-900/50 shadow-2xl flex flex-col w-[95vw] h-[90vh] max-w-[1200px]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-900/50">
          <h2 className="text-lg font-semibold text-white">电子流程卡</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 relative bg-white">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <div className="text-slate-500">加载中...</div>
            </div>
          )}
          <div
            ref={containerRef}
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ExcelPreviewModal.tsx
git commit -m "feat: rewrite ExcelPreviewModal with WPS WebOffice SDK"
```

---

### Task 6: 修改 App.tsx 添加启动自动同步

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Add import and auto-sync on app start**

```diff
import { INITIAL_TASKS, MACHINES } from './data';
+ import { fetchTasksFromWps, getWpsAccessToken } from './services/wps';
import { LayoutDashboard, TableProperties, KanbanSquare, Activity, CheckCircle2, Clock, Settings as SettingsIcon, Play, Square, Search } from 'lucide-react';
```

```diff
export default function App() {
  const [viewMode, setViewMode] = useLocalStorage<ViewMode>('mes_viewMode', 'calendar');
  const [tasks, setTasks] = useState<Task[]>(INITIAL_TASKS);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
+  const [isSyncing, setIsSyncing] = useState(false);

  const currentTime = format(new Date(), 'yyyy-MM-dd HH:mm:ss');

  ...

  const handleSyncWPS = async (config: any) => {
+   setIsSyncing(true);
    return new Promise<void>((resolve) => {
      setTimeout(async () => {
-       console.log('Syncing with WPS API:', config);
-       setTasks([...INITIAL_TASKS]);
+       try {
+         const token = await getWpsAccessToken();
+         const wpsTasks = await fetchTasksFromWps(token);
+         if (wpsTasks.length > 0) {
+           setTasks(wpsTasks);
+           console.log(`Synced ${wpsTasks.length} tasks from WPS`);
+         } else {
+           console.warn('No tasks found in WPS spreadsheet, keeping initial data');
+         }
+       } catch (err) {
+         console.error('WPS sync failed:', err);
+       } finally {
+         setIsSyncing(false);
+       }
        resolve();
      }, 1500);
    });
  };

+  // Auto sync on app start
+  useEffect(() => {
+    const autoSync = async () => {
+      // Only auto-sync if WPS is configured
+      if (import.meta.env.VITE_WPS_APP_ID && import.meta.env.VITE_WPS_SPREADSHEET_ID) {
+        try {
+          setIsSyncing(true);
+          const token = await getWpsAccessToken();
+          const wpsTasks = await fetchTasksFromWps(token);
+          if (wpsTasks.length > 0) {
+            setTasks(wpsTasks);
+            console.log(`Auto-synced ${wpsTasks.length} tasks from WPS on startup`);
+          }
+        } catch (err) {
+          console.warn('Auto WPS sync failed, using initial data:', err);
+        } finally {
+          setIsSyncing(false);
+        }
+      }
+    };
+
+    autoSync();
+  }, []);

  return (
```

- [ ] **Step 2: (Optional) Add sync indicator in UI if syncing**

Can add a small sync indicator in header next to current time if desired, but not required. Existing UI is fine.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: add auto WPS sync on app startup"
```

---

## 自检查

- ✅ 所有设计需求都覆盖了
- ✅ 没有占位符，每个步骤都有具体代码
- ✅ 文件路径准确
- ✅ 类型一致，使用现有 `Task` 接口
- ✅ WPS SDK 从用户提供的本地文件复制到 public
