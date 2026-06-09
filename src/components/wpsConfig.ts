export type WpsEnv = {
  VITE_WPS_APP_ID?: string;
  VITE_WPS_APP_KEY?: string;
};

export const loadWpsConfig = (env: WpsEnv) => {
  const defaults = {
    apiUrl: 'https://openapi.wps.cn',
    appId: env.VITE_WPS_APP_ID ?? '',
    appKey: env.VITE_WPS_APP_KEY ?? '',
    fileId: '',
    worksheetId: 1,
    rowFrom: 0,
    rowTo: 9999,
    colFrom: 0,
    colTo: 30,
    code: '',
  };

  const saved = localStorage.getItem('wps_config');
  if (saved) {
    try {
      return {
        ...defaults,
        ...JSON.parse(saved),
      };
    } catch {
      return defaults;
    }
  }
  return defaults;
};
