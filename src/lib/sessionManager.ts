import { Collection } from 'chromadb';
import { SESSION_TIMEOUT, DOCS_FOLDER } from './config';
import { clearChatHistory } from './chatbot';

// Track active sessions and their last activity time
const activeSessions = new Map<string, number>();

type VectordbState = {
  instance: Collection | null;
  initPromise: Promise<Collection | null> | null;
};

const globalState = globalThis as typeof globalThis & { __vectordbState?: VectordbState };
const vectordbState = globalState.__vectordbState ??= {
  instance: null,
  initPromise: null,
};

let lastCleanupTime = 0;
const CLEANUP_INTERVAL_MS = 60 * 1000;

/**
 * Get the global vectordb instance, initializing it if necessary
 */
export async function getVectordbInstance(): Promise<Collection | null> {
  // If already initialized, return it
  if (vectordbState.instance) {
    return vectordbState.instance;
  }

  if (!vectordbState.initPromise) {
    vectordbState.initPromise = (async () => {
      console.log('🔄 Lazy-loading vector database...');

      try {
        const { getVectorstore, getOrCreateEmptyCollection } = await import('./vectordb');
        const fs = await import('fs/promises');

        // Ensure docs folder exists
        await fs.mkdir(DOCS_FOLDER, { recursive: true });

        // Get list of PDF files
        const allFiles = await fs.readdir(DOCS_FOLDER);
        const pdfFiles = allFiles.filter((file) => file.toLowerCase().endsWith('.pdf'));

        if (pdfFiles.length === 0) {
          console.log('ℹ️  No PDF documents found. Loading existing collection or creating empty one...');
          // Load existing collection from ChromaDB Cloud or create empty one
          vectordbState.instance = await getOrCreateEmptyCollection();
          console.log('✅ Vector database initialized successfully!');
          return vectordbState.instance;
        }

        console.log(`📚 Found ${pdfFiles.length} PDF documents`);

        // Load existing vector database
        vectordbState.instance = await getVectorstore(pdfFiles, false);
        console.log('✅ Vector database initialized successfully!');
        return vectordbState.instance;
      } catch (error) {
        console.error('❌ Failed to initialize vector database:', error);
        return null;
      }
    })().finally(() => {
      vectordbState.initPromise = null;
    });
  }

  return await vectordbState.initPromise;
}

/**
 * Set the global vectordb instance
 */
export function setVectordbInstance(vectordb: Collection): void {
  vectordbState.instance = vectordb;
  vectordbState.initPromise = null;
}

/**
 * Update session activity time
 */
export function updateSessionActivity(sessionId: string): void {
  activeSessions.set(sessionId, Date.now());
}

/**
 * Check if a session exists
 */
export function sessionExists(sessionId: string): boolean {
  return activeSessions.has(sessionId);
}

/**
 * Remove sessions that have been inactive for longer than the timeout period
 */
export function cleanupExpiredSessions(): void {
  const currentTime = Date.now();
  if (currentTime - lastCleanupTime < CLEANUP_INTERVAL_MS) {
    return;
  }
  lastCleanupTime = currentTime;
  const expiredSessions: string[] = [];

  for (const [sessionId, lastActive] of activeSessions.entries()) {
    if (currentTime - lastActive > SESSION_TIMEOUT) {
      expiredSessions.push(sessionId);
    }
  }

  for (const sessionId of expiredSessions) {
    deleteSession(sessionId);
  }

  if (expiredSessions.length > 0) {
    console.log(`Cleaned up ${expiredSessions.length} expired sessions`);
  }
}

/**
 * Delete a specific session
 */
export function deleteSession(sessionId: string): void {
  activeSessions.delete(sessionId);
  clearChatHistory(sessionId);
}

/**
 * Alias for getVectordbInstance for backward compatibility
 */
export const getVectorDB = getVectordbInstance;
