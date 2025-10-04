import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import fs from 'fs';
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
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    // Read users from config file
    const usersFilePath = path.join(process.cwd(), 'data', 'users.json');
    const usersData = fs.readFileSync(usersFilePath, 'utf-8');
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
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
