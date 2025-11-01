import axios from 'axios';

// Use relative paths for Next.js API routes (no baseURL needed)
// Configure timeout to prevent indefinite hanging
const api = axios.create({
  timeout: 120000, // 2 minutes for normal operations
});

export interface DocumentInfo {
  filename: string;
  size: number;
  upload_date: string;
}

export interface DocumentListResponse {
  documents: DocumentInfo[];
}

export interface UploadResponse {
  message: string;
  filename: string;
}

export interface PromptConfig {
  system_prompt: string;
  user_greeting: string;
  context_instruction: string;
  fallback_response: string;
}

export const documentAPI = {
  // Get list of documents
  getDocuments: async (): Promise<DocumentListResponse> => {
    const response = await api.get('/api/documents');
    return response.data;
  },

  // Upload a document
  uploadDocument: async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post('/api/documents/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Delete a document
  deleteDocument: async (filename: string): Promise<{ message: string }> => {
    const response = await api.delete(`/api/documents/${filename}`);
    return response.data;
  },

  // Download a document
  downloadDocument: async (filename: string): Promise<void> => {
    const response = await api.get(`/api/documents/${filename}/download`, {
      responseType: 'blob',
    });

    // Create blob link to download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export const promptAPI = {
  // Get current prompts
  getPrompts: async (): Promise<PromptConfig> => {
    const response = await api.get('/api/prompts');
    return response.data;
  },

  // Update prompts
  updatePrompts: async (prompts: PromptConfig): Promise<{ message: string }> => {
    const response = await api.put('/api/prompts', { prompts });
    return response.data;
  },
};

export const embeddingAPI = {
  // Rebuild embeddings for all documents
  rebuildEmbeddings: async (): Promise<{ message: string; documents_processed: string[] }> => {
    // Use longer timeout for embedding rebuild (10 minutes)
    const response = await api.post('/api/documents/rebuild-embeddings', {}, {
      timeout: 600000, // 10 minutes for embedding operations
    });
    return response.data;
  },
};

export interface UrlDocument {
  id: string;
  url: string;
  title: string;
  status: 'pending' | 'fetched' | 'indexed' | 'error';
  contentType?: 'html' | 'pdf';
  dateAdded: string;
  lastFetched?: string;
  lastIndexed?: string;
  error?: string;
}

export interface UrlStatusResponse {
  id: string;
  url: string;
  title: string;
  status: 'pending' | 'fetched' | 'indexed' | 'error';
  progress: string;
  error?: string;
  contentType?: 'html' | 'pdf';
  lastFetched?: string;
  lastIndexed?: string;
}

export interface UrlListResponse {
  urls: UrlDocument[];
}

export interface AddUrlResponse {
  message: string;
  url: UrlDocument;
}

export interface BulkUrlResult {
  url: string;
  status: 'success' | 'error';
  message: string;
  document?: UrlDocument;
}

export interface AddBulkUrlsResponse {
  message: string;
  total: number;
  successful: number;
  failed: number;
  results: BulkUrlResult[];
}

export const urlAPI = {
  // Get list of URLs
  getUrls: async (): Promise<UrlListResponse> => {
    const response = await api.get('/api/urls');
    return response.data;
  },

  // Add a URL (now returns immediately, processes in background)
  addUrl: async (url: string): Promise<AddUrlResponse> => {
    const response = await api.post('/api/urls', { url }, {
      timeout: 10000, // 10 seconds - returns quickly now
    });
    return response.data;
  },

  // Get URL status (for polling)
  getUrlStatus: async (id: string): Promise<UrlStatusResponse> => {
    const response = await api.get(`/api/urls/${id}/status`, {
      timeout: 5000, // 5 seconds for status check
    });
    return response.data;
  },

  // Delete a URL
  deleteUrl: async (id: string): Promise<{ message: string }> => {
    const response = await api.delete(`/api/urls/${id}`);
    return response.data;
  },

  // Refresh a URL
  refreshUrl: async (id: string): Promise<AddUrlResponse> => {
    const response = await api.post(`/api/urls/${id}/refresh`, {}, {
      timeout: 60000, // 1 minute for URL fetching
    });
    return response.data;
  },

  // Add multiple URLs
  addBulkUrls: async (urls: string[]): Promise<AddBulkUrlsResponse> => {
    const response = await api.post('/api/urls', { urls }, {
      timeout: 300000, // 5 minutes for bulk processing
    });
    return response.data;
  },
};