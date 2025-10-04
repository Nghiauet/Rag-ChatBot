import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import path from 'path';

interface User {
  username: string;
  password: string;
  name: string;
}

interface UsersConfig {
  users: User[];
}
// to create new user: echo -n "CoWP@2025" | sha256sum
export async function POST(request: NextRequest) {
  try {
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

    // Read users from config file (async to avoid blocking)
    const usersFilePath = path.join(process.cwd(), 'data', 'users.json');
    const usersData = await fs.readFile(usersFilePath, 'utf-8');
    const config: UsersConfig = JSON.parse(usersData);

    // Hash the input password with SHA-256
    const hashedPassword = createHash('sha256').update(password).digest('hex');

    // Find user with matching username and password
    const user = config.users.find(
      (u) => u.username === username && u.password === hashedPassword
    );

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Return success with user info (excluding password)
    return NextResponse.json({
      success: true,
      user: {
        username: user.username,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    const message = error instanceof SyntaxError ? 'Invalid JSON body' : 'Internal server error';
    const status = error instanceof SyntaxError ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
