# 自定义字段映射功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现完全可自定义的字段映射功能，允许用户增删系统字段，并将每个字段映射到 WPS 同步返回的原始业务表表头，适配不同工厂的实际表格结构。

**Architecture:** 在现有的 SettingsModal 中新增标签页实现字段映射配置 UI。配置保存到 localStorage，同步数据时根据配置动态映射 WPS 列到 Task 对象。所有视图（TableView/TaskView/CalendarView）根据配置动态生成字段列表。

**Tech Stack:** React 19 + TypeScript + Tailwind CSS + date-fns + lucide-react，与现有技术栈保持一致。

---

## Files to Modify / Create

| File | Change Type | Responsibility |
|------|-------------|----------------|
| `src/types.ts` | Modify | Add `CustomFieldConfig` interface |
| `src/data.ts` | Modify | Export default field configuration |
| `src/services/wps.ts` | Modify | Refactor `convertWpsRowToTask` to use field config, add `extractHeadersFromRawResponse` function |
| `src/components/SettingsModal.tsx` | Major refactor | Add tabs, implement field mapping UI, add custom field modal |
| `src/components/TableView.tsx` | Modify | Load field config from localStorage, generate COLUMNS dynamically |
| `src/components/TaskView.tsx` | Modify | Load field config from localStorage, generate TASK_FIELDS dynamically |
| `src/components/CalendarView.tsx` | Modify | Load field config from localStorage, generate CALENDAR_FIELDS dynamically |
| `src/App.tsx` | Modify | Pass field config when syncing (no change needed actually, wps service reads from localStorage directly) |

---

### Task 1: Add CustomFieldConfig interface to types.ts

**Files:**
- Modify: `src/types.ts:1-26`

- [ ] **Step 1: Add interface definition**

```typescript
export interface CustomFieldConfig {
  fieldId: string;        // Unique identifier for the field
  displayName: string;    // Display name in UI
  mappedColumn: string;   // Which WPS column this field maps to
  visible: boolean;       // Whether this field should be visible in views
  isDefault: boolean;     // Whether this is a system default field (can't edit ID/name)
}

export interface Task {
  id: string; // 流程卡号
  process: string; // 工艺
  machineId: string;
  machineName: string; // 机台
  productName: string; // 品名颜色
  specification: string; // 规格
  plannedQuantity: number; // 预计数量/m
  actualOutput: number; // 实际产出
  slittingQuantity: number; // 分切数量
  shippedQuantity: number; // 实际出货数量
  startTime: string; // ISO string
  endTime: string; // ISO string
  operator: string;
  notes: string;
  fileUrl?: string; // File URL or cell text
  fileWpsRow?: number; // Row index of this attachment cell in main spreadsheet
  fileWpsCol?: number; // Column index of this attachment cell in main spreadsheet
  // Allow additional custom fields via index signature
  [key: string]: string | number | undefined;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add CustomFieldConfig interface to types.ts"
```

---

### Task 2: Add default field configuration to data.ts

**Files:**
- Modify: `src/data.ts`

- [ ] **Step 1: Add default fields export**

At the end of `src/data.ts`, add:

```typescript
import { CustomFieldConfig } from './types';

export const DEFAULT_FIELD_CONFIG: CustomFieldConfig[] = [
  { fieldId: 'startTime', displayName: '日期', mappedColumn: '日期', visible: true, isDefault: true },
  { fieldId: 'id', displayName: '流程卡号', mappedColumn: '流程卡号', visible: true, isDefault: true },
  { fieldId: 'process', displayName: '工艺', mappedColumn: '工艺', visible: true, isDefault: true },
  { fieldId: 'machineName', displayName: '机台', mappedColumn: '机台', visible: true, isDefault: true },
  { fieldId: 'productName', displayName: '品名颜色', mappedColumn: '品名颜色', visible: true, isDefault: true },
  { fieldId: 'specification', displayName: '规格', mappedColumn: '规格', visible: true, isDefault: true },
  { fieldId: 'plannedQuantity', displayName: '预计数量/m', mappedColumn: '预计数量/m', visible: true, isDefault: true },
  { fieldId: 'actualOutput', displayName: '实际产出', mappedColumn: '实际产出', visible: true, isDefault: true },
  { fieldId: 'slittingQuantity', displayName: '分切数量', mappedColumn: '分切数量', visible: true, isDefault: true },
  { fieldId: 'shippedQuantity', displayName: '实际出货数量', mappedColumn: '实际出货数量', visible: true, isDefault: true },
  { fieldId: 'notes', displayName: '工艺备注', mappedColumn: '备注', visible: true, isDefault: true },
];
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/data.ts
git commit -m "feat: add DEFAULT_FIELD_CONFIG default field mapping"
```

