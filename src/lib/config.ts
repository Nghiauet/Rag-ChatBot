import path from 'path';

// Configuration constants
export const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
export const DOCS_FOLDER = path.join(process.cwd(), 'data', 'docs');
export const VECTOR_DB_PATH = path.join(process.cwd(), 'data', 'vector_db');
export const PROMPTS_FILE = path.join(process.cwd(), 'data', 'prompts.yaml');

// Environment variables
export const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || '';
export const MODEL = process.env.MODEL || 'models/gemini-flash-latest';
export const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'models/embedding-001';

// ChromaDB Cloud Configuration
export const CHROMADB_API_KEY = process.env.CHROMADB_API_KEY || '';
export const CHROMADB_TENANT = process.env.CHROMADB_TENANT || '';
export const CHROMADB_DATABASE = process.env.CHROMADB_DATABASE || '';

// Logging configuration
export const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
