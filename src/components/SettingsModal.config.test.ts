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
  assert.equal(loadWpsConfig({ VITE_WPS_APP_ID: 'env-app-id', VITE_WPS_APP_KEY: 'env-app-key' }).appId, 'env-app-id');
  assert.equal(loadWpsConfig({ VITE_WPS_APP_ID: 'env-app-id', VITE_WPS_APP_KEY: 'env-app-key' }).appKey, 'env-app-key');

  setLocalStorage({
    wps_config: JSON.stringify({ appId: 'saved-app-id', appKey: 'saved-app-key' }),
  });
  assert.equal(loadWpsConfig({ VITE_WPS_APP_ID: 'env-app-id', VITE_WPS_APP_KEY: 'env-app-key' }).appId, 'saved-app-id');
  assert.equal(loadWpsConfig({ VITE_WPS_APP_ID: 'env-app-id', VITE_WPS_APP_KEY: 'env-app-key' }).appKey, 'saved-app-key');
} finally {
  globalThis.localStorage = originalLocalStorage;
}
