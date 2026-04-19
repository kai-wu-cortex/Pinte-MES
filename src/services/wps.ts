import { Task } from '../types';
import { MACHINES } from '../data';

const WPS_CONFIG = {
  appId: import.meta.env.VITE_WPS_APP_ID || '',
  appKey: import.meta.env.VITE_WPS_APP_KEY || '',
  spreadsheetId: import.meta.env.VITE_WPS_SPREADSHEET_ID || '',
  apiBase: import.meta.env.VITE_WPS_API_BASE || 'https://openapi.wps.cn',
  defaultRange: import.meta.env.VITE_WPS_DEFAULT_RANGE || 'Sheet1!A1:Z1000',
  redirectUri: import.meta.env.VITE_WPS_REDIRECT_URI || (window.location.origin + '/'),
};

export interface WpsAccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token: string;
  refresh_expires_in: string;
}

// Cached access token with expiration - loaded from localStorage on initialization
const CACHE_KEY = 'wps_cached_token';
export let cachedToken: {
  access_token: string;
  refresh_token: string;
  expiresAt: number;
} | null = (() => {
  // Load from localStorage on module load
  try {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(CACHE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Check if refresh token is still valid
        if (parsed.expiresAt && parsed.refresh_token) {
          // Even if access token expired, we can still use refresh token
          return parsed;
        }
      }
    }
  } catch {}
  return null;
})();

function saveCachedToken(token: {
  access_token: string;
  refresh_token: string;
  expiresAt: number;
}): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(token));
    } catch {}
  }
}

function clearCachedToken(): void {
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(CACHE_KEY);
    } catch {}
  }
}

export interface WpsCellValue {
  sheetIndex: number;
  row: number;
  column: number;
  value: string;
}

export interface WpsSpreadsheetRangeResponse {
  values: string[][];
}

export interface WpsClientConfig {
  appId: string;
  appKey: string;
  apiUrl: string;
  redirectUri: string;
}

export interface WpsTokenResponse extends WpsAccessTokenResponse {
}

/**
 * Get WPS access token (with caching and refresh support)
 *
 * OAuth flow requires an authorization code from initial redirect.
 * If we have a cached token that's still valid, reuse it.
 * If expired, use refresh token to get a new one.
 */
export async function getWpsAccessToken(
  code?: string,
  config?: Partial<WpsClientConfig>
): Promise<WpsTokenResponse> {
  const clientId = config?.appId || WPS_CONFIG.appId;
  const clientSecret = config?.appKey || WPS_CONFIG.appKey;
  const apiBase = config?.apiUrl || WPS_CONFIG.apiBase;
  const redirectUri = config?.redirectUri || WPS_CONFIG.redirectUri;

  // If we already have a cached refresh token, we don't need to check for clientId/clientSecret
  // because they were already validated when we got the initial token
  if (!cachedToken?.refresh_token && (!clientId || !clientSecret)) {
    console.warn('WPS App ID or App Key not configured');
    throw new Error('WPS not configured');
  }

  // Return cached token if it's still valid (5 min buffer before expiration)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300000) {
    return {
      access_token: cachedToken.access_token,
      refresh_token: cachedToken.refresh_token,
      expires_in: Math.floor((cachedToken.expiresAt - Date.now()) / 1000),
      refresh_expires_in: '0',
      token_type: 'bearer',
    };
  }

  const url = `${apiBase}/oauth2/token`;
  const body = new URLSearchParams();

  if (cachedToken?.refresh_token) {
    // Use refresh token to get new access token
    body.append('grant_type', 'refresh_token');
    body.append('refresh_token', cachedToken.refresh_token);
    body.append('client_id', clientId);
    body.append('client_secret', clientSecret);
  } else if (code) {
    // Initial authorization with code
    body.append('grant_type', 'authorization_code');
    body.append('client_id', clientId);
    body.append('client_secret', clientSecret);
    body.append('code', code);
    body.append('redirect_uri', redirectUri);
  } else {
    throw new Error('No authorization code available and no cached refresh token. You need to complete OAuth authorization first.');
  }

  // Use Vercel proxy to avoid CORS issues since WPS API doesn't allow browser cross-origin requests
  const isBrowser = typeof window !== 'undefined';
  let response;

  if (isBrowser) {
    // Browser: use our Vercel proxy
    const proxyUrl = '/api/wps-proxy';
    response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint: '/oauth2/token',
        method: 'POST',
        body: Object.fromEntries(body),
      }),
    });
  } else {
    // Node/SSR: direct request
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body,
    });
  }

  if (!response.ok) {
    const error = await response.json() as { code: number; msg: string };
    // If refresh token is invalid (invalid_grant), clear the cached token
    // User needs to re-authorize
    if (cachedToken?.refresh_token && error.msg?.includes('invalid_grant')) {
      clearCachedToken();
      cachedToken = null;
    }
    throw new Error(`Failed to get WPS access token: ${error.msg || response.statusText}`);
  }

  const data = await response.json() as WpsAccessTokenResponse;

  if (!data.access_token) {
    throw new Error('Failed to get WPS access token: No access token in response');
  }

  // Cache the token
  cachedToken = {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };
  saveCachedToken(cachedToken);

  return data;
}

