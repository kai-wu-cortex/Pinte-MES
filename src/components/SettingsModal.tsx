import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2, ExternalLink, AlertCircle, RefreshCw, Save, Database, Link as LinkIcon, Key, FileSpreadsheet, Loader2, KeyRound } from 'lucide-react';
import { getWpsAuthorizationUrl, extractHeadersFromRawResponse } from '../services/wps';
import { DEFAULT_FIELD_CONFIG } from '../data';
import { CustomFieldConfig } from '../types';

interface SettingsModalProps {
  onClose: () => void;
  onSync: (config: any) => Promise<void>;
  onGetToken: (code: string, config: any) => Promise<void>;
  onRefreshToken: () => Promise<void>;
  tokenStatus: 'idle' | 'success' | 'error';
  isGettingToken: boolean;
  initialCode?: string;
  tokenResponse?: string;
  syncResponse?: string;
  onSaveFieldConfig?: (config: CustomFieldConfig[]) => void;
  show?: boolean;
}

// Load saved config from localStorage on initialization
const loadSavedConfig = () => {
  const saved = localStorage.getItem('wps_config');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Ensure all fields exist with defaults
      return {
        apiUrl: 'https://openapi.wps.cn',
        appId: '',
        appKey: '',
        fileId: '',
        worksheetId: 1,
        rowFrom: 0,
        rowTo: 9999,
        colFrom: 0,
        colTo: 30,
        code: '',
        ...parsed,
      };
    } catch {
      return {
        apiUrl: 'https://openapi.wps.cn',
        appId: '',
        appKey: '',
        fileId: '',
        worksheetId: 1,
        rowFrom: 0,
        rowTo: 9999,
        colFrom: 0,
        colTo: 30,
        code: '',
      };
    }
  }
  return {
    apiUrl: 'https://openapi.wps.cn',
    appId: '',
    appKey: '',
    fileId: '',
    worksheetId: 1,
    rowFrom: 0,
    rowTo: 9999,
    colFrom: 0,
    colTo: 30,
    code: '',
  };
};

export function SettingsModal({ onClose, onSync, onGetToken, onRefreshToken, tokenStatus, isGettingToken, initialCode, tokenResponse, syncResponse, onSaveFieldConfig, show }: SettingsModalProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [config, setConfig] = useState(() => {
    const saved = loadSavedConfig();
    if (initialCode && initialCode.trim()) {
      return { ...saved, code: initialCode };
    }
    return saved;
  });

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
  const [detectedHeaders, setDetectedHeaders] = useState<string[]>([]);

  // Save config to localStorage when it changes
  const saveConfig = (newConfig: typeof config) => {
    localStorage.setItem('wps_config', JSON.stringify(newConfig));
    setConfig(newConfig);
  };

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

        <div className="flex flex-col">
          {/* Tab Content */}
          <div className="p-6 space-y-4 max-h-[calc(100vh-240px)] overflow-y-auto">
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
              <div className="space-y-4">
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
                  <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1.5">
                    <FileSpreadsheet className="w-3.5 h-3.5" /> 数据范围 - 工作表 ID
                  </label>
                  <input
                    type="number"
                    value={config.worksheetId ?? 1}
                    onChange={e => {
                      const val = parseInt(e.target.value);
                      saveConfig({...config, worksheetId: isNaN(val) ? 1 : val});
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                    placeholder="工作表 ID，一般第一个工作表是 1"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1.5">
                      起始行 (row_from)
                    </label>
                    <input
                      type="number"
                      value={config.rowFrom ?? 0}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        saveConfig({...config, rowFrom: isNaN(val) ? 0 : val});
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1.5">
                      结束行 (row_to)
                    </label>
                    <input
                      type="number"
                      value={config.rowTo ?? 9999}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        saveConfig({...config, rowTo: isNaN(val) ? 9999 : val});
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      placeholder="9999"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1.5">
                      起始列 (col_from)
                    </label>
                    <input
                      type="number"
                      value={config.colFrom ?? 0}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        saveConfig({...config, colFrom: isNaN(val) ? 0 : val});
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5 mb-1.5">
                      结束列 (col_to)
                    </label>
                    <input
                      type="number"
                      value={config.colTo ?? 10}
                      onChange={e => {
                        const val = parseInt(e.target.value);
                        saveConfig({...config, colTo: isNaN(val) ? 10 : val});
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                      placeholder="10"
                    />
                  </div>
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

                <div className="mt-4">
                  <button
                    onClick={handleSync}
                    disabled={isSyncing}
                    className="w-full px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSyncing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        同步生产数据...
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-4 h-4" />
                        同步生产数据
                      </>
                    )}
                  </button>
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

                {syncResponse && (
                  <div className="mt-4">
                    <label className="text-xs font-medium text-slate-400 mb-1.5 block">同步完整响应 JSON</label>
                    <pre className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-200 overflow-x-auto max-h-64 overflow-y-auto">
{syncResponse}
                    </pre>
                  </div>
                )}
              </div>
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
                      <p className="font-medium">未检测到表头</p>
                      <p className="text-amber-300/80 mt-1">请先在「基本设置」标签页完成一次同步，然后回来点击「重新读取表头」</p>
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
          </div>
        </div>

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
        )}

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