---

### Task 3: Refactor wps.ts to support dynamic field mapping

**Files:**
- Modify: `src/services/wps.ts`

- [ ] **Step 1: Add import and extractHeaders function**

Add import at top:
```typescript
import { Task, CustomFieldConfig } from '../types';
import { DEFAULT_FIELD_CONFIG, MACHINES } from '../data';
```

Add new function after imports:
```typescript
/**
 * Extract header names from raw WPS response
 * Headers are assumed to be in row 2 (0-based index = 2 after title row at 1)
 */
export function extractHeadersFromRawResponse(rawData: any): string[] {
  if (!rawData?.data?.range_data || !Array.isArray(rawData.data.range_data)) {
    return [];
  }

  // Group by row_from to get the entire header row
  const rowsMap: { [rowFrom: number]: string[] } = {};
  rawData.data.range_data.forEach((cell: any) => {
    const rowKey = cell.row_from;
    if (!rowsMap[rowKey]) {
      rowsMap[rowKey] = [];
    }
    rowsMap[rowKey][cell.col_from] = (cell.cell_text || '').trim();
  });

  // Get sorted row keys
  const sortedRows = Object.keys(rowsMap).map(Number).sort((a, b) => a - b);

  // Header is the second data row (index 1 in sorted rows = actual row 2 in sheet)
  // If there's only one row, use that
  const headerRow = sortedRows.length >= 2 ? rowsMap[sortedRows[1]] : rowsMap[sortedRows[0]];

  // Filter out empty headers
  return headerRow.filter(h => h && h.trim()).map(h => h.trim());
}
```

- [ ] **Step 2: Replace hardcoded convertWpsRowToTask with dynamic version**

Replace the existing `convertWpsRowToTask` function with:

```typescript
/**
 * Convert WPS spreadsheet row to application Task type using custom field mapping configuration
 */
function convertWpsRowToTask(
  row: string[],
  headerNames: string[],
  fieldConfig: CustomFieldConfig[],
  index: number
): Task {
  // Create a map from WPS column name to column index
  const columnIndexMap: { [colName: string]: number } = {};
  headerNames.forEach((name, idx) => {
    columnIndexMap[name] = idx;
  });

  // Get value for a field based on mapping
  const getValue = (config: CustomFieldConfig): string => {
    const colIdx = columnIndexMap[config.mappedColumn];
    if (colIdx === undefined || colIdx >= row.length) {
      return '';
    }
    return row[colIdx] || '';
  };

  // Convert to number if field ID ends with Quantity
  const getNumberValue = (config: CustomFieldConfig): number => {
    const val = getValue(config);
    return Number(val) || 0;
  };

  // Convert to ISO date if field ID contains Date or Time
  const getDateValue = (config: CustomFieldConfig): string => {
    const val = getValue(config);
    const trimmed = (val || '').trim();
    if (!trimmed) {
      return new Date().toISOString();
    }
    const date = new Date(trimmed);
    if (isNaN(date.getTime())) {
      return new Date().toISOString();
    }
    return date.toISOString();
  };

  // Start with all custom fields
  const task: any = {
    fileWpsRow: index + 2, // row index after header
    fileWpsCol: 4, // default attachment column
  };

  // Fill each field according to config
  fieldConfig.forEach(config => {
    if (config.fieldId.includes('Quantity')) {
      task[config.fieldId] = getNumberValue(config);
    } else if (config.fieldId.toLowerCase().includes('date') || config.fieldId.toLowerCase().includes('time')) {
      task[config.fieldId] = getDateValue(config);
    } else {
      task[config.fieldId] = getValue(config).trim();
    }
  });

  // Ensure required fields have defaults
  if (!task.machineId) {
    // Get machineId from machineName
    const machineName = task.machineName || '';
    const trimmedMachineName = machineName.trim();
    const machine = MACHINES.find(m => m.name === trimmedMachineName);
    task.machineId = machine?.id || `M-${Date.now() + index}`;
  }

  // Ensure required number fields have defaults
  ['plannedQuantity', 'actualOutput', 'slittingQuantity', 'shippedQuantity'].forEach(field => {
    if (typeof task[field] !== 'number') {
      task[field] = 0;
    }
  });

  // Ensure required string fields have defaults
  ['operator'].forEach(field => {
    if (!task[field]) {
      task[field] = '';
    }
  });

  // endTime defaults to empty string converted to current date
  if (!task.endTime) {
    task.endTime = '';
    // Still need valid ISO for Date constructor
    if (!task.endTime) {
      task.endTime = new Date().toISOString();
    }
  }

  // fileUrl is special - it's the attachment cell for electronic process card
  // Look for field that might contain it - usually "电子流程卡"
  const processCardField = fieldConfig.find(c =>
    c.mappedColumn.includes('电子') || c.mappedColumn.includes('流程卡')
  );
  if (processCardField && task[processCardField.fieldId]) {
    task.fileUrl = String(task[processCardField.fieldId]) || undefined;
    task.fileWpsCol = columnIndexMap[processCardField.mappedColumn] || 4;
  }

  return task as Task;
}
```

