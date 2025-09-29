'use client';

import { useState } from 'react';
import DocumentUpload from '@/components/DocumentUpload';
import DocumentList from '@/components/DocumentList';
import PromptManager from '@/components/PromptManager';
import Login from '@/components/Login';
import { Toaster } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, MessageSquare, LogOut } from 'lucide-react';

export default function Home() {
  const { isAuthenticated, username, login, logout } = useAuth();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'documents' | 'prompts'>('documents');

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLoginSuccess = () => {
    login(username || 'admin');
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

      <div className="min-h-screen bg-gray-50">
        {/* App Bar */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-10 h-10 bg-blue-600 rounded-xl">
                  <FileText className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-medium text-gray-900">
                    Women's Health Assistant
                  </h1>
                  <p className="text-xs text-gray-500">Management Dashboard</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-600">
                  <span className="text-gray-500">Logged in as </span>
                  <span className="font-medium text-gray-900">{username}</span>
                </div>
                <button
                  onClick={logout}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-150"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('documents')}
                className={`
                  inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === 'documents'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }
                `}
              >
                <FileText className="w-4 h-4" />
                <span>Documents</span>
              </button>
              <button
                onClick={() => setActiveTab('prompts')}
                className={`
                  inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors
                  ${activeTab === 'prompts'
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }
                `}
              >
                <MessageSquare className="w-4 h-4" />
                <span>Prompts</span>
              </button>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {activeTab === 'documents' && (
            <div className="space-y-12">
              {/* Upload Section */}
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-medium text-gray-900 mb-1">
                    Upload Document
                  </h2>
                  <p className="text-sm text-gray-500">
                    Add PDF files to your knowledge base
                  </p>
                </div>
                <DocumentUpload onUploadSuccess={handleUploadSuccess} />
              </div>

              {/* Documents List */}
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-medium text-gray-900 mb-1">
                    Your Documents
                  </h2>
                  <p className="text-sm text-gray-500">
                    Manage your uploaded documents
                  </p>
                </div>
                <DocumentList refreshTrigger={refreshTrigger} />
              </div>
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