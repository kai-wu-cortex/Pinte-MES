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
  fileUrl?: string;
}

export interface Machine {
  id: string;
  name: string;
  type: string;
}