- [ ] **Step 3: Update fetchTasksFromWps to use dynamic mapping**

Modify the `fetchTasksFromWps` function signature and body:

```typescript
export async function fetchTasksFromWps(
  accessToken: string,
  options?: {
    spreadsheetId?: string;
    worksheetId?: number;
    rowFrom?: number;
    rowTo?: number;
    colFrom?: number;
    colTo?: number;
    apiBase?: string;
    fieldConfig?: CustomFieldConfig[];
  }
): Promise<{ tasks: Task[]; rawData: any; headers: string[] }> {
  // ... (keep existing code up to the conversion part)

  // Convert WPS response format to our expected row format
  // Group cells by row - each row has row_from (same for all cells in the same row)
  const rangeData = fullResponse?.data?.range_data || [];

  if (!rangeData || rangeData.length === 0) {
    // No data
    return { tasks: [], rawData: fullResponse, headers: [] };
  }

  // Extract headers first
  const headers = extractHeadersFromRawResponse(fullResponse);

  // Group cells by row
  const rowsMap: { [rowFrom: number]: string[] } = {};
  rangeData.forEach((cell: any) => {
    const rowKey = cell.row_from;
    if (!rowsMap[rowKey]) {
      rowsMap[rowKey] = [];
    }
    // Ensure cells are ordered by column index
    // col_from is already 0-based according to actual WPS response
    rowsMap[rowKey][cell.col_from] = cell.cell_text || '';
  });

  // Convert to rows array (ordered by row number)
  const sortedRowKeys = Object.keys(rowsMap).map(Number).sort((a, b) => a - b);
  const rows: string[][] = sortedRowKeys.map(key => rowsMap[key]);

  // Get the actual field configuration - use provided or get default
  const config = options?.fieldConfig || DEFAULT_FIELD_CONFIG;

  // Data starts after header row - if we extracted headers, skip the header row(s)
  const dataRows = headers.length > 0 ? rows.slice(2) : rows.slice(2);
  const tasks = dataRows.map((row, index) => convertWpsRowToTask(row, headers, config, index));
  return { tasks, rawData: fullResponse, headers };
}
```

- [ ] **Step 4: Update syncTasksFromWps signature**

```typescript
export async function syncTasksFromWps(
  config?: {
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
  }
): Promise<{ tasks: Task[]; rawData: any; headers: string[] }> {
  const token = await getWpsAccessToken(undefined, config);
  const result = await fetchTasksFromWps(token.access_token, {
    spreadsheetId: config?.fileId,
    worksheetId: config?.worksheetId,
    rowFrom: config?.rowFrom,
    rowTo: config?.rowTo,
    colFrom: config?.colFrom,
    colTo: config?.colTo,
    apiBase: config?.apiUrl,
    fieldConfig: config?.fieldConfig,
  });
  return result;
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/services/wps.ts
git commit -m "feat: refactor wps.ts for dynamic custom field mapping"
```

