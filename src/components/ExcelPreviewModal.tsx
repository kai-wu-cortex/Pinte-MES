import React, { useRef, useEffect, useState } from 'react';
import { X } from 'lucide-react';

interface ExcelPreviewModalProps {
  url: string;
  onClose: () => void;
}

export function ExcelPreviewModal({ url, onClose }: ExcelPreviewModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const wpsInstanceRef = useRef<any>(null);

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
    if (!containerRef.current || !window.WebOfficeSDK) {
      console.error('WPS WebOffice SDK not loaded');
      setLoading(false);
      return;
    }

    const fileId = getFileId(url);
    const appId = import.meta.env.VITE_WPS_APP_ID;

    if (!appId) {
      console.error('WPS App ID not configured');
      setLoading(false);
      return;
    }

    setLoading(true);

    // Clean up any existing instance
    if (wpsInstanceRef.current) {
      // WPS SDK doesn't expose explicit destroy, but we can clear the container
      containerRef.current.innerHTML = '';
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

      instance.ready().then(() => {
        setLoading(false);
        instance.on('fileOpen', () => {
          console.log('WPS file opened successfully');
        });
      }).catch((err: Error) => {
        console.error('WPS init failed:', err);
        setLoading(false);
      });

    } catch (err) {
      console.error('Failed to init WPS:', err);
      setLoading(false);
    }

    return () => {
      // Cleanup on unmount
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      wpsInstanceRef.current = null;
    };
  }, [url, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-slate-900 rounded-xl border border-blue-900/50 shadow-2xl flex flex-col w-[95vw] h-[90vh] max-w-[1200px]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-blue-900/50">
          <h2 className="text-lg font-semibold text-white">电子流程卡</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-lg transition-colors text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 relative bg-white">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
              <div className="text-slate-500">加载中...</div>
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
