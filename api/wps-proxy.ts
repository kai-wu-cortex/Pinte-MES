import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight OPTIONS
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { endpoint, body, headers } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint' });
    }

    const wpsUrl = `https://openapi.wps.cn${endpoint}`;

    // Forward the request to WPS API
    let fetchOptions: RequestInit = {
      headers: headers || {},
    };

    if (body) {
      if (typeof body === 'object' && !Array.isArray(body)) {
        // For form-urlencoded body
        fetchOptions.method = 'POST';
        fetchOptions.body = new URLSearchParams(body);
        (fetchOptions.headers as Record<string, string>)['Content-Type'] = 'application/x-www-form-urlencoded';
      } else {
        fetchOptions.method = 'GET';
      }
    }

    const response = await fetch(wpsUrl, fetchOptions);
    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('WPS proxy error:', error);
    return res.status(500).json({ error: 'Proxy error', message: String(error) });
  }
}
