'use client';

import { useEffect, useState } from 'react';
import { documentAPI, DocumentInfo, embeddingAPI } from '@/lib/api';
import toast from 'react-hot-toast';

interface DocumentListProps {
  refreshTrigger: number;
}

export default function DocumentList({ refreshTrigger }: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [rebuildingEmbeddings, setRebuildingEmbeddings] = useState(false);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await documentAPI.getDocuments();
      setDocuments(response.documents);
    } catch (error: any) {
      console.error('Failed to fetch documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [refreshTrigger]);

  const handleDelete = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      setDeleting(filename);
      await documentAPI.deleteDocument(filename);
      toast.success(`Document "${filename}" deleted successfully`);
      await fetchDocuments(); // Refresh the list
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete document');
    } finally {
      setDeleting(null);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      await documentAPI.downloadDocument(filename);
      toast.success(`Downloading "${filename}"`);
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error('Failed to download document');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleRebuildEmbeddings = async () => {
    if (!confirm('Are you sure you want to rebuild embeddings? This may take a few minutes depending on the number of documents.')) {
      return;
    }

    try {
      setRebuildingEmbeddings(true);
      const result = await embeddingAPI.rebuildEmbeddings();
      toast.success(`${result.message}\nProcessed: ${result.documents_processed.join(', ')}`, {
        duration: 5000,
      });
    } catch (error: any) {
      console.error('Rebuild embeddings error:', error);
      toast.error(error.response?.data?.detail || 'Failed to rebuild embeddings');
    } finally {
      setRebuildingEmbeddings(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-4xl mb-4">📋</div>
        <p>No documents uploaded yet</p>
        <p className="text-sm">Upload a PDF file to get started</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto">
      <div className="bg-white shadow-md rounded-lg overflow-hidden">
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              Documents ({documents.length})
            </h3>
            <button
              onClick={handleRebuildEmbeddings}
              disabled={rebuildingEmbeddings || documents.length === 0}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center space-x-2"
            >
              {rebuildingEmbeddings ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>Rebuilding...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Rebuild Embeddings</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="divide-y divide-gray-200">
          {documents.map((doc) => (
            <div key={doc.filename} className="px-6 py-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-3">
                    <div className="text-2xl">📄</div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {doc.filename}
                      </p>
                      <p className="text-sm text-gray-500">
                        {formatFileSize(doc.size)} • Uploaded {formatDate(doc.upload_date)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleDownload(doc.filename)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                  >
                    Download
                  </button>
                  <button
                    onClick={() => handleDelete(doc.filename)}
                    disabled={deleting === doc.filename}
                    className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {deleting === doc.filename ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}