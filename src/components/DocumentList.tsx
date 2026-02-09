'use client';

import { useEffect, useState, useRef } from 'react';
import { documentAPI, DocumentInfo, embeddingAPI, urlAPI, UrlDocument, RebuildProgress } from '@/lib/api';
import toast from 'react-hot-toast';
import { FileText, Download, Trash2, RefreshCw, Loader2, FolderOpen } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

interface DocumentListProps {
  refreshTrigger: number;
}

export default function DocumentList({ refreshTrigger }: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [urls, setUrls] = useState<UrlDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [rebuildingEmbeddings, setRebuildingEmbeddings] = useState(false);
  const [rebuildProgress, setRebuildProgress] = useState<RebuildProgress | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; filename: string | null }>({
    isOpen: false,
    filename: null
  });
  const [rebuildDialog, setRebuildDialog] = useState(false);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const [documentsResponse, urlsResponse] = await Promise.all([
        documentAPI.getDocuments(),
        urlAPI.getUrls()
      ]);
      setDocuments(documentsResponse.documents);
      setUrls(urlsResponse.urls);
    } catch (error: unknown) {
      console.error('Failed to fetch documents:', error);
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, [refreshTrigger]);

  // Cleanup polling interval on unmount
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, []);

  // Poll rebuild status
  const pollRebuildStatus = async (jobId: string) => {
    const maxAttempts = 180; // 10 minutes with 3-second intervals (180 * 3s = 540s = 9min)
    let attempts = 0;

    const checkStatus = async () => {
      try {
        attempts++;
        const status = await embeddingAPI.checkRebuildStatus(jobId);

        console.log(`Rebuild status (attempt ${attempts}):`, status);

        // Update progress
        setRebuildProgress(status.progress);

        if (status.status === 'completed') {
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          setRebuildingEmbeddings(false);
          setRebuildProgress(null);
          setRebuildDialog(false);

          toast.success('Embeddings rebuilt successfully!', {
            duration: 5000,
          });

          // Refresh document list
          await fetchDocuments();
        } else if (status.status === 'error') {
          // Stop polling
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          setRebuildingEmbeddings(false);
          setRebuildProgress(null);
          setRebuildDialog(false);

          toast.error(`Rebuild failed: ${status.error || 'Unknown error'}`, {
            duration: 8000,
          });
        } else if (attempts >= maxAttempts) {
          // Timeout
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          setRebuildingEmbeddings(false);
          setRebuildProgress(null);
          setRebuildDialog(false);

          toast.error('Rebuild status check timed out. The process may still be running in the background.', {
            duration: 8000,
          });
        }
      } catch (error) {
        const err = error as {
          message?: string;
          response?: {
            status?: number;
            data?: unknown;
          };
        };
        console.error('Error polling rebuild status', {
          jobId,
          attempt: attempts,
          message: err.message,
          status: err.response?.status,
          responseData: err.response?.data,
        });
        // Continue polling on error (might be temporary network issue)
        if (attempts >= maxAttempts) {
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }

          setRebuildingEmbeddings(false);
          setRebuildProgress(null);
          setRebuildDialog(false);

          toast.error('Failed to check rebuild status. Please refresh the page.', {
            duration: 6000,
          });
        }
      }
    };

    // Start polling
    checkStatus(); // Check immediately
    pollingIntervalRef.current = setInterval(checkStatus, 3000); // Then every 3 seconds
  };

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
    } catch (error: unknown) {
      console.error('Delete error:', error);
      const err = error as { code?: string; message?: string; response?: { data?: { detail?: string } } };
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        toast.error('Request timed out. Please check your connection and try again.');
      } else {
        toast.error(err.response?.data?.detail || 'Failed to delete document');
      }
    } finally {
      setDeleting(null);
      setDeleteDialog({ isOpen: false, filename: null });
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      await documentAPI.downloadDocument(filename);
      toast.success(`Downloading "${filename}"`);
    } catch (error: unknown) {
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
      setRebuildProgress(null);

      // Start rebuild (returns immediately with jobId)
      const result = await embeddingAPI.rebuildEmbeddings();

      console.log('Rebuild started:', result);

      // Show initial progress
      setRebuildProgress(result.progress);

      // Show toast that rebuild started
      toast.success('Rebuild started in background. Monitoring progress...', {
        duration: 3000,
      });

      // Start polling for status
      await pollRebuildStatus(result.jobId);
    } catch (error: unknown) {
      console.error('Rebuild embeddings error:', error);
      const err = error as { code?: string; message?: string; response?: { data?: { detail?: string; error?: string } } };

      setRebuildingEmbeddings(false);
      setRebuildProgress(null);
      setRebuildDialog(false);

      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        toast.error('Failed to start rebuild operation. Please try again.', {
          duration: 6000,
        });
      } else {
        toast.error(err.response?.data?.detail || err.response?.data?.error || 'Failed to start rebuild embeddings');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--md-sys-color-primary)' }} />
      </div>
    );
  }

  if (documents.length === 0 && urls.length === 0) {
    return (
      <div className="text-center py-16 px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: 'var(--md-sys-color-surface-container-high)', color: 'color-mix(in oklab, var(--md-sys-color-on-surface) 70%, transparent)' }}>
          <FolderOpen className="w-8 h-8" />
        </div>
        <p className="text-lg font-medium mb-1">No documents yet</p>
        <p className="text-sm opacity-70">Upload a PDF file or add a URL to get started</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      <div className="m3-card">
        {/* Header */}
        <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}>
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-medium">
                  Documents
                </h3>
                <p className="text-sm opacity-70">
                  {documents.length} PDF{documents.length !== 1 ? 's' : ''}, {urls.length} URL{urls.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <button onClick={handleRebuildEmbeddings} disabled={rebuildingEmbeddings || (documents.length === 0 && urls.length === 0)} className="m3-btn m3-btn--filled">
                {rebuildingEmbeddings ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>
                      {rebuildProgress ? `${rebuildProgress.percentage}%` : 'Rebuilding...'}
                    </span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Rebuild Embeddings</span>
                  </>
                )}
              </button>
              {rebuildingEmbeddings && rebuildProgress && (
                <p className="text-xs opacity-70">
                  {rebuildProgress.currentStep}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Document List */}
        <div className="divide-y" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
          {documents.map((doc) => (
            <div
              key={doc.filename}
              className="px-6 py-4 transition-colors duration-150"
              style={{
                background: 'transparent'
              }}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}>
                    <FileText className="w-6 h-6" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate mb-1">
                      {doc.filename}
                    </p>
                    <div className="flex items-center gap-2 text-xs opacity-70">
                      <span>{formatFileSize(doc.size)}</span>
                      <span>•</span>
                      <span>{formatDate(doc.upload_date)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button onClick={() => handleDownload(doc.filename)} className="m3-btn m3-btn--tonal">
                    <Download className="w-4 h-4" />
                    <span>Download</span>
                  </button>
                  <button onClick={() => handleDelete(doc.filename)} disabled={deleting === doc.filename} className="m3-btn m3-btn--outline" style={{ color: 'var(--md-sys-color-error)', borderColor: 'var(--md-sys-color-error)' }}>
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
