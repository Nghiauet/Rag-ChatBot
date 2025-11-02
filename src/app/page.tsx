'use client';

import { useState } from 'react';
import DocumentUpload from '@/components/DocumentUpload';
import DocumentList from '@/components/DocumentList';
import PromptManager from '@/components/PromptManager';
import UrlManager from '@/components/UrlManager';
import Login from '@/components/Login';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, MessageSquare, LogOut, Sun, Moon, Link } from 'lucide-react';
import { M3AppBar, M3Button, M3Tabs, M3Tab } from '@/components/ui/M3';
import { useTheme } from '@/contexts/ThemeContext';

export default function Home() {
  const { isAuthenticated, username, login, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'documents' | 'urls' | 'prompts'>('documents');

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLoginSuccess = (loggedInUsername: string) => {
    login(loggedInUsername);
  };

  // Show login screen if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <Toaster position="top-right" />
        <Login onLoginSuccess={handleLoginSuccess} />
      </>
    );
  }

  return (
    <>
      <Toaster position="top-right" />

      <div className="min-h-screen">
        {/* App Bar (Material 3) */}
        <M3AppBar>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-10 h-10"
              style={{
                background: 'var(--md-sys-color-primary)',
                color: 'var(--md-sys-color-on-primary)',
                borderRadius: 'var(--md-sys-shape-corner-xl)'
              }}
            >
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-medium">Women&apos;s Health Assistant</h1>
              <p className="text-xs opacity-70">Management Dashboard</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggle}
              className="m3-icon-btn"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <div className="text-sm opacity-80">
              <span className="opacity-70">Logged in as </span>
              <span className="font-medium">{username}</span>
            </div>
            <M3Button variant="tonal" onClick={logout}>
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </M3Button>
          </div>
        </M3AppBar>

        {/* Tabs (Material 3) */}
        <M3Tabs>
          <M3Tab selected={activeTab === 'documents'} onClick={() => setActiveTab('documents')}>
            <span className="inline-flex items-center gap-2">
              <FileText className="w-4 h-4" /> Documents
            </span>
          </M3Tab>
          <M3Tab selected={activeTab === 'urls'} onClick={() => setActiveTab('urls')}>
            <span className="inline-flex items-center gap-2">
              <Link className="w-4 h-4" /> Web Sources
            </span>
          </M3Tab>
          <M3Tab selected={activeTab === 'prompts'} onClick={() => setActiveTab('prompts')}>
            <span className="inline-flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> Prompts
            </span>
          </M3Tab>
        </M3Tabs>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'documents' && (
            <div className="space-y-12">
              {/* Upload Section */}
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-medium mb-1">
                    Upload Document
                  </h2>
                  <p className="text-sm opacity-70">
                    Add PDF files to your knowledge base
                  </p>
                </div>
                <DocumentUpload onUploadSuccess={handleUploadSuccess} />
              </div>

              {/* Documents List */}
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-medium mb-1">
                    Your Documents
                  </h2>
                  <p className="text-sm opacity-70">
                    Manage your uploaded documents
                  </p>
                </div>
                <DocumentList refreshTrigger={refreshTrigger} />
              </div>
            </div>
          )}

          {activeTab === 'urls' && (
            <div className="py-4">
              <div className="mb-6">
                <h2 className="text-xl font-medium mb-1">
                  Web Sources
                </h2>
                <p className="text-sm opacity-70">
                  Index and manage web content from URLs
                </p>
              </div>
              <UrlManager />
            </div>
          )}

          {activeTab === 'prompts' && (
            <div className="py-4">
              <PromptManager />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
