'use client';

import { useEffect, useState } from 'react';
import { documentAPI, DocumentInfo, embeddingAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { FileText, Download, Trash2, RefreshCw, Loader2, FolderOpen } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

interface DocumentListProps {
  refreshTrigger: number;
}

export default function DocumentList({ refreshTrigger }: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [rebuildingEmbeddings, setRebuildingEmbeddings] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; filename: string | null }>({
    isOpen: false,
    filename: null
  });
  const [rebuildDialog, setRebuildDialog] = useState(false);

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

  const handleDelete = (filename: string) => {
    setDeleteDialog({ isOpen: true, filename });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.filename) return;

    try {
      setDeleting(deleteDialog.filename);
      const response = await documentAPI.deleteDocument(deleteDialog.filename);
      toast.success(response.message, { duration: 5000 });

      // Show additional warning about rebuilding embeddings
      setTimeout(() => {
        toast('Remember to rebuild embeddings to update the knowledge base', {
          duration: 6000,
          icon: '⚠️',
          style: {
            background: '#FEF3C7',
            color: '#92400E',
            border: '1px solid #FCD34D',
          },
        });
      }, 500);

      await fetchDocuments(); // Refresh the list
    } catch (error: any) {
      console.error('Delete error:', error);
      toast.error(error.response?.data?.detail || 'Failed to delete document');
    } finally {
      setDeleting(null);
      setDeleteDialog({ isOpen: false, filename: null });
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

  const handleRebuildEmbeddings = () => {
    setRebuildDialog(true);
  };

  const confirmRebuildEmbeddings = async () => {
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
      setRebuildDialog(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-2xl mb-4">
          <FolderOpen className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-lg font-medium text-gray-900 mb-1">No documents yet</p>
        <p className="text-sm text-gray-500">Upload a PDF file to get started</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 bg-blue-50 rounded-xl">
                <FileText className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Documents
                </h3>
                <p className="text-sm text-gray-500">{documents.length} files uploaded</p>
              </div>
            </div>
            <button
              onClick={handleRebuildEmbeddings}
              disabled={rebuildingEmbeddings || documents.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium bg-green-600 text-white rounded-xl hover:bg-green-700 hover:shadow-lg hover:shadow-green-600/20 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-200"
            >
              {rebuildingEmbeddings ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Rebuilding...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  <span>Rebuild Embeddings</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Document List */}
        <div className="divide-y divide-gray-100">
          {documents.map((doc) => (
            <div
              key={doc.filename}
              className="px-6 py-4 hover:bg-gray-50/50 transition-colors duration-150"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate mb-1">
                      {doc.filename}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{formatFileSize(doc.size)}</span>
                      <span>•</span>
                      <span>{formatDate(doc.upload_date)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleDownload(doc.filename)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-150"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={() => handleDelete(doc.filename)}
                    disabled={deleting === doc.filename}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 bg-red-50 rounded-xl hover:bg-red-100 transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {deleting === doc.filename ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Deleting...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="w-4 h-4" />
                        <span>Delete</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, filename: null })}
        onConfirm={confirmDelete}
        title="Delete Document"
        message={`Are you sure you want to delete "${deleteDialog.filename}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />

      {/* Rebuild Embeddings Confirmation Dialog */}
      <ConfirmDialog
        isOpen={rebuildDialog}
        onClose={() => setRebuildDialog(false)}
        onConfirm={confirmRebuildEmbeddings}
        title="Rebuild Embeddings"
        message="This will rebuild embeddings for all documents. The process may take a few minutes depending on the number of documents."
        confirmText="Rebuild"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
}