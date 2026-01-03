import { NextRequest, NextResponse } from 'next/server';
import { BASIC_AUTH_USERNAME, BASIC_AUTH_PASSWORD } from '@/lib/config';

export async function POST(request: NextRequest) {
  try {
    if (!BASIC_AUTH_USERNAME || !BASIC_AUTH_PASSWORD) {
      return NextResponse.json(
        { error: 'Admin credentials are not configured on the server.' },
        { status: 500 }
      );
    }

    // Be resilient to different content types or empty bodies
    let username = '';
    let password = '';

    try {
      const contentType = request.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const body = await request.json().catch(() => null);
        username = body?.username ?? '';
        password = body?.password ?? '';
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const form = await request.formData();
        username = String(form.get('username') || '');
        password = String(form.get('password') || '');
      } else {
        // Fallback: try to read text and parse if present
        const text = await request.text();
        if (text) {
          try {
            const body = JSON.parse(text);
            username = body?.username ?? '';
            password = body?.password ?? '';
          } catch {
            // ignore; will validate below
          }
        }
      }
    } catch {
      // ignore and rely on validation below
    }

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    if (username !== BASIC_AUTH_USERNAME || password !== BASIC_AUTH_PASSWORD) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Return success with user info (excluding password)
    return NextResponse.json({
      success: true,
      user: {
        username,
        name: username,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    const message = error instanceof SyntaxError ? 'Invalid JSON body' : 'Internal server error';
    const status = error instanceof SyntaxError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
