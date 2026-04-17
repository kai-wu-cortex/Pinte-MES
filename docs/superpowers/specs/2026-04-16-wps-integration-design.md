# WPS 集成设计 - 烫金膜生产排产看板

## 需求概述

在现有的生产排产看板中集成 WPS 开放平台能力：

1. **数据同步**：通过 WPS 365 API 从 WPS 获取最新生产任务数据，更新看板
2. **文档预览**：点击任务后，通过 WPS WebOffice SDK 在网页内嵌入预览对应电子流程卡 Excel 表格

## 架构设计

### 文件结构

```
public/wps/
├── web-office-sdk-solution-v2.0.7.umd.js  # WPS WebOffice SDK UMD 版本
└── index.d.ts                              # TypeScript 类型定义

src/
├── services/
│   └── wps.ts          # WPS 365 API 服务封装
└── components/
    └── ExcelPreviewModal.tsx  # 重写为 WPS WebOffice 嵌入
```

### 环境变量

| 变量名 | 必须 | 说明 |
|--------|------|------|
| `VITE_WPS_APP_ID` | 是 | WPS 开放平台应用 ID |
| `VITE_WPS_APP_KEY` | 是 | WPS 开放平台应用密钥 |
| `VITE_WPS_API_BASE` | 否 | WPS API 基础地址，默认 `https://openapi.wps.cn` |

### 数据流

```
┌─────────────────┐
│   App 启动      │
└────────┬────────┘
         │
         ▼
┌──────────────────────────────┐
│  调用 wps.fetchTasksFromWPS  │
└────────────────┬──────────────┘
                 │
                 ▼
┌──────────────────────────────┐
│  WPS 365 API 返回任务数据    │
└────────────────┬──────────────┘
                 │
                 ▼
┌──────────────────────────────┐
│  转换为 Task[] → 更新状态    │
└──────────────────────────────┘

         用户交互
                 │
                 ▼
┌──────────────────────────────┐
│  用户点击任务 → 打开 Modal   │
└────────────────┬──────────────┘
                 │
                 ▼
┌──────────────────────────────────┐
│  WebOfficeSDK.init()             │
│  appId + fileId + Spreadsheet    │
└────────────────┬─────────────────┘
                 │
                 ▼
┌──────────────────────────────────┐
│  WPS iframe 嵌入容器 → 在线预览  │
└──────────────────────────────────┘
```

## 模块设计

### 1. src/services/wps.ts

封装 WPS 365 API：

```typescript
export interface WpsConfig {
  appId: string;
  appKey: string;
  apiBase: string;
}

export interface WpsTaskData {
  // WPS 表格原始行数据 → 映射到 Task 接口
  [key: string]: any;
}

// 获取访问凭证
async function getAccessToken(config: WpsConfig): Promise<string>

// 从 WPS 表格获取所有任务数据
async function fetchTasksFromWPS(
  accessToken: string,
  spreadsheetId: string,
  range?: string
): Promise<Task[]>

// 转换 WPS 行数据到应用 Task 类型
function convertWpsRowToTask(row: any): Task

export { getAccessToken, fetchTasksFromWPS };
```

### 2. src/components/ExcelPreviewModal.tsx

重写现有组件，使用 WPS WebOffice SDK 嵌入：

- 接收 `url/fileId` 属性
- 使用 `useRef` 获取挂载容器 DOM 节点
- 组件挂载后调用 `window.WebOfficeSDK.init()`
- 清理：组件卸载时销毁 WPS 实例
- 配置：`officeType = Spreadsheet`（表格）

### 3. index.html 修改

在 `</body>` 之前引入 SDK 脚本：

```html
<script src="/wps/web-office-sdk-solution-v2.0.7.umd.js"></script>
```

### 4. App.tsx 修改

- 应用启动 `useEffect` 中自动触发一次 WPS 同步
- 保留设置模态框中的手动同步按钮

## WPS WebOffice SDK 初始化参数

```typescript
const instance = window.WebOfficeSDK.init({
  appId: import.meta.env.VITE_WPS_APP_ID,
  officeType: window.WebOfficeSDK.OfficeType.Spreadsheet,
  fileId: fileIdFromTask,
  mount: containerRef.current,
  isListenResize: true, // 自动响应容器大小变化
});
```

## 类型扩展

由于 SDK 是全局引入，需要在 `src/vite-env.d.ts`（或新建 `src/types/wps.d.ts`）中声明全局类型：

```typescript
interface Window {
  WebOfficeSDK: typeof import('../public/wps/index').default;
}
```

## 自测要点

1. 环境变量正确配置后，应用启动能成功从 WPS 获取任务数据
2. 点击任务能正常打开模态框并加载 WPS 嵌入表格
3. 关闭模态框后正确清理资源
4. 响应式布局，WPS 填满模态框内容区域

## 参考文档

- WPS 开放平台文档：https://open.wps.cn/documents/
- WebOffice SDK 快速开始：https://open.wps.cn/documents/document/102617
