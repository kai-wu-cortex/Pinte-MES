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

export interface Machine {
  id: string;
  name: string;
  type: string;
}
