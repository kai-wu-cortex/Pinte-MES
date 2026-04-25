import { addDays, addHours, setHours, startOfToday } from 'date-fns';
import { Machine, Task } from './types';

const today = startOfToday();

export const MACHINES: Machine[] = [
  { id: 'M1', name: '1号涂布机', type: '涂布' },
  { id: 'M2', name: '2号涂布机', type: '涂布' },
  { id: 'M3', name: '1号模压机', type: '模压' },
  { id: 'M4', name: '2号模压机', type: '模压' },
  { id: 'M5', name: '1号分切机', type: '分切' },
];

const PRODUCTS = ['高亮镭射金膜 12μm', '哑光银烫金膜 15μm', '透明全息膜 18μm', '红金拉丝膜 12μm', '普通金膜 12μm', '蓝金膜 15μm', '绿金膜 12μm'];
const OPERATORS = ['张建国', '李明', '王强', '赵伟', '刘洋', '陈东', '杨林'];
const NOTES = ['需特别注意张力控制', '客户要求加急', '首件需质检确认', '常规生产', '注意温度控制', '材料批次变更，注意观料批次变更，注意观料批次变更，注意观料批次变更，注意观料批次变更，注意观料批次变更，注意观料批次变更，注意观料批次变更，注意观料批次变更，注意观料批次变更，注意观料批次变更，注意观料批次变更，注意观察', ''];

export const INITIAL_TASKS: Task[] = Array.from({ length: 100 }).map((_, i) => {
  const machine = MACHINES[i % MACHINES.length];
  const product = PRODUCTS[i % PRODUCTS.length];
  const operator = OPERATORS[i % OPERATORS.length];
  const note = NOTES[i % NOTES.length];

  const dayOffset = (i % 5) - 2;
  const baseDate = addDays(today, dayOffset);

  const machineTaskIndex = Math.floor(i / MACHINES.length);
  const startHour = (machineTaskIndex * 3) % 24;
  const duration = 2 + (i % 3);

  const startTime = setHours(baseDate, startHour);
  const endTime = addHours(startTime, duration);

  const plannedQuantity = 5000 + (i * 100) % 10000;

  return {
    id: `TC-${20240500 + i}`, // 流程卡号
    process: machine.type, // 工艺
    machineId: machine.id,
    machineName: machine.name, // 机台
    productName: product, // 品名颜色
    specification: '12μm x 1000mm', // 规格
    plannedQuantity, // 预计数量/m
    actualOutput: Math.floor(plannedQuantity * 0.6), // 实际产出
    slittingQuantity: Math.floor(plannedQuantity * 0.8), // 分切数量
    shippedQuantity: 0, // 实际出货数量
    startTime: startTime.toISOString(),
    endTime: endTime.toISOString(),
    operator,
    notes: note,
    fileUrl: 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUqptlbsY4OgvB2Q5Ayo/edit?usp=sharing',
  };
});

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