/**
 * Fetch all task data from WPS spreadsheet using v7 API
 * GET /v7/sheets/{file_id}/worksheets/{worksheet_id}/range_data
 */
export async function fetchTasksFromWps(
  accessToken: string,
  options?: {
    spreadsheetId?: string;
    worksheetId?: number;
    rowFrom?: number;
    rowTo?: number;
    colFrom?: number;
    colTo?: number;
    apiBase?: string;
  }
): Promise<{ tasks: Task[]; rawData: WpsSpreadsheetRangeResponse }> {
  const spreadsheetId = options?.spreadsheetId || WPS_CONFIG.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error('WPS spreadsheet ID not configured');
  }

  const worksheetId = options?.worksheetId ?? 1;
  const rowFrom = options?.rowFrom ?? 0;
  const rowTo = options?.rowTo ?? 9999;
  const colFrom = options?.colFrom ?? 0;
  const colTo = options?.colTo ?? 10;
  const apiBase = options?.apiBase || WPS_CONFIG.apiBase;

  // API path requires: /v7/sheets/{file_id}/worksheets/{worksheet_id}/range_data
  // Note: worksheet_id in URL path is snake_case (not camelCase worksheetId), sheets is plural per docs
  const endpoint = `/v7/sheets/${encodeURIComponent(spreadsheetId)}/worksheets/${worksheetId}/range_data?row_from=${rowFrom}&row_to=${rowTo}&col_from=${colFrom}&col_to=${colTo}`;

  const isBrowser = typeof window !== 'undefined';
  let response;

  if (isBrowser) {
    // Browser: use our Vercel proxy with GET converted to POST through proxy
    const proxyUrl = '/api/wps-proxy';
    response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
    });
  } else {
    // Node/SSR: direct request
    const url = `${apiBase}${endpoint}`;
    response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch spreadsheet: ${response.statusText}`);
  }

  // Response format according to WPS docs:
  // {
  //   "code": 0,
  //   "msg": "string",
  //   "data": {
  //     "range_data": [
  //       { row_from, row_to, col_from, col_to, cell_text }
  //     ]
  //   }
  // }
  const fullResponse = await response.json();

  // Convert WPS response format to our expected row format
  // Group cells by row - each row has row_from (same for all cells in the same row)
  const rangeData = fullResponse?.data?.range_data || [];

  if (!rangeData || rangeData.length === 0) {
    // No data
    return { tasks: [], rawData: fullResponse };
  }

  // Group cells by row
  const rowsMap: { [rowFrom: number]: string[] } = {};
  rangeData.forEach((cell: any) => {
    const rowKey = cell.row_from;
    if (!rowsMap[rowKey]) {
      rowsMap[rowKey] = [];
    }
    // Ensure cells are ordered by column index
    // col_from is already 0-based according to actual WPS response
    rowsMap[rowKey][cell.col_from] = cell.cell_text || '';
  });

  // Convert to rows array (ordered by row number)
  const sortedRowKeys = Object.keys(rowsMap).map(Number).sort((a, b) => a - b);
  const rows: string[][] = sortedRowKeys.map(key => rowsMap[key]);

  if (rows.length <= 2) {
    // No data or only title + header rows
    return { tasks: [], rawData: fullResponse };
  }

  // First row = title (merged cell), second row = header, skip both, data starts from third row
  const dataRows = rows.slice(2);
  const tasks = dataRows.map((row, index) => convertWpsRowToTask(row, index));
  return { tasks, rawData: fullResponse };
}

/**
 * Convert WPS spreadsheet row to application Task type
 * Expected columns (adjust based on actual spreadsheet):
 * 0: date (日期) - used for startTime
 * 1: process (工艺)
 * 2: machineName (机台)
 * 3: id (流程卡号)
 * 4: fileUrl (电子流程卡 - WPS文件ID)
 * 5: productName (品名颜色)
 * 6: specification (规格)
 * 7: plannedQuantity (预计数量/m)
 * 8: actualOutput (实际产出)
 * 9: slittingQuantity (分切数量)
 * 10: shippedQuantity (实际出货数量)
 * 11: notes (备注)
 *
 * Missing columns get default values:
 * endTime: empty (defaults to current date if needed)
 * operator: empty string
 */
function convertWpsRowToTask(row: string[], index: number): Task {
  const [
    date = '',
    process = '',
    machineName = '',
    id = '',
    fileUrl = '',
    productName = '',
    specification = '',
    plannedQuantity = '0',
    actualOutput = '0',
    slittingQuantity = '0',
    shippedQuantity = '0',
    notes = '',
  ] = row;

  // Get machineId from machineName by looking up in MACHINES list
  const trimmedMachineName = machineName.trim();
  const machine = MACHINES.find(m => m.name === trimmedMachineName);
  const machineId = machine?.id || `M-${Date.now() + index}`;
  const resolvedMachineName = machine?.name || trimmedMachineName;

  // Defaults for missing columns
  const endTime = '';
  const operator = '';

  // Safe date parsing - always return a valid ISO string that can be passed to new Date()
  // If parsing fails, fallback to current date
  const parseDate = (dateStr: string): string => {
    const trimmed = (dateStr || '').trim();
    if (!trimmed) {
      return '';
    }
    const date = new Date(trimmed);
    if (isNaN(date.getTime())) {
      // If date string cannot be parsed, return current date
      // The original string will be displayed in the table if needed
      return new Date().toISOString();
    }
    return date.toISOString();
  };

  // The actual row index in WPS spreadsheet: original data starts at row 2 (0-based) after header
  const wpsRowIndex = index + 2;
  // fileUrl is in column 4 (0-based)
  const wpsColIndex = 4;

  return {
    id: (id || '').trim(),
    process: (process || '').trim(),
    machineId,
    machineName: resolvedMachineName,
    productName: (productName || '').trim(),
    specification: (specification || '').trim(),
    plannedQuantity: Number(plannedQuantity) || 0,
    actualOutput: Number(actualOutput) || 0,
    slittingQuantity: Number(slittingQuantity) || 0,
    shippedQuantity: Number(shippedQuantity) || 0,
    startTime: parseDate(date),
    endTime: parseDate(endTime),
    operator: (operator || '').trim(),
    notes: (notes || '').trim(),
    fileUrl: (fileUrl || '').trim() || undefined,
    fileWpsRow: wpsRowIndex,
    fileWpsCol: wpsColIndex,
  };
}

/**
 * Get the WPS OAuth authorization URL
 * Users visit this URL to grant access to the application
 */
export function getWpsAuthorizationUrl(
  clientId: string = WPS_CONFIG.appId,
  apiBase: string = WPS_CONFIG.apiBase,
  redirectUri: string = WPS_CONFIG.redirectUri
): string {
  // According to WPS official docs: endpoint is /oauth2/auth
  return `${apiBase}/oauth2/auth?client_id=${encodeURIComponent(clientId)}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=kso.user_base.read kso.sheets.read`;
}

export interface WpsCellAttachment {
  id: string;
  name: string;
  size: number;
}

export interface WpsCellAttachmentsResponse {
  attachments: WpsCellAttachment[];
}

/**
 * Get list of attachments on a specific cell
 * GET /v7/files/{file_id}/worksheets/{worksheet_id}/cells/{row}/{col}/attachments
 */
export async function getCellAttachments(
  accessToken: string,
  spreadsheetId: string,
  worksheetId: number,
  row: number,
  col: number,
  apiBase: string = WPS_CONFIG.apiBase
): Promise<WpsCellAttachmentsResponse> {
  const endpoint = `/v7/files/${encodeURIComponent(spreadsheetId)}/worksheets/${worksheetId}/cells/${row}/${col}/attachments`;

  const isBrowser = typeof window !== 'undefined';
  let response;

  if (isBrowser) {
    const proxyUrl = '/api/wps-proxy';
    response = await fetch(proxyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        endpoint,
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }),
    });
  } else {
    const url = `${apiBase}${endpoint}`;
    response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
  }

  if (!response.ok) {
    throw new Error(`Failed to get cell attachments: ${response.statusText}`);
  }

  const fullResponse = await response.json();
  return fullResponse?.data || { attachments: [] };
}

/**
 * Sync tasks from WPS spreadsheet - complete sync flow with token refresh
 */
export async function syncTasksFromWps(
  config?: {
    appId: string;
    appKey: string;
    apiUrl: string;
    fileId: string;
    worksheetId?: number;
    rowFrom?: number;
    rowTo?: number;
    colFrom?: number;
    colTo?: number;
  }
): Promise<{ tasks: Task[]; rawData: any }> {
  const token = await getWpsAccessToken(undefined, config);
  const result = await fetchTasksFromWps(token.access_token, {
    spreadsheetId: config?.fileId,
    worksheetId: config?.worksheetId,
    rowFrom: config?.rowFrom,
    rowTo: config?.rowTo,
    colFrom: config?.colFrom,
    colTo: config?.colTo,
    apiBase: config?.apiUrl,
  });
  return result;
}

export { WPS_CONFIG };
