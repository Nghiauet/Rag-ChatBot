import axios from 'axios';

// Use relative paths for Next.js API routes (no baseURL needed)
const api = axios.create();

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
    const response = await api.post('/api/documents/rebuild-embeddings');
    return response.data;
  },
};