import React, { useRef, useEffect, useState } from 'react';
import { X, ExternalLink } from 'lucide-react';
import type { IWps } from '../../public/wps/index';

interface ExcelPreviewModalProps {
  url: string;
  onClose: () => void;
}

export function ExcelPreviewModal({ url, onClose }: ExcelPreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wpsInstanceRef = useRef<IWps | null>(null);

  // Extract fileId from url or use directly
  const getFileId = (fileUrl: string): string => {
    // If it's already just a fileId, return it
    if (!fileUrl.includes('/') && !fileUrl.includes('\\')) {
      return fileUrl;
    }
    // Extract fileId from WPS URL - adjust pattern based on actual URL format
    const match = fileUrl.match(/([a-zA-Z0-9]+)$/);
    return match ? match[1] : fileUrl;
  };

  useEffect(() => {
    setLoading(true);
    setError(null);

    if (!containerRef.current || !window.WebOfficeSDK) {
      const errorMsg = 'WPS WebOffice SDK not loaded';
      console.error(errorMsg);
      setError(errorMsg);
      setLoading(false);
      return;
    }

    const fileId = getFileId(url);
    const appId = import.meta.env.VITE_WPS_APP_ID;

    if (!appId) {
      const errorMsg = 'WPS App ID not configured';
      console.error(errorMsg);
      setError(errorMsg);
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
      const instance = window.WebOfficeSDK.init({
        appId,
        officeType: window.WebOfficeSDK.OfficeType.Spreadsheet,
        fileId,
        mount: containerRef.current,
        isListenResize: true,
        attrAllow: ['clipboard-read', 'clipboard-write'],
      });

      wpsInstanceRef.current = instance;

      // Register event listeners before calling ready()
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
  }, [url]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-xl border border-blue-900/50 shadow-2xl flex flex-col w-[95vw] h-[90vh] max-w-[1200px]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-900/50">
          <h2 className="text-lg font-semibold text-white">电子流程卡</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open(url, '_blank')}
              className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
              title="Open in new tab"
            >
              <ExternalLink className="w-5 h-5" />
            </button>
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
