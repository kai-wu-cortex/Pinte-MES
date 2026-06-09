import assert from 'node:assert/strict';
import { loadWpsConfig } from './wpsConfig';

const originalLocalStorage = globalThis.localStorage;

type StorageMap = Record<string, string>;

function setLocalStorage(items: StorageMap = {}) {
  const store = { ...items };
  globalThis.localStorage = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach(key => delete store[key]);
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  } as Storage;
}

try {
  setLocalStorage();
  assert.deepEqual(
    loadWpsConfig({
      VITE_WPS_APP_ID: 'env-app-id',
      VITE_WPS_APP_KEY: 'env-app-key',
      VITE_WPS_SPREADSHEET_ID: 'env-file-id',
    }),
    {
      apiUrl: 'https://openapi.wps.cn',
      appId: 'env-app-id',
      appKey: 'env-app-key',
      fileId: 'env-file-id',
      worksheetId: 1,
      rowFrom: 0,
      rowTo: 9999,
      colFrom: 0,
      colTo: 30,
      code: '',
    },
  );

  setLocalStorage({
    wps_config: JSON.stringify({ appId: 'saved-app-id', appKey: 'saved-app-key', fileId: 'saved-file-id' }),
  });
  const savedConfig = loadWpsConfig({
    VITE_WPS_APP_ID: 'env-app-id',
    VITE_WPS_APP_KEY: 'env-app-key',
    VITE_WPS_SPREADSHEET_ID: 'env-file-id',
  });
  assert.equal(savedConfig.appId, 'saved-app-id');
  assert.equal(savedConfig.appKey, 'saved-app-key');
  assert.equal(savedConfig.fileId, 'saved-file-id');
} finally {
  globalThis.localStorage = originalLocalStorage;
}
