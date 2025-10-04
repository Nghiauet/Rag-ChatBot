'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { FileText, Lock, User, Moon, Sun } from 'lucide-react';
import { useTheme } from '@/contexts/ThemeContext';

interface LoginProps {
  onLoginSuccess: (username: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { theme, toggle } = useTheme();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username || !password) {
      toast.error('Please enter both username and password');
      return;
    }

    setIsLoading(true);

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Login successful!');
        // Don't set localStorage here - let AuthContext handle it
        onLoginSuccess(data.user.username);
      } else {
        toast.error(data.error || 'Invalid username or password');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      if (error.name === 'AbortError') {
        toast.error('Login request timed out. Please check your connection and try again.');
      } else {
        toast.error('Failed to login. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative" style={{ background: 'var(--md-sys-color-surface)' }}>
      {/* Theme Toggle Button */}
      <button
        onClick={toggle}
        className="absolute top-4 right-4 p-3 rounded-full transition-all hover:bg-opacity-10"
        style={{
          background: 'color-mix(in oklab, var(--md-sys-color-on-surface) 8%, transparent)',
          color: 'var(--md-sys-color-on-surface)',
        }}
        aria-label="Toggle theme"
      >
        {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
      </button>

      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <div
            className="inline-flex items-center justify-center w-16 h-16 mb-6 elevation-2"
            style={{ background: 'var(--md-sys-color-primary)', color: 'var(--md-sys-color-on-primary)', borderRadius: 'var(--md-sys-shape-corner-xl)' }}
          >
            <FileText className="w-8 h-8" strokeWidth={2} />
          </div>
          <h1 className="text-3xl font-normal mb-2">
            Women's Health Assistant
          </h1>
          <p className="text-base opacity-70">Management Dashboard</p>
        </div>

        {/* Login Card */}
        <div className="m3-card p-8 elevation-1">
          <h2 className="text-2xl font-medium mb-8 text-center">
            Sign In
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="username" className="m3-label">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" style={{ color: 'color-mix(in oklab, var(--md-sys-color-on-surface) 60%, transparent)' }}>
                  <User className="h-5 w-5" />
                </div>
                <input
                  id="username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="m3-input"
                  placeholder="Enter username"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="m3-label">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none" style={{ color: 'color-mix(in oklab, var(--md-sys-color-on-surface) 60%, transparent)' }}>
                  <Lock className="h-5 w-5" />
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="m3-input"
                  placeholder="Enter password"
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="flex justify-center mt-6">
              <button type="submit" disabled={isLoading} className="m3-btn m3-btn--filled px-16">
                {isLoading ? 'Signing in...' : 'Sign In'}
              </button>
            </div>
          </form>

        </div>

        <p className="text-center text-sm mt-6" style={{ color: 'color-mix(in oklab, var(--md-sys-color-on-surface) 60%, transparent)' }}>
          Secure access to document and prompt management
        </p>
      </div>
    </div>
  );
}
