import { Task } from '../types';
import { MACHINES } from '../data';

const WPS_CONFIG = {
  appId: import.meta.env.VITE_WPS_APP_ID || '',
  appKey: import.meta.env.VITE_WPS_APP_KEY || '',
  spreadsheetId: import.meta.env.VITE_WPS_SPREADSHEET_ID || '',
  apiBase: import.meta.env.VITE_WPS_API_BASE || 'https://openapi.wps.cn',
  defaultRange: import.meta.env.VITE_WPS_DEFAULT_RANGE || 'Sheet1!A1:Z1000',
  redirectUri: import.meta.env.VITE_WPS_REDIRECT_URI || window.location.origin,
};

export interface WpsAccessTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
  refresh_token: string;
  refresh_expires_in: number;
}

// Cached access token with expiration
let cachedToken: {
  access_token: string;
  refresh_token: string;
  expiresAt: number;
} | null = null;

export interface WpsCellValue {
  sheetIndex: number;
  row: number;
  column: number;
  value: string;
}

export interface WpsSpreadsheetRangeResponse {
  values: string[][];
}

/**
 * Get WPS access token (with caching and refresh support)
 *
 * OAuth flow requires an authorization code from initial redirect.
 * If we have a cached token that's still valid, reuse it.
 * If expired, use refresh token to get a new one.
 */
export async function getWpsAccessToken(code?: string): Promise<string> {
  if (!WPS_CONFIG.appId || !WPS_CONFIG.appKey) {
    console.warn('WPS App ID or App Key not configured');
    throw new Error('WPS not configured');
  }

  // Return cached token if it's still valid (5 min buffer before expiration)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 300000) {
    return cachedToken.access_token;
  }

  const url = `${WPS_CONFIG.apiBase}/oauth2/token`;
  const body = new URLSearchParams();

  if (cachedToken?.refresh_token) {
    // Use refresh token to get new access token
    body.append('grant_type', 'refresh_token');
    body.append('refresh_token', cachedToken.refresh_token);
    body.append('client_id', WPS_CONFIG.appId);
    body.append('client_secret', WPS_CONFIG.appKey);
  } else if (code) {
    // Initial authorization with code
    body.append('grant_type', 'authorization_code');
    body.append('client_id', WPS_CONFIG.appId);
    body.append('client_secret', WPS_CONFIG.appKey);
    body.append('code', code);
    body.append('redirect_uri', WPS_CONFIG.redirectUri);
  } else {
    throw new Error('No authorization code available and no cached refresh token. You need to complete OAuth authorization first.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!response.ok) {
    const error = await response.json() as { code: number; msg: string };
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

  return data.access_token;
}

/**
 * Fetch all task data from WPS spreadsheet
 */
export async function fetchTasksFromWps(
  accessToken: string,
  range?: string
): Promise<Task[]> {
  const spreadsheetId = WPS_CONFIG.spreadsheetId;
  if (!spreadsheetId) {
    throw new Error('WPS spreadsheet ID not configured');
  }

  // Get range from parameter or use config default
  const queryRange = range || WPS_CONFIG.defaultRange;
  const url = `${WPS_CONFIG.apiBase}/open/spreadsheet/${spreadsheetId}/values/${encodeURIComponent(queryRange)}`;

  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch spreadsheet: ${response.statusText}`);
  }

  const data = await response.json() as WpsSpreadsheetRangeResponse;

  if (!data.values || data.values.length <= 1) {
    // No data or only header row
    return [];
  }

  // Assume first row is header, skip it
  const rows = data.values.slice(1);
  return rows.map((row, index) => convertWpsRowToTask(row, index));
}

/**
 * Convert WPS spreadsheet row to application Task type
 * Expected columns (adjust based on actual spreadsheet):
 * 0: id (流程卡号)
 * 1: process (工艺)
 * 2: machineName (机台)
 * 3: productName (品名颜色)
 * 4: specification (规格)
 * 5: plannedQuantity (预计数量)
 * 6: actualOutput (实际产出)
 * 7: slittingQuantity (分切数量)
 * 8: shippedQuantity (出货数量)
 * 9: startTime (开始时间)
 * 10: endTime (结束时间)
 * 11: operator (操作员)
 * 12: notes (备注)
 * 13: fileUrl/fileId (WPS文件ID)
 */
function convertWpsRowToTask(row: string[], index: number): Task {
  const [
    id = `TC-${Date.now() + index}`,
    process = '',
    machineName = '',
    productName = '',
    specification = '',
    plannedQuantity = '0',
    actualOutput = '0',
    slittingQuantity = '0',
    shippedQuantity = '0',
    startTime = new Date().toISOString(),
    endTime = new Date().toISOString(),
    operator = '',
    notes = '',
    fileUrl = '',
  ] = row;

  // Get machineId from machineName by looking up in MACHINES list
  const trimmedMachineName = machineName.trim();
  const machine = MACHINES.find(m => m.name === trimmedMachineName);
  const machineId = machine?.id || `M-${Date.now() + index}`;
  const resolvedMachineName = machine?.name || trimmedMachineName;

  return {
    id: id.trim(),
    process: process.trim(),
    machineId,
    machineName: resolvedMachineName,
    productName: productName.trim(),
    specification: specification.trim(),
    plannedQuantity: Number(plannedQuantity) || 0,
    actualOutput: Number(actualOutput) || 0,
    slittingQuantity: Number(slittingQuantity) || 0,
    shippedQuantity: Number(shippedQuantity) || 0,
    startTime: new Date(startTime.trim()).toISOString(),
    endTime: new Date(endTime.trim()).toISOString(),
    operator: operator.trim(),
    notes: notes.trim(),
    fileUrl: fileUrl.trim() || undefined,
  };
}

/**
 * Get the WPS OAuth authorization URL
 * Users visit this URL to grant access to the application
 */
export function getWpsAuthorizationUrl(): string {
  const redirectUri = WPS_CONFIG.redirectUri;
  return `${WPS_CONFIG.apiBase}/oauth/authorize?client_id=${WPS_CONFIG.appId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

export { WPS_CONFIG };
