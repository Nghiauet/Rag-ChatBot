import { Collection } from 'chromadb';
import { SESSION_TIMEOUT, DOCS_FOLDER } from './config';
import { clearChatHistory } from './chatbot';

// Track active sessions and their last activity time
const activeSessions = new Map<string, number>();

// Global vectordb instance
let vectordbInstance: Collection | null = null;
let isInitializing = false;

/**
 * Get the global vectordb instance, initializing it if necessary
 */
export async function getVectordbInstance(): Promise<Collection | null> {
  // If already initialized, return it
  if (vectordbInstance) {
    return vectordbInstance;
  }

  // If currently initializing, wait for it
  if (isInitializing) {
    // Wait up to 30 seconds for initialization
    for (let i = 0; i < 60; i++) {
      await new Promise(resolve => setTimeout(resolve, 500));
      if (vectordbInstance) {
        return vectordbInstance;
      }
    }
    return null;
  }

  // Start initialization
  isInitializing = true;
  console.log('🔄 Lazy-loading vector database...');

  try {
    const { getVectorstore } = await import('./vectordb');
    const fs = await import('fs/promises');

    // Ensure docs folder exists
    await fs.mkdir(DOCS_FOLDER, { recursive: true });

    // Get list of PDF files
    const allFiles = await fs.readdir(DOCS_FOLDER);
    const pdfFiles = allFiles.filter((file) => file.toLowerCase().endsWith('.pdf'));

    if (pdfFiles.length === 0) {
      console.warn('⚠️  No PDF documents found. Vector database cannot be initialized.');
      isInitializing = false;
      return null;
    }

    console.log(`📚 Found ${pdfFiles.length} PDF documents`);

    // Load existing vector database
    vectordbInstance = await getVectorstore(pdfFiles, false);
    console.log('✅ Vector database initialized successfully!');

    isInitializing = false;
    return vectordbInstance;
  } catch (error) {
    console.error('❌ Failed to initialize vector database:', error);
    isInitializing = false;
    return null;
  }
}

/**
 * Set the global vectordb instance
 */
export function setVectordbInstance(vectordb: Collection): void {
  vectordbInstance = vectordb;
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
  const expiredSessions: string[] = [];

  for (const [sessionId, lastActive] of activeSessions.entries()) {
    if (currentTime - lastActive > SESSION_TIMEOUT) {
      expiredSessions.push(sessionId);
      clearChatHistory(sessionId);
    }
  }

  for (const sessionId of expiredSessions) {
    activeSessions.delete(sessionId);
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