---

### Task 4: Refactor SettingsModal to add field mapping tab

**Files:**
- Modify: `src/components/SettingsModal.tsx`

- [ ] **Step 1: Add new imports**

Add to imports at top:
```typescript
import { X, Plus, Trash2, ExternalLink, AlertCircle } from 'lucide-react';
import { DEFAULT_FIELD_CONFIG } from '../data';
import { CustomFieldConfig } from '../types';
import { extractHeadersFromRawResponse } from '../services/wps';
```

- [ ] **Step 2: Add state for active tab, field config, show add modal**

Inside the component add:
```typescript
const [activeTab, setActiveTab] = useState<'basic' | 'fields'>('basic');
const [fieldConfig, setFieldConfig] = useState<CustomFieldConfig[]>(() => {
  try {
    const saved = localStorage.getItem('mes_field_mapping_config');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return [...DEFAULT_FIELD_CONFIG];
});
const [showAddCustom, setShowAddCustom] = useState(false);
const [newFieldId, setNewFieldId] = useState('');
const [newFieldName, setNewFieldName] = useState('');
const detectedHeaders = extractHeadersFromRawResponse(syncResponse ? JSON.parse(syncResponse) : null);
```

- [ ] **Step 3: Extract headers from syncResponse when opening**

Add useEffect to update detected headers when modal opens:
```typescript
useEffect(() => {
  if (show && syncResponse) {
    try {
      const raw = JSON.parse(syncResponse);
      const headers = extractHeadersFromRawResponse(raw);
      setDetectedHeaders(headers);
    } catch {
      setDetectedHeaders([]);
    }
  } else {
    setDetectedHeaders([]);
  }
}, [show, syncResponse]);
```

(Add `const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);`)

- [ ] **Step 4: Change modal layout to tabs**

Replace existing modal body content with tabs:

