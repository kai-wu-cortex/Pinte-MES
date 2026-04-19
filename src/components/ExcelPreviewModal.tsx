import React from 'react';
import { X, ExternalLink } from 'lucide-react';
import { Task } from '../types';

interface ExcelPreviewModalProps {
  task: Task | null;
  mainFileId: string;
  onClose: () => void;
}

export function ExcelPreviewModal({ task, mainFileId, onClose }: ExcelPreviewModalProps) {
  if (!task) {
    return null;
  }

  // Build WPS web direct open URL
  // For cell attachment: open via main file with cell reference
  // For direct file: open directly
  const getOpenUrl = (): string => {
    if (task.fileUrl && task.fileUrl.startsWith('http')) {
      return task.fileUrl;
    }
    const fileId = task.fileUrl || task.id;
    return `https://open.wps.cn/docs/file/${fileId}`;
  };

  const openUrl = getOpenUrl();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-xl border border-blue-900/50 shadow-2xl flex flex-col w-[90vw] max-w-[500px] max-h-[80vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-900/50">
          <h2 className="text-lg font-semibold text-white">电子流程卡</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="space-y-2">
            <div className="text-sm text-slate-400">流程卡号</div>
            <div className="text-white font-mono">{task.id}</div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-slate-400">品名颜色</div>
            <div className="text-white">{task.productName}</div>
          </div>

          <div className="space-y-2">
            <div className="text-sm text-slate-400">机台</div>
            <div className="text-white">{task.machineName}</div>
          </div>

          {task.notes && (
            <div className="space-y-2">
              <div className="text-sm text-slate-400">工艺备注</div>
              <div className="text-white text-sm whitespace-pre-wrap">{task.notes}</div>
            </div>
          )}

          <button
            onClick={() => {
              window.open(openUrl, '_blank');
              onClose();
            }}
            className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            在 WPS 中打开电子流程卡
          </button>
        </div>
      </div>
    </div>
  );
}
