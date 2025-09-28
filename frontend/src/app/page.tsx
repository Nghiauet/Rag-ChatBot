'use client';

import { useState } from 'react';
import DocumentUpload from '@/components/DocumentUpload';
import DocumentList from '@/components/DocumentList';
import { Toaster } from 'react-hot-toast';

export default function Home() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

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
              Document Management System
            </p>
          </div>

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
        </div>
      </div>
    </>
  );
}