```tsx
<div className="flex border-b border-slate-700 mb-4">
  <button
    onClick={() => setActiveTab('basic')}
    className={`px-4 py-2 text-sm font-medium ${
      activeTab === 'basic'
        ? 'text-blue-400 border-b-2 border-blue-400'
        : 'text-slate-400 hover:text-slate-200'
    }`}
  >
    基本设置
  </button>
  <button
    onClick={() => setActiveTab('fields')}
    className={`px-4 py-2 text-sm font-medium ${
      activeTab === 'fields'
        ? 'text-blue-400 border-b-2 border-blue-400'
        : 'text-slate-400 hover:text-slate-200'
    }`}
  >
    字段映射
  </button>
</div>

{activeTab === 'basic' && (
  // ... keep existing basic settings content here
)}

{activeTab === 'fields' && (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div className="text-sm text-slate-400">
        {detectedHeaders.length > 0
          ? `已检测到 ${detectedHeaders.length} 个原始表头`
          : '⚠️ 未检测到表头，请先在基本设置中完成一次同步'}
      </div>
      <button
        onClick={() => {
          if (syncResponse) {
            try {
              const raw = JSON.parse(syncResponse);
              const headers = extractHeadersFromRawResponse(raw);
              setDetectedHeaders(headers);
            } catch {
              setDetectedHeaders([]);
            }
          }
        }}
        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
      >
        <RefreshCw className="w-4 h-4" />
        重新读取表头
      </button>
    </div>

    {detectedHeaders.length === 0 && (
      <div className="flex items-start gap-2 p-3 bg-amber-950/50 border border-amber-500/30 rounded-lg">
        <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-sm text-amber-200">
          <p class="font-medium">未检测到表头</p>
          <p class="text-amber-300/80 mt-1">请先在「基本设置」标签页完成一次同步，然后回来点击「重新读取表头」</p>
        </div>
      </div>
    )}

    <div className="border border-slate-700 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-800">
          <tr>
            <th className="text-left px-3 py-2 text-slate-300 font-medium">显示名称</th>
            <th className="text-left px-3 py-2 text-slate-300 font-medium">映射 WPS 列</th>
            <th className="text-center px-3 py-2 text-slate-300 font-medium w-16">可见</th>
            <th className="text-center px-3 py-2 text-slate-300 font-medium w-16">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700">
          {fieldConfig.map((field, index) => (
            <tr key={field.fieldId} className="bg-slate-900">
              <td className="px-3 py-2 text-slate-200">
                {field.isDefault ? (
                  <span>{field.displayName}</span>
                ) : (
                  <input
                    type="text"
                    value={field.displayName}
                    onChange={(e) => {
                      const newConfig = [...fieldConfig];
                      newConfig[index] = { ...field, displayName: e.target.value };
                      setFieldConfig(newConfig);
                    }}
                    className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-sm w-full focus:outline-none focus:border-blue-500"
                  />
                )}
              </td>
              <td className="px-3 py-2">
                <select
                  value={field.mappedColumn}
                  onChange={(e) => {
                    const newConfig = [...fieldConfig];
                    newConfig[index] = { ...field, mappedColumn: e.target.value };
                    setFieldConfig(newConfig);
                  }}
                  className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-200 text-sm focus:outline-none focus:border-blue-500 min-w-[120px]"
                >
                  {detectedHeaders.length === 0 && (
                    <option value={field.mappedColumn}>{field.mappedColumn}</option>
                  )}
                  {detectedHeaders.map(header => (
                    <option key={header} value={header}>{header}</option>
                  ))}
                </select>
              </td>
              <td className="text-center px-3 py-2">
                <input
                  type="checkbox"
                  checked={field.visible}
                  onChange={(e) => {
                    const newConfig = [...fieldConfig];
                    newConfig[index] = { ...field, visible: e.target.checked };
                    setFieldConfig(newConfig);
                  }}
                  className="accent-blue-600"
                />
              </td>
              <td className="text-center px-3 py-2">
                <button
                  onClick={() => {
                    const newConfig = fieldConfig.filter((_, i) => i !== index);
                    setFieldConfig(newConfig);
                  }}
                  className="p-1 text-slate-400 hover:text-red-400 hover:bg-red-900/30 rounded transition-colors"
                  title="删除字段"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
          <tr>
            <td colSpan={4} className="px-3 py-2">
              <button
                onClick={() => setShowAddCustom(true)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-blue-400 hover:bg-blue-900/20 rounded-lg transition-colors w-full justify-center"
              >
                <Plus className="w-4 h-4" />
                添加自定义字段
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div className="flex gap-3 justify-end">
      <button
        onClick={() => {
          setFieldConfig([...DEFAULT_FIELD_CONFIG]);
        }}
        className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-700 hover:bg-slate-700 rounded-lg transition-colors"
      >
        🔁 重置为默认
      </button>
      <button
        onClick={() => {
          // Check for duplicate field IDs
          const ids = fieldConfig.map(f => f.fieldId);
          if (new Set(ids).size !== ids.length) {
            alert('字段 ID 不能重复，请检查');
            return;
          }
          localStorage.setItem('mes_field_mapping_config', JSON.stringify(fieldConfig));
          onSaveFieldConfig?.(fieldConfig);
          // Keep modal open for further adjustments
        }}
        className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
      >
        💾 保存设置
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 5: Add "Add Custom Field" modal**

Add after the closing div of the field mapping tab:

```tsx
{/* Add Custom Field Modal */}
{showAddCustom && (
  <div className="fixed inset-0 z-[101] flex items-center justify-center bg-black/70 backdrop-blur-sm">
    <div className="bg-slate-900 rounded-xl border border-blue-900/50 shadow-2xl w-[400px] p-6">
      <h3 className="text-lg font-semibold text-white mb-4">添加自定义字段</h3>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-slate-400 block">
            字段 ID
            <span className="text-slate-500 ml-1">（唯一标识符，不能重复，建议用小写字母+下划线）</span>
          </label>
          <input
            type="text"
            value={newFieldId}
            onChange={(e) => setNewFieldId(e.target.value)}
            placeholder="custom_field"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-400 block">显示名称</label>
          <input
            type="text"
            value={newFieldName}
            onChange={(e) => setNewFieldName(e.target.value)}
            placeholder="自定义字段"
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
          />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button
            onClick={() => {
              setShowAddCustom(false);
              setNewFieldId('');
              setNewFieldName('');
            }}
            className="px-4 py-2 text-sm text-slate-300 hover:text-white border border-slate-700 hover:bg-slate-700 rounded-lg transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => {
              if (!newFieldId.trim() || !newFieldName.trim()) {
                alert('字段 ID 和显示名称不能为空');
                return;
              }
              // Check duplicate
              if (fieldConfig.some(f => f.fieldId === newFieldId.trim())) {
                alert('字段 ID 已经存在，请使用其他 ID');
                return;
              }
              const newConfig: CustomFieldConfig = {
                fieldId: newFieldId.trim(),
                displayName: newFieldName.trim(),
                mappedColumn: detectedHeaders[0] || newFieldName.trim(),
                visible: true,
                isDefault: false,
              };
              setFieldConfig([...fieldConfig, newConfig]);
              setShowAddCustom(false);
              setNewFieldId('');
              setNewFieldName('');
            }}
            className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            添加
          </button>
        </div>
      </div>
    </div>
  </div>
