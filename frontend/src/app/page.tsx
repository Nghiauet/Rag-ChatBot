'use client';

import { useState } from 'react';
import DocumentUpload from '@/components/DocumentUpload';
import DocumentList from '@/components/DocumentList';
import PromptManager from '@/components/PromptManager';
import { Toaster } from 'react-hot-toast';

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState<'documents' | 'prompts'>('documents');

  const handleUploadSuccess = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <>
      <Toaster position="top-right" />

      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Women's Health Assistant
            </h1>
            <p className="text-lg text-gray-600">
              Management Dashboard
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="flex justify-center mb-8">
            <div className="bg-white rounded-lg p-1 shadow-sm">
              <button
                onClick={() => setActiveTab('documents')}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'documents'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Document Management
              </button>
              <button
                onClick={() => setActiveTab('prompts')}
                className={`px-6 py-2 rounded-md font-medium transition-colors ${
                  activeTab === 'prompts'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Prompt Management
              </button>
            </div>
          </div>

          {/* Tab Content */}
          {activeTab === 'documents' && (
            <>
              {/* Upload Section */}
              <div className="mb-12">
                <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
                  Upload New Document
                </h2>
                <DocumentUpload onUploadSuccess={handleUploadSuccess} />
              </div>

              {/* Documents List */}
              <div>
                <h2 className="text-xl font-semibold text-gray-800 mb-4 text-center">
                  Manage Documents
                </h2>
                <DocumentList refreshTrigger={refreshTrigger} />
              </div>
            </>
          )}

          {activeTab === 'prompts' && (
            <PromptManager />
          )}
        </div>
      </div>
    </>
  );
}