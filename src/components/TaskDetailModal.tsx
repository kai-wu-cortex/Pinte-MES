import React from 'react';
import { Task } from '../types';
import { X, Clock, User, Settings, FileText, Activity, Hash, Box } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from './MetricCard';

interface TaskDetailModalProps {
  task: Task;
  onClose: () => void;
}

export function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div 
        className="bg-slate-900 border border-blue-900/50 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-blue-900/50 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
              <FileText className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">任务详情</h2>
              <p className="text-xs text-slate-400 font-mono mt-0.5">{task.id}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-6">
              <div>
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1.5">
                  <Box className="w-3.5 h-3.5" /> 品名颜色
                </label>
                <div className="text-slate-200 font-medium text-lg">{task.productName}</div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1.5">
                  <Hash className="w-3.5 h-3.5" /> 流程卡号
                </label>
                <div className="text-slate-300 font-mono">{task.id}</div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1.5">
                  <Settings className="w-3.5 h-3.5" /> 机台 / 工艺
                </label>
                <div className="text-slate-300">{task.machineName} / {task.process}</div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1.5">
                  <User className="w-3.5 h-3.5" /> 操作员
                </label>
                <div className="text-slate-300">{task.operator}</div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-6">
              <div>
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1.5">
                  <Activity className="w-3.5 h-3.5" /> 生产指标
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-slate-500 text-[10px]">预计/m</div>
                    <div className="text-slate-200 font-bold">{task.plannedQuantity}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px]">实际产出</div>
                    <div className="text-emerald-400 font-bold">{task.actualOutput}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px]">分切数量</div>
                    <div className="text-slate-200 font-bold">{task.slittingQuantity}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 text-[10px]">实际出货</div>
                    <div className="text-blue-400 font-bold">{task.shippedQuantity}</div>
                  </div>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1.5">
                  <Clock className="w-3.5 h-3.5" /> 计划时间
                </label>
                <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-400">日期</span>
                    <span className="text-sm text-slate-200">
                      {(() => {
                        try {
                          return format(new Date(task.startTime), 'yyyy-MM-dd HH:mm');
                        } catch {
                          return task.startTime;
                        }
                      })()}
                    </span>
                  </div>
                  {task.endTime && (
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-slate-400">结束时间</span>
                      <span className="text-sm text-slate-200">
                        {(() => {
                          try {
                            return format(new Date(task.endTime), 'yyyy-MM-dd HH:mm');
                          } catch {
                            return task.endTime;
                          }
                        })()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {task.notes && (
              <div className="col-span-2 mt-2">
                <label className="text-xs font-medium text-slate-500 flex items-center gap-1.5 mb-1.5">
                  <FileText className="w-3.5 h-3.5" /> 工艺备注
                </label>
                <div className="text-amber-400/90 bg-amber-950/20 border border-amber-900/30 p-3 rounded-lg text-sm">
                  {task.notes}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-blue-900/50 bg-slate-800/30 flex justify-end">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
}