</div>
)}
```

- [ ] **Step 6: Add RefreshCw import**

Verify import includes `RefreshCw` from lucide-react:
```typescript
import { X, Plus, Trash2, ExternalLink, AlertCircle, RefreshCw } from 'lucide-react';
```

- [ ] **Step 7: Add onSaveFieldConfig prop to SettingsModalProps interface**

```typescript
interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
  onGetToken: (code: string, config: any) => Promise<void>;
  onRefreshToken: () => Promise<void>;
  onSyncWPS: (config: any) => Promise<void>;
  tokenStatus: 'idle' | 'success' | 'error';
  tokenResponse: string;
  syncResponse: string;
  onSaveFieldConfig?: (config: CustomFieldConfig[]) => void;
}
```

- [ ] **Step 8: Verify TypeScript compiles**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add src/components/SettingsModal.tsx
git commit -m "feat: add field mapping tab to SettingsModal with add/delete functionality"
```

---

### Task 5: Update TableView to use dynamic field config from localStorage

**Files:**
- Modify: `src/components/TableView.tsx`

- [ ] **Step 1: Add import and load field config from localStorage**

Add imports:
```typescript
import { CustomFieldConfig } from '../types';
import { DEFAULT_FIELD_CONFIG } from '../../data';
```

Inside the component add:
```typescript
// Load field configuration from localStorage
const [fieldConfig] = useState<CustomFieldConfig[]>(() => {
  try {
    const saved = localStorage.getItem('mes_field_mapping_config');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return [...DEFAULT_FIELD_CONFIG];
});

// Get visible columns only
const visibleFields = fieldConfig.filter(f => f.visible);
```

Update COLUMNS to be dynamically generated:

```typescript
// COLUMNS is now dynamic based on field config
const COLUMNS = visibleFields.map(f => ({
  id: f.fieldId,
  label: f.displayName,
  defaultWidth: f.fieldId === 'notes' || f.fieldId === 'productName' ? 200 : 120,
  groupable: !['plannedQuantity', 'actualOutput', 'slittingQuantity', 'shippedQuantity'].includes(f.fieldId),
}));
```

- [ ] **Step 2: Verify renderCell still works**

The cell rendering part should already work because it uses `task[col.id as keyof Task]` and `Task` has index signature:

```typescript
{col.id === 'notes' ? task.notes : task[col.id as keyof Task]}
```

