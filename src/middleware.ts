import { NextRequest, NextResponse } from 'next/server';

const BASIC_AUTH_USERNAME = process.env.BASIC_AUTH_USERNAME || '';
const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD || '';

function unauthorizedResponse() {
  return new NextResponse(JSON.stringify({ error: 'Unauthorized' }), {
    status: 401,
    headers: {
      'Content-Type': 'application/json',
      'WWW-Authenticate': 'Basic realm="RAG ChatBot"',
    },
  });
}

function misconfiguredResponse() {
  return new NextResponse(
    JSON.stringify({ error: 'Basic authentication is not configured on the server.' }),
    {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );
}

function isBasicAuthValid(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization') || '';
  if (!authHeader.startsWith('Basic ')) {
    return false;
  }

  try {
    const encoded = authHeader.slice('Basic '.length).trim();
    const decoded = atob(encoded);
    const separatorIndex = decoded.indexOf(':');
    if (separatorIndex === -1) {
      return false;
    }
    const username = decoded.slice(0, separatorIndex);
    const password = decoded.slice(separatorIndex + 1);
    return username === BASIC_AUTH_USERNAME && password === BASIC_AUTH_PASSWORD;
  } catch {
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/api/auth/login') {
    return NextResponse.next();
  }

  if (!BASIC_AUTH_USERNAME || !BASIC_AUTH_PASSWORD) {
    console.error('Basic auth credentials are not configured.');
    return misconfiguredResponse();
  }

  if (!isBasicAuthValid(request)) {
    return unauthorizedResponse();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
