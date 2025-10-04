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