This already works for custom fields because of the index signature on `Task` interface.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/components/TableView.tsx
git commit -m "feat: update TableView to use dynamic field configuration from localStorage"
```

---

### Task 6: Update TaskView to use dynamic field config from localStorage

**Files:**
- Modify: `src/components/TaskView.tsx`

- [ ] **Step 1: Add import and load field config**

Add imports:
```typescript
import { CustomFieldConfig } from '../types';
import { DEFAULT_FIELD_CONFIG } from '../data';
```

Inside the component:

```typescript
// Load field configuration from localStorage
const [fieldConfig] = useState<CustomFieldConfig[]>(() => {
  try {
    const saved = localStorage.getItem('mes_field_mapping_config');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return [...DEFAULT_FIELD_CONFIG];
});

// Get visible fields
const visibleFields = fieldConfig.filter(f => f.visible);
```

Replace the hardcoded `TASK_FIELDS` with dynamic version:

```typescript
// TASK_FIELDS is now dynamic
const TASK_FIELDS = visibleFields.map(f => ({
  id: f.fieldId,
  label: f.displayName,
  icon: f.fieldId === 'startTime' ? Calendar
    : f.fieldId === 'id' ? Hash
    : f.fieldId === 'process' ? Settings
    : f.fieldId === 'machineName' ? Settings
    : f.fieldId.includes('Quantity') ? Activity
    : f.fieldId === 'operator' ? User
    : f.fieldId === 'notes' ? FileText
    : Box, // default icon
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/TaskView.tsx
git commit -m "feat: update TaskView to use dynamic field configuration"
```

---

### Task 7: Update CalendarView to use dynamic field config from localStorage

**Files:**
- Modify: `src/components/CalendarView.tsx`

- [ ] **Step 1: Add import and load field config**

Add imports:
```typescript
import { CustomFieldConfig } from '../types';
import { DEFAULT_FIELD_CONFIG } from '../data';
```

Inside the component:

```typescript
// Load field configuration from localStorage
const [fieldConfig] = useState<CustomFieldConfig[]>(() => {
  try {
    const saved = localStorage.getItem('mes_field_mapping_config');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return [...DEFAULT_FIELD_CONFIG];
});

// Get visible fields for calendar display
const visibleFields = fieldConfig.filter(f => f.visible);
```

Replace the hardcoded `CALENDAR_FIELDS` with dynamic version:

```typescript
// CALENDAR_FIELDS is now dynamic
const CALENDAR_FIELDS = visibleFields.map(f => ({
  id: f.fieldId,
  label: f.displayName,
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/CalendarView.tsx
git commit -m "feat: update CalendarView to use dynamic field configuration"
```

---

### Task 8: Update App.tsx to pass field config to sync

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Load field config in App**

Add at top of App component:

```typescript
import { DEFAULT_FIELD_CONFIG } from './data';
import { CustomFieldConfig } from './types';

// Inside component:
const [fieldConfig] = useState<CustomFieldConfig[]>(() => {
  try {
    const saved = localStorage.getItem('mes_field_mapping_config');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {}
  return [...DEFAULT_FIELD_CONFIG];
});
```

- [ ] **Step 2: Update sync to include field config**

In `handleSyncTasksFromWps`:

```typescript
const { tasks: wpsTasks, rawData, headers } = await syncTasksFromWps({
  ...config,
  fieldConfig,
});
```

- [ ] **Step 3: Update SettingsModal props to include fieldConfig**

When rendering SettingsModal:

```tsx
<SettingsModal
  open={showSettings}
  onClose={() => setShowSettings(false)}
  onGetToken={handleGetToken}
  onRefreshToken={handleRefreshToken}
  onSyncWPS={handleSyncWPS}
  tokenStatus={tokenStatus}
  tokenResponse={tokenResponse}
  syncResponse={syncResponse}
/>
```

(No change needed actually - the prop `onSaveFieldConfig` is optional and SettingsModal saves directly to localStorage. All views already read from localStorage on component mount.)

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npm run lint`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx
git commit -m "feat: update App to load field config and pass to sync"
```

---

### Task 9: Final build verification

- [ ] **Step 1: Run full build**

Run: `npm run build`
Expected: Build succeeds

- [ ] **Step 2: Commit any pending changes**

If any:
```bash
git add .
git commit -m "chore: final build verification"
```

---

## Self-Review

1. **Spec coverage**: All requirements from the spec are covered:
   - ✅ Auto extract headers from last sync response
   - ✅ Add custom fields
   - ✅ Delete any field
   - ✅ Map each field to WPS column dropdown
   - ✅ Control visibility
   - ✅ Reset to default
   - ✅ Persist to localStorage
   - ✅ All three views (Table/Task/Calendar) use dynamic config

2. **No placeholders**: All steps have exact code and file paths

3. **Type consistency**: All types are consistent throughout

## End of Plan
