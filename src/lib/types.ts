import { z } from 'zod';

// Zod Schemas for validation
export const QueryRequestSchema = z.object({
  question: z.string().min(1, 'Question cannot be empty'),
  session_id: z.string().optional(),
});

// Enhanced citation information
export const CitationSchema = z.object({
  filename: z.string(),
  pages: z.array(z.number()),
  relevance_score: z.number().optional(), // Future enhancement
  excerpt: z.string().optional(), // Future enhancement
});

export const QueryResponseSchema = z.object({
  answer: z.string(),
  session_id: z.string(),
  sources: z.record(z.array(z.number())).optional(), // Deprecated: filename -> pages
  citations: z.array(CitationSchema).optional(), // Enhanced format
});

export const ChatHistoryResponseSchema = z.object({
  session_id: z.string(),
  history: z.array(z.object({
    role: z.enum(['human', 'ai']),
    content: z.string(),
  })),
});

export const DocumentInfoSchema = z.object({
  filename: z.string(),
  size: z.number(),
  upload_date: z.string(),
});

export const DocumentListResponseSchema = z.object({
  documents: z.array(DocumentInfoSchema),
});

export const UploadResponseSchema = z.object({
  message: z.string(),
  filename: z.string(),
});

export const PromptConfigSchema = z.object({
  system_prompt: z.string(),
  user_greeting: z.string(),
  context_instruction: z.string(),
  fallback_response: z.string(),
});

export const PromptUpdateRequestSchema = z.object({
  prompts: PromptConfigSchema,
});

// URL Document Schemas
export const UrlDocumentSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  title: z.string(),
  status: z.enum(['pending', 'fetched', 'indexed', 'error']),
  contentType: z.enum(['html', 'pdf']).optional(),
  dateAdded: z.string(),
  lastFetched: z.string().optional(),
  lastIndexed: z.string().optional(),
  error: z.string().optional(),
  // Store fetched content for later embedding
  fetchedDocuments: z.array(z.object({
    pageContent: z.string(),
    metadata: z.record(z.union([z.string(), z.number(), z.boolean()])),
  })).optional(),
});

export const UrlListResponseSchema = z.object({
  urls: z.array(UrlDocumentSchema),
});

export const AddUrlRequestSchema = z.object({
  url: z.string().url(),
});

export const AddUrlResponseSchema = z.object({
  message: z.string(),
  url: UrlDocumentSchema,
});

export const RefreshUrlResponseSchema = z.object({
  message: z.string(),
  url: UrlDocumentSchema,
});

// Bulk URL Schemas
export const AddBulkUrlsRequestSchema = z.object({
  urls: z.array(z.string().url()),
});

export const BulkUrlResultSchema = z.object({
  url: z.string(),
  status: z.enum(['success', 'error']),
  message: z.string(),
  document: UrlDocumentSchema.optional(),
});

export const AddBulkUrlsResponseSchema = z.object({
  message: z.string(),
  total: z.number(),
  successful: z.number(),
  failed: z.number(),
  results: z.array(BulkUrlResultSchema),
});

// TypeScript types derived from schemas
export type QueryRequest = z.infer<typeof QueryRequestSchema>;
export type QueryResponse = z.infer<typeof QueryResponseSchema>;
export type Citation = z.infer<typeof CitationSchema>;
export type ChatHistoryResponse = z.infer<typeof ChatHistoryResponseSchema>;
export type DocumentInfo = z.infer<typeof DocumentInfoSchema>;
export type DocumentListResponse = z.infer<typeof DocumentListResponseSchema>;
export type UploadResponse = z.infer<typeof UploadResponseSchema>;
export type PromptConfig = z.infer<typeof PromptConfigSchema>;
export type PromptUpdateRequest = z.infer<typeof PromptUpdateRequestSchema>;
export type UrlDocument = z.infer<typeof UrlDocumentSchema>;
export type UrlListResponse = z.infer<typeof UrlListResponseSchema>;
export type AddUrlRequest = z.infer<typeof AddUrlRequestSchema>;
export type AddUrlResponse = z.infer<typeof AddUrlResponseSchema>;
export type RefreshUrlResponse = z.infer<typeof RefreshUrlResponseSchema>;
export type AddBulkUrlsRequest = z.infer<typeof AddBulkUrlsRequestSchema>;
export type BulkUrlResult = z.infer<typeof BulkUrlResultSchema>;
export type AddBulkUrlsResponse = z.infer<typeof AddBulkUrlsResponseSchema>;

// Chat message type
export interface ChatMessage {
  role: 'human' | 'ai';
  content: string;
}

// CWP Vietnam Auth API types
export const LoginRequestSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
  role: z.string().optional(),
});

export const LoginResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  id: z.string(),
  username: z.string(),
  role: z.string(),
  hospitalGroupId: z.string().nullable(),
  status: z.string(),
  type: z.string(),
  avatar: z.string().nullable(),
  fullName: z.string(),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
export type LoginResponse = z.infer<typeof LoginResponseSchema>;
