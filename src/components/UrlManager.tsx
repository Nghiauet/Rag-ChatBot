'use client';

import { useEffect, useState } from 'react';
import { urlAPI, UrlDocument, BulkUrlResult } from '@/lib/api';
import toast from 'react-hot-toast';
import { Link as LinkIcon, Trash2, RefreshCw, Loader2, FolderOpen, Plus, CheckCircle, XCircle, List } from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';

type AddMode = 'single' | 'bulk';

export default function UrlManager() {
  const [urls, setUrls] = useState<UrlDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>('single');
  const [newUrl, setNewUrl] = useState('');
  const [bulkUrls, setBulkUrls] = useState('');
  const [bulkProgress, setBulkProgress] = useState<{ current: number; total: number } | null>(null);
  const [bulkResults, setBulkResults] = useState<BulkUrlResult[]>([]);
  const [showBulkResults, setShowBulkResults] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ isOpen: boolean; url: UrlDocument | null }>({
    isOpen: false,
    url: null
  });

  const fetchUrls = async () => {
    try {
      setLoading(true);
      const response = await urlAPI.getUrls();
      setUrls(response.urls);
    } catch (error: unknown) {
      console.error('Failed to fetch URLs:', error);
      toast.error('Failed to load URLs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUrls();
  }, []);

  const parseUrls = (text: string): string[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && !line.startsWith('#'))
      .filter((url, index, self) => self.indexOf(url) === index); // Remove duplicates
  };

  const pollUrlStatus = async (urlId: string, urlString: string, maxAttempts = 30): Promise<void> => {
    let attempts = 0;
    const pollInterval = 2000; // Poll every 2 seconds

    return new Promise((resolve) => {
      const interval = setInterval(async () => {
        attempts++;

        try {
          const status = await urlAPI.getUrlStatus(urlId);

          // Update the URL in the list
          setUrls(prev => prev.map(u => u.id === urlId ? {
            ...u,
            status: status.status,
            title: status.title,
            contentType: status.contentType,
            error: status.error,
            lastFetched: status.lastFetched,
          } : u));

          // Check if processing is complete
          if (status.status === 'fetched') {
            clearInterval(interval);
            toast.success(`Successfully fetched content from ${urlString}`);
            resolve();
          } else if (status.status === 'error') {
            clearInterval(interval);
            toast.error(`Failed to fetch ${urlString}: ${status.error || 'Unknown error'}`);
            resolve();
          } else if (attempts >= maxAttempts) {
            // Timeout after 60 seconds
            clearInterval(interval);
            toast.error(`Timeout waiting for ${urlString}. Check status later.`);
            resolve();
          }
        } catch (error) {
          console.error('Error polling status:', error);
          // Don't stop polling on error, might be temporary
          if (attempts >= maxAttempts) {
            clearInterval(interval);
            toast.error('Failed to check URL status');
            resolve();
          }
        }
      }, pollInterval);
    });
  };

  const handleAddUrl = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newUrl.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    // Basic URL validation
    try {
      new URL(newUrl);
    } catch {
      toast.error('Please enter a valid URL');
      return;
    }

    try {
      setAdding(true);
      const response = await urlAPI.addUrl(newUrl);
      const urlId = response.url.id;

      // Show initial success message
      toast.success('URL added. Fetching content in background...');
      setNewUrl('');

      // Refresh list to show the pending URL
      await fetchUrls();

      // Start polling for status updates (don't block the UI)
      pollUrlStatus(urlId, newUrl).finally(() => {
        setAdding(false);
      });
    } catch (error: unknown) {
      console.error('Add URL error:', error);
      const err = error as { response?: { status?: number; data?: { error?: string } } };
      if (err.response?.status === 409) {
        toast.error('This URL has already been added');
      } else {
        toast.error(err.response?.data?.error || 'Failed to add URL');
      }
      setAdding(false);
    }
  };

  const handleAddBulkUrls = async (e: React.FormEvent) => {
    e.preventDefault();

    const parsedUrls = parseUrls(bulkUrls);

    if (parsedUrls.length === 0) {
      toast.error('Please enter at least one URL');
      return;
    }

    // Validate all URLs
    const invalidUrls: string[] = [];
    for (const url of parsedUrls) {
      try {
        new URL(url);
      } catch {
        invalidUrls.push(url);
      }
    }

    if (invalidUrls.length > 0) {
      toast.error(`Invalid URLs found: ${invalidUrls.slice(0, 3).join(', ')}${invalidUrls.length > 3 ? '...' : ''}`);
      return;
    }

    try {
      setAdding(true);
      setBulkProgress({ current: 0, total: parsedUrls.length });

      const response = await urlAPI.addBulkUrls(parsedUrls);

      setBulkResults(response.results);
      setShowBulkResults(true);

      if (response.successful > 0) {
        toast.success(`Successfully added ${response.successful} of ${response.total} URLs`);
      }

      if (response.failed > 0) {
        toast.error(`${response.failed} URLs failed to index`);
      }

      setBulkUrls('');
      await fetchUrls();
    } catch (error: unknown) {
      console.error('Bulk add error:', error);
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Failed to add URLs');
    } finally {
      setAdding(false);
      setBulkProgress(null);
    }
  };

  const handleDelete = (url: UrlDocument) => {
    setDeleteDialog({ isOpen: true, url });
  };

  const confirmDelete = async () => {
    if (!deleteDialog.url) return;

    try {
      setDeleting(deleteDialog.url.id);
      await urlAPI.deleteUrl(deleteDialog.url.id);
      toast.success('URL deleted successfully');
      await fetchUrls();
    } catch (error: unknown) {
      console.error('Delete error:', error);
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Failed to delete URL');
    } finally {
      setDeleting(null);
      setDeleteDialog({ isOpen: false, url: null });
    }
  };

  const handleRefresh = async (url: UrlDocument) => {
    try {
      setRefreshing(url.id);
      const response = await urlAPI.refreshUrl(url.id);
      toast.success(`Successfully refreshed: ${response.url.title}`);
      await fetchUrls();
    } catch (error: unknown) {
      console.error('Refresh error:', error);
      const err = error as { code?: string; message?: string; response?: { data?: { error?: string } } };
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        toast.error('Request timed out. The URL may be slow to respond.');
      } else {
        toast.error(err.response?.data?.error || 'Failed to refresh URL');
      }
    } finally {
      setRefreshing(null);
    }
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

  const getStatusBadge = (status: 'pending' | 'fetched' | 'indexed' | 'error') => {
    switch (status) {
      case 'indexed':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--md-sys-color-tertiary-container)', color: 'var(--md-sys-color-on-tertiary-container)' }}>
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Indexed</span>
          </div>
        );
      case 'fetched':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}>
            <CheckCircle className="w-3.5 h-3.5" />
            <span>Fetched</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ background: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}>
            <XCircle className="w-3.5 h-3.5" />
            <span>Error</span>
          </div>
        );
      case 'pending':
        return (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium animate-pulse" style={{ background: 'var(--md-sys-color-secondary-container)', color: 'var(--md-sys-color-on-secondary-container)' }}>
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Processing</span>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-16">
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--md-sys-color-primary)' }} />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Add URL Form */}
      <div className="m3-card mb-6">
        <div className="px-6 py-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <LinkIcon className="w-5 h-5" />
              Add Web Source
            </h3>
            {/* Mode Toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setAddMode('single')}
                className={addMode === 'single' ? 'm3-btn m3-btn--filled' : 'm3-btn m3-btn--outline'}
              >
                <Plus className="w-4 h-4" />
                <span>Single</span>
              </button>
              <button
                onClick={() => setAddMode('bulk')}
                className={addMode === 'bulk' ? 'm3-btn m3-btn--filled' : 'm3-btn m3-btn--outline'}
              >
                <List className="w-4 h-4" />
                <span>Bulk</span>
              </button>
            </div>
          </div>

          {/* Single URL Mode */}
          {addMode === 'single' && (
            <form onSubmit={handleAddUrl} className="flex gap-3">
              <input
                type="url"
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="https://example.com/article"
                disabled={adding}
                className="flex-1 px-4 py-2.5 rounded-xl text-sm transition-colors"
                style={{
                  background: 'var(--md-sys-color-surface-container-highest)',
                  color: 'var(--md-sys-color-on-surface)',
                  border: '1px solid var(--md-sys-color-outline)',
                  outline: 'none'
                }}
              />
              <button
                type="submit"
                disabled={adding || !newUrl.trim()}
                className="m3-btn m3-btn--filled"
              >
                {adding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Adding...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Add URL</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* Bulk URL Mode */}
          {addMode === 'bulk' && (
            <form onSubmit={handleAddBulkUrls} className="space-y-3">
              <div>
                <textarea
                  value={bulkUrls}
                  onChange={(e) => setBulkUrls(e.target.value)}
                  placeholder="Enter URLs (one per line)&#10;https://example.com/article1&#10;https://example.com/article2&#10;https://example.com/article3"
                  rows={8}
                  disabled={adding}
                  className="w-full px-4 py-3 rounded-xl text-sm transition-colors font-mono"
                  style={{
                    background: 'var(--md-sys-color-surface-container-highest)',
                    color: 'var(--md-sys-color-on-surface)',
                    border: '1px solid var(--md-sys-color-outline)',
                    outline: 'none',
                    resize: 'vertical'
                  }}
                />
                <div className="flex items-center justify-between mt-2 text-xs opacity-70">
                  <span>{parseUrls(bulkUrls).length} URLs detected</span>
                  {bulkProgress && (
                    <span>Processing: {bulkProgress.current}/{bulkProgress.total}</span>
                  )}
                </div>
              </div>
              <button
                type="submit"
                disabled={adding || parseUrls(bulkUrls).length === 0}
                className="m3-btn m3-btn--filled w-full"
              >
                {adding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Processing URLs...</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Add {parseUrls(bulkUrls).length} URLs</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* URL List */}
      {urls.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4" style={{ background: 'var(--md-sys-color-surface-container-high)', color: 'color-mix(in oklab, var(--md-sys-color-on-surface) 70%, transparent)' }}>
            <FolderOpen className="w-8 h-8" />
          </div>
          <p className="text-lg font-medium mb-1">No web sources yet</p>
          <p className="text-sm opacity-70">Add a URL to index web content</p>
        </div>
      ) : (
        <div className="m3-card">
          {/* Header */}
          <div className="px-6 py-5" style={{ borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl" style={{ background: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}>
                <LinkIcon className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-medium">Web Sources</h3>
                <p className="text-sm opacity-70">{urls.length} URLs indexed</p>
              </div>
            </div>
          </div>

          {/* URL List */}
          <div className="divide-y" style={{ borderColor: 'var(--md-sys-color-outline-variant)' }}>
            {urls.map((url) => (
              <div
                key={url.id}
                className="px-6 py-4 transition-colors duration-150"
                style={{ background: 'transparent' }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}>
                      <LinkIcon className="w-6 h-6" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium truncate">
                          {url.title || 'Untitled'}
                        </p>
                        {getStatusBadge(url.status)}
                      </div>
                      <a
                        href={url.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs opacity-70 hover:opacity-100 truncate block mb-1"
                        style={{ color: 'var(--md-sys-color-primary)' }}
                      >
                        {url.url}
                      </a>
                      <div className="flex items-center gap-2 text-xs opacity-70">
                        <span>Added: {formatDate(url.dateAdded)}</span>
                        {url.lastIndexed && (
                          <>
                            <span>•</span>
                            <span>Last indexed: {formatDate(url.lastIndexed)}</span>
                          </>
                        )}
                        {url.contentType && (
                          <>
                            <span>•</span>
                            <span className="uppercase">{url.contentType}</span>
                          </>
                        )}
                      </div>
                      {url.error && (
                        <p className="text-xs mt-1 px-2 py-1 rounded" style={{ background: 'var(--md-sys-color-error-container)', color: 'var(--md-sys-color-on-error-container)' }}>
                          Error: {url.error}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRefresh(url)}
                      disabled={refreshing === url.id || url.status === 'pending'}
                      className="m3-btn m3-btn--tonal"
                    >
                      {refreshing === url.id ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Refreshing...</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-4 h-4" />
                          <span>Refresh</span>
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(url)}
                      disabled={deleting === url.id}
                      className="m3-btn m3-btn--outline"
                      style={{ color: 'var(--md-sys-color-error)', borderColor: 'var(--md-sys-color-error)' }}
                    >
                      {deleting === url.id ? (
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
      )}

      {/* Bulk Results Modal */}
      {showBulkResults && bulkResults.length > 0 && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="m3-card max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="px-6 py-5 sticky top-0" style={{ background: 'var(--md-sys-color-surface)', borderBottom: '1px solid var(--md-sys-color-outline-variant)' }}>
              <h3 className="text-lg font-medium">Bulk URL Processing Results</h3>
              <p className="text-sm opacity-70 mt-1">
                {bulkResults.filter(r => r.status === 'success').length} successful, {bulkResults.filter(r => r.status === 'error').length} failed
              </p>
            </div>
            <div className="px-6 py-4 space-y-3">
              {bulkResults.map((result, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg"
                  style={{
                    background: result.status === 'success'
                      ? 'var(--md-sys-color-tertiary-container)'
                      : 'var(--md-sys-color-error-container)'
                  }}
                >
                  {result.status === 'success' ? (
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--md-sys-color-on-tertiary-container)' }} />
                  ) : (
                    <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: 'var(--md-sys-color-on-error-container)' }} />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{result.document?.title || 'Untitled'}</p>
                    <p className="text-xs opacity-70 truncate">{result.url}</p>
                    <p className="text-xs mt-1">{result.message}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="px-6 py-4 sticky bottom-0" style={{ background: 'var(--md-sys-color-surface)', borderTop: '1px solid var(--md-sys-color-outline-variant)' }}>
              <button
                onClick={() => setShowBulkResults(false)}
                className="m3-btn m3-btn--filled w-full"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteDialog.isOpen}
        onClose={() => setDeleteDialog({ isOpen: false, url: null })}
        onConfirm={confirmDelete}
        title="Delete URL"
        message={`Are you sure you want to delete "${deleteDialog.url?.title || deleteDialog.url?.url}"? This will remove all indexed content from this URL.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
