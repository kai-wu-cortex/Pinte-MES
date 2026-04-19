import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { endpoint, body, headers } = await request.json();

    const wpsApiBase = 'https://openapi.wps.cn';
    const url = `${wpsApiBase}${endpoint}`;

    let fetchOptions: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    if (body) {
      if (typeof body === 'object' && !(body instanceof FormData)) {
        // For OAuth token request, body is already URLSearchParams as object from frontend
        if (endpoint === '/oauth2/token') {
          const formBody = new URLSearchParams(body);
          fetchOptions.body = formBody;
          fetchOptions.headers = {
            'Content-Type': 'application/x-www-form-urlencoded',
            ...headers,
          };
        } else {
          fetchOptions.body = JSON.stringify(body);
        }
      } else {
        fetchOptions.body = JSON.stringify(body);
      }
    }

    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    return NextResponse.json(data, {
      status: response.ok ? 200 : response.status,
    });
  } catch (error) {
    console.error('WPS proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}
