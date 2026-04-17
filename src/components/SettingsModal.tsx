import React, { useState } from 'react';
import { X, Save, Database, Link as LinkIcon, Key, FileSpreadsheet, Loader2, RefreshCw, KeyRound, ExternalLink } from 'lucide-react';
import { getWpsAuthorizationUrl } from '../services/wps';

interface SettingsModalProps {
  onClose: () => void;
  onSync: (config: any) => Promise<void>;
  onGetToken: (code: string, config: any) => Promise<void>;
  onRefreshToken: () => Promise<void>;
  tokenStatus: 'idle' | 'success' | 'error';
  isGettingToken: boolean;
  initialCode?: string;
  tokenResponse?: string;
}

// Load saved config from localStorage on initialization
const loadSavedConfig = () => {
  const saved = localStorage.getItem('wps_config');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch {
      return {
        apiUrl: 'https://openapi.wps.cn',
        appId: '',
        appKey: '',
        fileId: '',
        code: '',
      };
    }
  }
  return {
    apiUrl: 'https://openapi.wps.cn',
    appId: '',
    appKey: '',
    fileId: '',
    code: '',
  };
};

export function SettingsModal({ onClose, onSync, onGetToken, onRefreshToken, tokenStatus, isGettingToken, initialCode, tokenResponse }: SettingsModalProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [config, setConfig] = useState(() => {
    const saved = loadSavedConfig();
    if (initialCode && initialCode.trim()) {
      return { ...saved, code: initialCode };
    }
    return saved;
  });

  // Save config to localStorage when it changes
  const saveConfig = (newConfig: typeof config) => {
    localStorage.setItem('wps_config', JSON.stringify(newConfig));
    setConfig(newConfig);
  };

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

  const handleGetToken = async () => {
    if (!config.code.trim()) {
      return;
    }
    await onGetToken(config.code, config);
  };

  const handleRefreshToken = async () => {
    await onRefreshToken();
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
              onChange={e => saveConfig({...config, apiUrl: e.target.value})}
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
              onChange={e => saveConfig({...config, appId: e.target.value})}
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
              onChange={e => saveConfig({...config, appKey: e.target.value})}
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
              onChange={e => saveConfig({...config, fileId: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              placeholder="输入排产计划表格的 File ID"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5" /> WPS 授权
              </label>
            </div>
            <a
              href={getWpsAuthorizationUrl(config.appId, config.apiUrl, window.location.origin + '/')}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <ExternalLink className="w-4 h-4 mr-2" />
              开始授权 - 获取 Code
            </a>
            <p className="text-xs text-slate-500 mt-2">
              点击后在 WPS 开放平台完成授权，授权成功后会重定向回来并获取 code，粘贴到下面输入框。
            </p>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1.5">
              <KeyRound className="w-3.5 h-3.5" /> 授权 Code
            </label>
            <input
              type="text"
              value={config.code}
              onChange={e => saveConfig({...config, code: e.target.value})}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
              placeholder="输入 OAuth 授权后获取的 code"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => handleGetToken()}
              disabled={isGettingToken || !config.code}
              className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isGettingToken ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  获取中...
                </>
              ) : (
                <>
                  <Key className="w-4 h-4" />
                  获取 Access Token
                </>
              )}
            </button>
            <button
              onClick={() => handleRefreshToken()}
              disabled={isGettingToken}
              className="flex-1 px-3 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 text-slate-200 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className="w-4 h-4" />
              刷新 Access Token
            </button>
          </div>

          {tokenStatus === 'success' && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Access Token 获取/刷新成功
            </div>
          )}

          {tokenStatus === 'error' && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-rose-500" />
              Access Token 获取/刷新失败，请检查 code
            </div>
          )}

          {tokenResponse && (
            <div className="mt-4">
              <label className="text-xs font-medium text-slate-400 mb-1.5 block">完整响应 JSON</label>
              <pre className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 overflow-x-auto max-h-64 overflow-y-auto">
{tokenResponse}
              </pre>
            </div>
          )}

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
