import React, { useState } from 'react';
import { X, Save, Database, Link as LinkIcon, Key, FileSpreadsheet, Loader2 } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
  onSync: (config: any) => Promise<void>;
}

export function SettingsModal({ onClose, onSync }: SettingsModalProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [config, setConfig] = useState({
    apiUrl: 'https://openapi.wps.cn',
    appId: '',
    appKey: '',
    fileId: '',
  });

  const handleSync = async () => {
    setIsSyncing(true);
    setSyncStatus('idle');
    try {
      await onSync(config);
      setSyncStatus('success');
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (e) {
      setSyncStatus('error');
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div 
        className="bg-slate-900 border border-blue-900/50 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200"
      >
        <div className="flex justify-between items-center p-5 border-b border-blue-900/50 bg-slate-800/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-600/20 rounded-lg border border-blue-500/30">
              <Database className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">数据源配置</h2>
              <p className="text-xs text-slate-400 mt-0.5">配置 WPS API 在线表格作为数据源</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1.5">
              <LinkIcon className="w-3.5 h-3.5" /> API 地址
            </label>
            <input 
              type="text" 
              value={config.apiUrl}
              onChange={e => setConfig({...config, apiUrl: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              placeholder="https://openapi.wps.cn"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1.5">
              <Key className="w-3.5 h-3.5" /> App ID
            </label>
            <input 
              type="text" 
              value={config.appId}
              onChange={e => setConfig({...config, appId: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              placeholder="输入 WPS 开放平台 App ID"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1.5">
              <Key className="w-3.5 h-3.5" /> App Key
            </label>
            <input 
              type="password" 
              value={config.appKey}
              onChange={e => setConfig({...config, appKey: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              placeholder="输入 WPS 开放平台 App Key"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1.5">
              <FileSpreadsheet className="w-3.5 h-3.5" /> 在线表格 File ID
            </label>
            <input 
              type="text" 
              value={config.fileId}
              onChange={e => setConfig({...config, fileId: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              placeholder="输入排产计划表格的 File ID"
            />
          </div>

          {syncStatus === 'success' && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              数据同步成功，已加载最新排产计划。
            </div>
          )}

          {syncStatus === 'error' && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-rose-500" />
              同步失败，请检查配置信息或网络连接。
            </div>
          )}
        </div>

        <div className="p-4 border-t border-blue-900/50 bg-slate-800/30 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 rounded-lg text-sm font-medium transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSync}
            disabled={isSyncing}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSyncing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                同步中...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                保存并同步
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
