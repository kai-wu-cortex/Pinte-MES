import React, { useRef, useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import type { IWps } from '../../public/wps/index';
import { Task } from '../types';

interface ExcelPreviewModalProps {
  task: Task | null;
  mainFileId: string;
  onClose: () => void;
}

export function ExcelPreviewModal({ task, mainFileId, onClose }: ExcelPreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wpsInstanceRef = useRef<IWps | null>(null);
  const [targetFileId, setTargetFileId] = useState<string | null>(null);

  // Get WebOffice App ID: use saved config if available, otherwise fall back to env var
  const getWebOfficeAppId = (): string => {
    try {
      const saved = localStorage.getItem('wps_config');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.webOfficeAppId && parsed.webOfficeAppId.trim()) {
          return parsed.webOfficeAppId;
        }
      }
    } catch {}
    return import.meta.env.VITE_WEB_OFFICE_APP_ID || import.meta.env.VITE_WPS_APP_ID || '';
  };

  // Open main document first, get attachment from cell, then open attachment
  const openAttachmentFromCell = async (instance: IWps, mainFileId: string, row: number, col: number): Promise<string> => {
    await instance.ready();
    const app = instance.Application;

    // Get the cell via Application API
    // WPS API: app.ActiveSheet.Cells.Item(row + 1, col + 1) (row/col in API is 1-based)
    const activeSheet = await app.ActiveSheet;
    const cell = await activeSheet.Cells.Item(row + 1, col + 1);
    // Get attachments from cell (SDK should have API for this)
    // According to WPS WebOffice docs, we can get attachments from cell
    if (cell && typeof cell.getAttachments === 'function') {
      const attachments = await cell.getAttachments();
      if (attachments && attachments.length > 0) {
        // Return first attachment id
        return attachments[0].id;
      }
    }
    // Fallback: if cell contains fileId as text, use that
    const value = await cell.Value;
    if (value && typeof value === 'string' && value.trim()) {
      return value.trim();
    }
    throw new Error('该单元格未找到电子流程卡附件');
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    setTargetFileId(null);

    if (!containerRef.current || !window.WebOfficeSDK) {
      const errorMsg = 'WPS WebOffice SDK not loaded';
      console.error(errorMsg);
      setError(errorMsg);
      setLoading(false);
      return;
    }

    const appId = getWebOfficeAppId();

    if (!appId) {
      const errorMsg = 'WebOffice App ID not configured. Please set it in Settings → WebOffice 嵌入预览配置';
      console.error(errorMsg);
      setError(errorMsg);
      setLoading(false);
      return;
    }

    if (!task) {
      setError('No task selected');
      setLoading(false);
      return;
    }

    // Clean up any existing instance
    if (wpsInstanceRef.current) {
      wpsInstanceRef.current.destroy().catch(err => {
        console.error('Failed to destroy WPS instance:', err);
        // Fallback to clearing container if destroy fails
        containerRef.current!.innerHTML = '';
      });
      wpsInstanceRef.current = null;
    }

    try {
      // If we have cell position (it's an attachment in main spreadsheet), open main file first to get attachment fileId
      const openMainAndGetAttachment = async () => {
        // If task has cell position - get attachment from main spreadsheet
        if (typeof task.fileWpsRow === 'number' && typeof task.fileWpsCol === 'number') {
          // Open main spreadsheet
          const mainInstance = window.WebOfficeSDK.init({
            appId,
            officeType: window.WebOfficeSDK.OfficeType.Spreadsheet,
            fileId: mainFileId,
            mount: containerRef.current,
            isListenResize: true,
            attrAllow: ['clipboard-read', 'clipboard-write'],
          });

          wpsInstanceRef.current = mainInstance;

          const attachmentFileId = await openAttachmentFromCell(mainInstance, mainFileId, task.fileWpsRow, task.fileWpsCol);
          setTargetFileId(attachmentFileId);

          // Now open the attachment in the same container
          // Destroy main instance first
          await mainInstance.destroy();

          const attachmentInstance = window.WebOfficeSDK.init({
            appId,
            officeType: window.WebOfficeSDK.OfficeType.Spreadsheet,
            fileId: attachmentFileId,
            mount: containerRef.current,
            isListenResize: true,
            attrAllow: ['clipboard-read', 'clipboard-write'],
          });

          wpsInstanceRef.current = attachmentInstance;

          attachmentInstance.on('fileOpen', () => {
            console.log('WPS attachment file opened successfully');
          });

          attachmentInstance.ready().then(() => {
            setLoading(false);
          }).catch((err: Error) => {
            console.error('WPS attachment init failed:', err);
            setError(err.message || 'Failed to initialize WPS Office');
            setLoading(false);
          });
        } else {
          // Direct open given fileId
          let openFileId = task.fileUrl || '';
          if (!openFileId && task.id) {
            openFileId = task.id;
          }
          setTargetFileId(openFileId);

          const instance = window.WebOfficeSDK.init({
            appId,
            officeType: window.WebOfficeSDK.OfficeType.Spreadsheet,
            fileId: openFileId,
            mount: containerRef.current,
            isListenResize: true,
            attrAllow: ['clipboard-read', 'clipboard-write'],
          });

          wpsInstanceRef.current = instance;

          instance.on('fileOpen', () => {
            console.log('WPS file opened successfully');
          });

          instance.ready().then(() => {
            setLoading(false);
          }).catch((err: Error) => {
            console.error('WPS init failed:', err);
            setError(err.message || 'Failed to initialize WPS Office');
            setLoading(false);
          });
        }
      };

      openMainAndGetAttachment();

    } catch (err) {
      console.error('Failed to init WPS:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize WPS Office');
      setLoading(false);
    }

    return () => {
      // Cleanup on unmount
      if (wpsInstanceRef.current) {
        wpsInstanceRef.current.destroy().catch(err => {
          console.error('Failed to destroy WPS instance:', err);
        });
        wpsInstanceRef.current = null;
      }
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [task, mainFileId]);

  const externalUrl = task?.fileUrl && task.fileUrl.startsWith('http')
    ? task.fileUrl
    : (task?.fileUrl ? `https://open.wps.cn/docs/file/${task.fileUrl}` : '');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-xl border border-blue-900/50 shadow-2xl flex flex-col w-[95vw] h-[90vh] max-w-[1200px]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-900/50">
          <h2 className="text-lg font-semibold text-white">电子流程卡</h2>
          <div className="flex items-center gap-2">
            {externalUrl && (
              <button
                onClick={() => window.open(externalUrl, '_blank')}
                className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
                title="Open in new tab"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 relative bg-white">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <div className="text-slate-500">加载中...</div>
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex items-center justify-center bg-red-50 p-6">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-red-800 mb-2">Failed to load document</h3>
                <p className="text-red-600 mb-4">{error}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Retry
                </button>
              </div>
            </div>
          )}
          <div
            ref={containerRef}
            className="w-full h-full"
          />
        </div>
      </div>
    </div>
  );
}
