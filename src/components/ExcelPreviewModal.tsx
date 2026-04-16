import React from 'react';
import { X, ExternalLink } from 'lucide-react';

interface ExcelPreviewModalProps {
  url: string;
  onClose: () => void;
}

export function ExcelPreviewModal({ url, onClose }: ExcelPreviewModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-blue-900/50 rounded-xl w-full max-w-5xl h-[80vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-blue-900/50">
          <h3 className="text-lg font-medium text-white">流程卡详情预览</h3>
          <div className="flex items-center gap-2">
            <a href={url} target="_blank" rel="noopener noreferrer" className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
              <ExternalLink className="w-5 h-5" />
            </a>
            <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="flex-1 p-2">
          <iframe 
            src={url} 
            className="w-full h-full rounded-lg border-0 bg-white"
            title="Excel Preview"
          />
        </div>
      </div>
    </div>
  );
}
