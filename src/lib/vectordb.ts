import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { OpenAIEmbeddings } from '@langchain/openai';
import { CloudClient, Collection } from 'chromadb';
import { Document } from '@langchain/core/documents';
import * as path from 'path';
import {
  DOCS_FOLDER,
  OPENAI_API_KEY,
  OPENAI_EMBEDDING_BASE_URL,
  EMBEDDING_MODEL,
  CHROMADB_API_KEY,
  CHROMADB_TENANT,
  CHROMADB_DATABASE,
  CHUNK_SIZE,
  CHUNK_OVERLAP,
  CHUNK_SEPARATORS
} from './config';

/**
 * Job tracking for rebuild embeddings process
 */
export type RebuildJobStatus = 'processing' | 'completed' | 'error';

export interface RebuildJob {
  jobId: string;
  status: RebuildJobStatus;
  progress: {
    currentStep: string;
    percentage: number;
    totalPdfs: number;
    totalUrls: number;
    processedPdfs: number;
    processedUrls: number;
  };
  error?: string;
  startedAt: Date;
  completedAt?: Date;
}

// In-memory job tracking (for development; consider Redis for production)
const rebuildJobs = new Map<string, RebuildJob>();
const rebuildTrackerInstanceId = `${process.pid}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const rebuildTrackerLoadedAt = new Date().toISOString();

export interface RebuildJobsDebugInfo {
  trackerInstanceId: string;
  pid: number;
  loadedAt: string;
  totalJobs: number;
  recentJobIds: string[];
}

function getRecentJobIds(limit = 10): string[] {
  return Array.from(rebuildJobs.keys()).slice(-limit);
}

export function getRebuildJobsDebugInfo(limit = 10): RebuildJobsDebugInfo {
  return {
    trackerInstanceId: rebuildTrackerInstanceId,
    pid: process.pid,
    loadedAt: rebuildTrackerLoadedAt,
    totalJobs: rebuildJobs.size,
    recentJobIds: getRecentJobIds(limit),
  };
}

function logRebuildJobEvent(event: string, details: Record<string, unknown> = {}): void {
  console.log(`[rebuild-job] ${event}`, {
    ...getRebuildJobsDebugInfo(),
    ...details,
  });
}

logRebuildJobEvent('job tracker initialized');

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: OPENAI_API_KEY,
  modelName: EMBEDDING_MODEL,
  configuration: {
    baseURL: OPENAI_EMBEDDING_BASE_URL,
  },
});

const embeddingFunction = {
  generate: async (texts: string[]) => {
    if (texts.length === 0) return [];
    return embeddings.embedDocuments(texts);
  }
};

/**
 * Create a new rebuild job
 */
export function createRebuildJob(jobId: string, totalPdfs: number, totalUrls: number): RebuildJob {
  const job: RebuildJob = {
    jobId,
    status: 'processing',
    progress: {
      currentStep: 'Initializing rebuild process',
      percentage: 0,
      totalPdfs,
      totalUrls,
      processedPdfs: 0,
      processedUrls: 0,
    },
    startedAt: new Date(),
  };
  rebuildJobs.set(jobId, job);
  logRebuildJobEvent('job created', { jobId, totalPdfs, totalUrls });
  return job;
}

/**
 * Update rebuild job progress
 */
export function updateRebuildJob(
  jobId: string,
  updates: {
    status?: RebuildJobStatus;
    progress?: Partial<RebuildJob['progress']>;
    error?: string;
    completedAt?: Date;
  }
): void {
  const job = rebuildJobs.get(jobId);
  if (!job) {
    console.warn(`[rebuild-job] update skipped; job not found`, {
      ...getRebuildJobsDebugInfo(),
      jobId,
      updates,
    });
    return;
  }

  if (updates.progress) {
    job.progress = { ...job.progress, ...updates.progress };
  }
  if (updates.status) {
    job.status = updates.status;
  }
  if (updates.error !== undefined) {
    job.error = updates.error;
  }
  if (updates.completedAt) {
    job.completedAt = updates.completedAt;
  }

  rebuildJobs.set(jobId, job);
  logRebuildJobEvent('job updated', {
    jobId,
    status: job.status,
    percentage: job.progress.percentage,
    currentStep: job.progress.currentStep,
    hasError: Boolean(job.error),
    completedAt: job.completedAt?.toISOString(),
  });
}

/**
 * Get rebuild job status
 */
export function getRebuildJob(jobId: string): RebuildJob | undefined {
  const job = rebuildJobs.get(jobId);
  if (!job) {
    console.warn('[rebuild-job] get failed; job not found', {
      ...getRebuildJobsDebugInfo(),
      requestedJobId: jobId,
    });
  } else {
    console.log('[rebuild-job] get success', {
      ...getRebuildJobsDebugInfo(),
      requestedJobId: jobId,
      status: job.status,
      percentage: job.progress.percentage,
      currentStep: job.progress.currentStep,
    });
  }
  return job;
}

/**
 * Clean up old completed/errored jobs (older than 1 hour)
 */
export function cleanupOldJobs(): void {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  let removed = 0;
  for (const [jobId, job] of rebuildJobs.entries()) {
    if ((job.status === 'completed' || job.status === 'error') && job.completedAt && job.completedAt < oneHourAgo) {
      rebuildJobs.delete(jobId);
      removed++;
    }
  }

  logRebuildJobEvent('cleanup completed', { removed, cutoff: oneHourAgo.toISOString() });
}

/**
 * Extract text from PDF documents
 * @param pdfs - List of PDF filenames
 * @returns Promise<Document[]> - List of extracted documents
 */
async function extractPdfText(pdfs: string[]): Promise<Document[]> {
  console.log(`Starting PDF text extraction for ${pdfs.length} documents`);
  const docs: Document[] = [];

  for (const pdf of pdfs) {
    const pdfPath = path.join(DOCS_FOLDER, pdf);
    console.log(`Extracting text from: ${pdf}`);

    try {
      const loader = new PDFLoader(pdfPath);
      const loadedDocs = await loader.load();
      docs.push(...loadedDocs);
      console.log(`Successfully extracted ${loadedDocs.length} pages from ${pdf}`);
    } catch (error) {
      console.error(`Failed to extract text from ${pdf}:`, error);
      throw error;
    }
  }

  console.log(`PDF text extraction completed. Total documents: ${docs.length}`);
  return docs;
}

/**
 * Split text into chunks with improved semantic boundaries
 * @param docs - List of text documents
 * @param filename - Optional filename for enhanced metadata
 * @returns Promise<Document[]> - List of text chunks with enhanced metadata
 */
async function getTextChunks(docs: Document[], filename?: string): Promise<Document[]> {
  console.log(`Starting text chunking for ${docs.length} documents`);

  // Use configurable chunk size for better semantic coherence
  // Default: 1500 characters with 200 character overlap (~13% overlap)
  // This is smaller than the previous 8000 to maintain better semantic boundaries
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    separators: CHUNK_SEPARATORS,
  });

  const chunks = await textSplitter.splitDocuments(docs);

  // Enhance chunks with additional metadata
  chunks.forEach((chunk, index) => {
    chunk.metadata = {
      ...chunk.metadata,
      chunkIndex: index,
      totalChunks: chunks.length,
      chunkSize: chunk.pageContent.length,
    };

    // Add filename to metadata if provided
    if (filename) {
      chunk.metadata.filename = filename;
    }
  });

  console.log(`Text chunking completed. Created ${chunks.length} chunks from ${docs.length} documents`);
  console.log(`Chunk configuration: size=${CHUNK_SIZE}, overlap=${CHUNK_OVERLAP}`);

  return chunks;
}

/**
 * Create or retrieve a vectorstore from PDF documents with error handling
 * @param pdfs - List of PDF filenames
 * @param rebuild - If true, force rebuild the vector database. If false, load existing if available
 * @param maxRetries - Maximum number of retries for embedding failures
 * @param retryDelay - Delay in seconds between retries
 * @returns Promise<Collection> - The created or retrieved collection
 * @throws Error if embedding creation fails after all retries
 */
export async function getVectorstore(
  pdfs: string[],
  rebuild = false,
  maxRetries = 3,
  retryDelay = 5
): Promise<Collection> {
  console.log(`Creating vectorstore for ${pdfs.length} PDFs (rebuild=${rebuild})`);

  // Initialize ChromaDB Cloud client with validation
  const client = await createChromaDBClient();

  const collectionName = 'health_docs';
  let collection: Collection;

  // Try to load existing collection if not rebuilding
  if (!rebuild) {
    console.log('Attempting to load existing collection from ChromaDB Cloud...');
    try {
      collection = await client.getCollection({
        name: collectionName,
        embeddingFunction
      });
      console.log('Successfully loaded existing vector database');
      return collection;
    } catch (error) {
      console.warn('Failed to load existing vector database:', error);
      console.log('Will attempt to create new vector database');
    }
  } else {
    // Delete existing collection if rebuilding
    try {
      await client.deleteCollection({ name: collectionName });
      console.log('Deleted existing collection for rebuild');
    } catch {
      console.log('No existing collection to delete');
    }
  }

  // Create new vector database
  console.log('Creating new vector database from documents...');
  const docs = await extractPdfText(pdfs);
  const chunks = await getTextChunks(docs);

  console.log(`Starting embedding creation with ${chunks.length} chunks (maxRetries=${maxRetries})`);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      console.log(`Embedding attempt ${attempt + 1}/${maxRetries}`);

      // Delete collection if it exists (cleanup from previous failed attempts)
      if (attempt > 0) {
        try {
          await client.deleteCollection({ name: collectionName });
          console.log('Deleted collection from previous failed attempt');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for deletion to propagate
        } catch {
          console.log('No collection to delete');
        }
      }

      // Create collection with embedding function
      collection = await client.createCollection({
        name: collectionName,
        metadata: { description: 'Women\'s Health Documents Vector Store' },
        embeddingFunction
      });

      console.log(`Created collection '${collectionName}'`);

      // Add documents to collection in batches to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);
        const ids = batch.map((_, idx) => `doc_${i + idx}`);
        const documents = batch.map(doc => doc.pageContent);
        // Clean metadata to only include primitive types and flatten nested structures
        const metadatas = batch.map(doc => {
          const cleaned: Record<string, string | number | boolean> = {};

          // Extract source path
          if (doc.metadata.source && typeof doc.metadata.source === 'string') {
            cleaned.source = doc.metadata.source;
          }

          // Extract page number from nested loc object
          if (doc.metadata.loc && typeof doc.metadata.loc === 'object' && 'pageNumber' in doc.metadata.loc) {
            cleaned.page = doc.metadata.loc.pageNumber as number;
          }

          // Handle other primitive metadata fields
          for (const [key, value] of Object.entries(doc.metadata)) {
            // Skip already processed fields and complex objects
            if (key === 'source' || key === 'loc' || key === 'pdf') {
              continue;
            }

            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              cleaned[key] = value;
            }
          }

          return cleaned;
        });

        await collection.add({
          ids,
          documents,
          metadatas
        });

        console.log(`Added batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);

        // Small delay between batches to avoid rate limiting
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const count = await collection.count();
      console.log(`Successfully created vector database with ${count} documents on attempt ${attempt + 1}`);
      return collection;
    } catch (error) {
      if (attempt < maxRetries - 1) {
        const waitTime = retryDelay * Math.pow(2, attempt) * 1000; // Exponential backoff
        console.warn(
          `Embedding attempt ${attempt + 1} failed: ${error}. Retrying in ${waitTime / 1000} seconds...`
        );
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      } else {
        console.error(`Failed to create embeddings after ${maxRetries} attempts:`, error);
        throw new Error(`Failed to create embeddings after ${maxRetries} attempts: ${error}`);
      }
    }
  }

  throw new Error('Failed to create vectorstore');
}

/**
 * Validate ChromaDB Cloud credentials
 * @throws Error if credentials are missing
 */
function validateChromaDBCredentials(): void {
  const missing: string[] = [];

  if (!CHROMADB_API_KEY) missing.push('CHROMADB_API_KEY');
  if (!CHROMADB_TENANT) missing.push('CHROMADB_TENANT');
  if (!CHROMADB_DATABASE) missing.push('CHROMADB_DATABASE');

  if (missing.length > 0) {
    throw new Error(
      `Missing ChromaDB Cloud credentials: ${missing.join(', ')}. ` +
      `Please check your .env file and ensure these variables are set.`
    );
  }
}

/**
 * Create ChromaDB Cloud client with validation and error handling
 * @returns CloudClient instance
 * @throws Error if credentials are invalid or connection fails
 */
async function createChromaDBClient(): Promise<CloudClient> {
  // Validate credentials first
  validateChromaDBCredentials();

  console.log('Creating ChromaDB Cloud client...');
  console.log(`Tenant: ${CHROMADB_TENANT}, Database: ${CHROMADB_DATABASE}`);

  try {
    const client = new CloudClient({
      apiKey: CHROMADB_API_KEY,
      tenant: CHROMADB_TENANT,
      database: CHROMADB_DATABASE
    });

    // Test the connection without requiring embedding function config
    try {
      await client.countCollections();
      console.log('✅ Successfully connected to ChromaDB Cloud!');
    } catch (error) {
      console.error('❌ Failed to connect to ChromaDB Cloud:', error);
      throw new Error(
        `Failed to connect to ChromaDB Cloud. Please verify:\n` +
        `1. Your ChromaDB Cloud credentials are correct\n` +
        `2. Your network can reach ChromaDB Cloud service\n` +
        `3. ChromaDB Cloud service is operational\n` +
        `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return client;
  } catch (error) {
    if (error instanceof Error && error.message.includes('Failed to connect')) {
      throw error;
    }
    throw new Error(`ChromaDB Cloud initialization failed: ${error}`);
  }
}

/**
 * Get or create an empty collection (when no PDFs exist)
 * This is used when only URL documents are being indexed
 * @returns Promise<Collection> - The existing or newly created collection
 */
export async function getOrCreateEmptyCollection(): Promise<Collection> {
  console.log('Getting or creating empty collection for URL documents');

  // Initialize ChromaDB Cloud client with validation
  const client = await createChromaDBClient();

  const collectionName = 'health_docs';

  // Try to load existing collection
  try {
    const collection = await client.getCollection({
      name: collectionName,
      embeddingFunction
    });
    const count = await collection.count();
    console.log(`Loaded existing collection with ${count} documents`);
    return collection;
  } catch {
    console.log('No existing collection found, creating empty one...');
  }

  // Create new empty collection
  try {
    const collection = await client.createCollection({
      name: collectionName,
      metadata: { description: 'Women\'s Health Documents Vector Store' },
      embeddingFunction
    });

    console.log(`Created empty collection '${collectionName}'`);
    return collection;
  } catch (error) {
    console.error('Failed to create empty collection:', error);
    throw new Error(`Failed to create empty collection: ${error}`);
  }
}

/**
 * Add URL documents to existing collection with retry logic
 * @param collection - ChromaDB collection
 * @param documents - LangChain documents with URL metadata
 * @param url - Source URL for cleanup on error
 * @param maxRetries - Maximum number of retries for transient failures
 * @returns Promise<void>
 */
export async function addUrlDocuments(
  collection: Collection,
  documents: Document[],
  url: string,
  maxRetries = 3
): Promise<void> {
  console.log(`Adding ${documents.length} URL documents to collection`);

  const batchSize = 10;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const currentCount = await collection.count();

      for (let i = 0; i < documents.length; i += batchSize) {
        const batch = documents.slice(i, i + batchSize);
        const ids = batch.map((_, idx) => `url_${url}_${currentCount + i + idx}`);
        const docs = batch.map(doc => doc.pageContent);

        // Clean metadata to only include primitive types
        const metadatas = batch.map(doc => {
          const cleaned: Record<string, string | number | boolean> = {};

          // URL metadata
          if (doc.metadata.source && typeof doc.metadata.source === 'string') {
            cleaned.source = doc.metadata.source; // This will be the URL
          }

          if (doc.metadata.title && typeof doc.metadata.title === 'string') {
            cleaned.title = doc.metadata.title;
          }

          if (doc.metadata.type && typeof doc.metadata.type === 'string') {
            cleaned.type = doc.metadata.type; // 'html_url' or 'pdf_url'
          }

          // For PDF URLs, include page number
          if (doc.metadata.page && typeof doc.metadata.page === 'number') {
            cleaned.page = doc.metadata.page;
          }

          // For HTML URLs, include section if available
          if (doc.metadata.section && typeof doc.metadata.section === 'string') {
            cleaned.section = doc.metadata.section;
          }

          if (doc.metadata.sectionIndex !== undefined && typeof doc.metadata.sectionIndex === 'number') {
            cleaned.sectionIndex = doc.metadata.sectionIndex;
          }

          return cleaned;
        });

        // Retry individual batch operations
        let batchSuccess = false;
        for (let batchAttempt = 0; batchAttempt < 3; batchAttempt++) {
          try {
            await collection.add({
              ids,
              documents: docs,
              metadatas
            });
            batchSuccess = true;
            break;
          } catch (batchError) {
            if (batchAttempt < 2) {
              console.warn(`Batch ${Math.floor(i / batchSize) + 1} failed, retrying... (${batchAttempt + 1}/3)`);
              await new Promise(resolve => setTimeout(resolve, 1000 * (batchAttempt + 1)));
            } else {
              throw batchError;
            }
          }
        }

        if (!batchSuccess) {
          throw new Error(`Failed to add batch ${Math.floor(i / batchSize) + 1} after 3 attempts`);
        }

        console.log(`Added URL batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(documents.length / batchSize)}`);

        // Small delay between batches
        if (i + batchSize < documents.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const finalCount = await collection.count();
      console.log(`Successfully added URL documents. Total collection size: ${finalCount}`);
      return; // Success, exit the retry loop
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (isLastAttempt) {
        console.error(`Error adding URL documents after ${maxRetries} attempts:`, error);
        throw new Error(
          `Failed to add URL documents after ${maxRetries} attempts. ` +
          `This may indicate:\n` +
          `1. ChromaDB Cloud connection issues\n` +
          `2. Invalid or expired credentials\n` +
          `3. Network connectivity problems\n` +
          `Original error: ${errorMessage}`
        );
      } else {
        const retryDelay = 2000 * Math.pow(2, attempt); // Exponential backoff
        console.warn(
          `Attempt ${attempt + 1}/${maxRetries} failed: ${errorMessage}. ` +
          `Retrying in ${retryDelay / 1000} seconds...`
        );
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }
}

/**
 * Remove all documents associated with a specific URL
 * @param collection - ChromaDB collection
 * @param url - URL to remove documents for
 * @returns Promise<number> - Number of documents removed
 */
export async function removeUrlDocuments(
  collection: Collection,
  url: string
): Promise<number> {
  console.log(`Removing documents for URL: ${url}`);

  try {
    // Query all documents with this URL as source
    const results = await collection.get({
      where: { source: url }
    });

    if (!results.ids || results.ids.length === 0) {
      console.log(`No documents found for URL: ${url}`);
      return 0;
    }

    // Delete all matching documents
    await collection.delete({
      ids: results.ids
    });

    console.log(`Successfully removed ${results.ids.length} documents for URL: ${url}`);
    return results.ids.length;
  } catch (error) {
    console.error(`Error removing URL documents:`, error);
    throw new Error(`Failed to remove URL documents: ${error}`);
  }
}

/**
 * Remove all documents associated with a specific PDF filename
 * @param collection - ChromaDB collection
 * @param filename - PDF filename (e.g., "document.pdf")
 * @returns Promise<number> - Number of documents removed
 */
export async function removePdfDocument(
  collection: Collection,
  filename: string
): Promise<number> {
  console.log(`Removing documents for PDF: ${filename}`);

  try {
    // Extract just the filename without path for matching
    const baseFilename = path.basename(filename);

    // Query all documents with this filename in metadata
    // We need to search by filename metadata field
    const results = await collection.get({
      where: { filename: baseFilename }
    });

    if (!results.ids || results.ids.length === 0) {
      console.log(`No documents found for PDF: ${filename}`);
      return 0;
    }

    // Delete all matching documents
    await collection.delete({
      ids: results.ids
    });

    console.log(`Successfully removed ${results.ids.length} documents for PDF: ${filename}`);
    return results.ids.length;
  } catch (error) {
    console.error(`Error removing PDF documents:`, error);
    throw new Error(`Failed to remove PDF documents: ${error}`);
  }
}

/**
 * Add a single PDF document to existing collection with incremental indexing
 * @param collection - ChromaDB collection
 * @param filename - PDF filename (e.g., "document.pdf")
 * @param maxRetries - Maximum number of retries for transient failures
 * @returns Promise<number> - Number of chunks added
 */
export async function addPdfDocument(
  collection: Collection,
  filename: string,
  maxRetries = 3
): Promise<number> {
  console.log(`Adding PDF document: ${filename}`);

  const batchSize = 10;
  const baseFilename = path.basename(filename);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Extract text from the single PDF
      const pdfPath = path.join(DOCS_FOLDER, baseFilename);
      console.log(`Extracting text from: ${pdfPath}`);

      const loader = new PDFLoader(pdfPath);
      const docs = await loader.load();
      console.log(`Successfully extracted ${docs.length} pages from ${baseFilename}`);

      // Chunk the documents with filename in metadata
      const chunks = await getTextChunks(docs, baseFilename);
      console.log(`Created ${chunks.length} chunks from ${baseFilename}`);

      // Add chunks to collection in batches
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize);

        // Use filename-based IDs: pdf_{filename}_{chunkIndex}
        const sanitizedFilename = baseFilename.replace(/[^a-zA-Z0-9]/g, '_');
        const ids = batch.map((_, idx) => `pdf_${sanitizedFilename}_${i + idx}`);
        const documents = batch.map(doc => doc.pageContent);

        // Clean metadata for ChromaDB
        const metadatas = batch.map(doc => {
          const cleaned: Record<string, string | number | boolean> = {};

          // Add filename for tracking
          cleaned.filename = baseFilename;

          // Add source path
          if (doc.metadata.source && typeof doc.metadata.source === 'string') {
            cleaned.source = doc.metadata.source;
          }

          // Extract page number
          if (doc.metadata.loc && typeof doc.metadata.loc === 'object' && 'pageNumber' in doc.metadata.loc) {
            cleaned.page = doc.metadata.loc.pageNumber as number;
          }

          // Add chunk metadata
          if (doc.metadata.chunkIndex !== undefined) {
            cleaned.chunkIndex = doc.metadata.chunkIndex as number;
          }
          if (doc.metadata.totalChunks !== undefined) {
            cleaned.totalChunks = doc.metadata.totalChunks as number;
          }
          if (doc.metadata.chunkSize !== undefined) {
            cleaned.chunkSize = doc.metadata.chunkSize as number;
          }

          // Handle other primitive metadata fields
          for (const [key, value] of Object.entries(doc.metadata)) {
            if (key === 'source' || key === 'loc' || key === 'pdf' || key === 'filename' ||
              key === 'chunkIndex' || key === 'totalChunks' || key === 'chunkSize') {
              continue;
            }

            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              cleaned[key] = value;
            }
          }

          return cleaned;
        });

        // Retry individual batch operations
        let batchSuccess = false;
        for (let batchAttempt = 0; batchAttempt < 3; batchAttempt++) {
          try {
            await collection.add({
              ids,
              documents,
              metadatas
            });
            batchSuccess = true;
            break;
          } catch (batchError) {
            if (batchAttempt < 2) {
              console.warn(`Batch ${Math.floor(i / batchSize) + 1} failed, retrying... (${batchAttempt + 1}/3)`);
              await new Promise(resolve => setTimeout(resolve, 1000 * (batchAttempt + 1)));
            } else {
              throw batchError;
            }
          }
        }

        if (!batchSuccess) {
          throw new Error(`Failed to add batch ${Math.floor(i / batchSize) + 1} after 3 attempts`);
        }

        console.log(`Added PDF batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(chunks.length / batchSize)}`);

        // Small delay between batches
        if (i + batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      const finalCount = await collection.count();
      console.log(`Successfully added ${chunks.length} chunks from ${baseFilename}. Total collection size: ${finalCount}`);
      return chunks.length;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (isLastAttempt) {
        console.error(`Error adding PDF document after ${maxRetries} attempts:`, error);
        throw new Error(
          `Failed to add PDF document after ${maxRetries} attempts. ` +
          `Original error: ${errorMessage}`
        );
      } else {
        const retryDelay = 2000 * Math.pow(2, attempt); // Exponential backoff
        console.warn(
          `Attempt ${attempt + 1}/${maxRetries} failed: ${errorMessage}. ` +
          `Retrying in ${retryDelay / 1000} seconds...`
        );
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  throw new Error('Failed to add PDF document');
}

/**
 * Get collection instance (for use in API routes)
 * @param rebuild - If true, rebuild the entire collection from PDFs and URLs
 * @returns Promise<Collection>
 */
export async function getCollection(rebuild = false): Promise<Collection> {
  // Get list of PDFs
  const fs = await import('fs/promises');
  const pdfFiles = await fs.readdir(DOCS_FOLDER);
  const pdfs = pdfFiles.filter(file => file.toLowerCase().endsWith('.pdf'));

  return await getVectorstore(pdfs, rebuild);
}

/**
 * Rebuild embeddings for ALL documents (PDFs + URLs)
 * This is the centralized function for creating all embeddings
 * @param pdfFiles - List of PDF filenames from disk
 * @param urlDocuments - List of URL documents with fetched content
 * @param jobId - Optional job ID for progress tracking
 * @returns Promise<Collection> - The rebuilt collection
 */
export async function rebuildAllEmbeddings(
  pdfFiles: string[],
  urlDocuments: Array<{
    id: string;
    url: string;
    title: string;
    fetchedDocuments?: Array<{
      pageContent: string;
      metadata: Record<string, string | number | boolean>;
    }>;
  }>,
  jobId?: string
): Promise<Collection> {
  try {
    console.log(`Rebuilding embeddings for ${pdfFiles.length} PDFs and ${urlDocuments.length} URLs`);

    // Update progress: Initializing
    if (jobId) {
      updateRebuildJob(jobId, {
        progress: {
          currentStep: 'Initializing database connection',
          percentage: 5,
        }
      });
    }

    // Initialize ChromaDB Cloud client with validation
    const client = await createChromaDBClient();

    const collectionName = 'health_docs';

    // Update progress: Deleting old collection
    if (jobId) {
      updateRebuildJob(jobId, {
        progress: {
          currentStep: 'Deleting existing collection',
          percentage: 10,
        }
      });
    }

    // Delete existing collection for fresh rebuild
    try {
      await client.deleteCollection({ name: collectionName });
      console.log('Deleted existing collection for rebuild');
    } catch {
      console.log('No existing collection to delete');
    }

    // Update progress: Creating new collection
    if (jobId) {
      updateRebuildJob(jobId, {
        progress: {
          currentStep: 'Creating new collection',
          percentage: 15,
        }
      });
    }

    // Create new collection with embedding function
    const collection = await client.createCollection({
      name: collectionName,
      metadata: { description: 'Women\'s Health Documents Vector Store' },
      embeddingFunction
    });

    console.log(`Created collection '${collectionName}'`);

    // Step 1: Process PDF documents
    if (pdfFiles.length > 0) {
      console.log(`Processing ${pdfFiles.length} PDF files...`);

      if (jobId) {
        updateRebuildJob(jobId, {
          progress: {
            currentStep: `Extracting text from ${pdfFiles.length} PDF files`,
            percentage: 20,
          }
        });
      }

      // Process each PDF file separately to maintain filename in metadata
      let totalPdfChunksAdded = 0;
      const batchSize = 10;

      for (let pdfIdx = 0; pdfIdx < pdfFiles.length; pdfIdx++) {
        const pdfFile = pdfFiles[pdfIdx];
        const baseFilename = path.basename(pdfFile);
        console.log(`Processing PDF ${pdfIdx + 1}/${pdfFiles.length}: ${baseFilename}`);

        // Extract text from this PDF
        const pdfPath = path.join(DOCS_FOLDER, pdfFile);
        const loader = new PDFLoader(pdfPath);
        const docs = await loader.load();

        // Chunk with filename in metadata
        const chunks = await getTextChunks(docs, baseFilename);
        console.log(`Created ${chunks.length} chunks from ${baseFilename}`);

        // Add chunks to collection in batches
        const totalBatches = Math.ceil(chunks.length / batchSize);

        for (let i = 0; i < chunks.length; i += batchSize) {
          const batch = chunks.slice(i, i + batchSize);

          // Use filename-based IDs: pdf_{filename}_{chunkIndex}
          const sanitizedFilename = baseFilename.replace(/[^a-zA-Z0-9]/g, '_');
          const ids = batch.map((_, idx) => `pdf_${sanitizedFilename}_${i + idx}`);
          const documents = batch.map(doc => doc.pageContent);

          // Clean metadata for PDFs
          const metadatas = batch.map(doc => {
            const cleaned: Record<string, string | number | boolean> = {};

            // Add filename for tracking
            cleaned.filename = baseFilename;

            if (doc.metadata.source && typeof doc.metadata.source === 'string') {
              cleaned.source = doc.metadata.source;
            }

            if (doc.metadata.loc && typeof doc.metadata.loc === 'object' && 'pageNumber' in doc.metadata.loc) {
              cleaned.page = doc.metadata.loc.pageNumber as number;
            }

            // Add chunk metadata
            if (doc.metadata.chunkIndex !== undefined) {
              cleaned.chunkIndex = doc.metadata.chunkIndex as number;
            }
            if (doc.metadata.totalChunks !== undefined) {
              cleaned.totalChunks = doc.metadata.totalChunks as number;
            }
            if (doc.metadata.chunkSize !== undefined) {
              cleaned.chunkSize = doc.metadata.chunkSize as number;
            }

            for (const [key, value] of Object.entries(doc.metadata)) {
              if (key === 'source' || key === 'loc' || key === 'pdf' || key === 'filename' ||
                key === 'chunkIndex' || key === 'totalChunks' || key === 'chunkSize') {
                continue;
              }

              if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                cleaned[key] = value;
              }
            }

            return cleaned;
          });

          await collection.add({
            ids,
            documents,
            metadatas
          });

          const currentBatch = Math.floor(i / batchSize) + 1;
          console.log(`  Added batch ${currentBatch}/${totalBatches} for ${baseFilename}`);

          totalPdfChunksAdded += batch.length;

          // Small delay between batches
          if (i + batchSize < chunks.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        // Update progress for each PDF (20% to 60%)
        if (jobId) {
          const pdfProgress = 20 + Math.floor(((pdfIdx + 1) / pdfFiles.length) * 40);
          updateRebuildJob(jobId, {
            progress: {
              currentStep: `Processing PDFs: ${pdfIdx + 1}/${pdfFiles.length} files`,
              percentage: pdfProgress,
              processedPdfs: pdfIdx + 1,
            }
          });
        }
      }

      console.log(`Successfully added ${totalPdfChunksAdded} PDF chunks from ${pdfFiles.length} files`);
    }

    // Step 2: Process URL documents
    const urlDocsToIndex = urlDocuments.filter(url => url.fetchedDocuments && url.fetchedDocuments.length > 0);

    if (urlDocsToIndex.length > 0) {
      console.log(`Processing ${urlDocsToIndex.length} URL documents...`);

      if (jobId) {
        updateRebuildJob(jobId, {
          progress: {
            currentStep: `Processing ${urlDocsToIndex.length} URL documents`,
            percentage: 60,
          }
        });
      }

      let totalUrlChunks = 0;
      const batchSize = 10;
      let processedUrls = 0;

      for (const urlDoc of urlDocsToIndex) {
        if (!urlDoc.fetchedDocuments) continue;

        console.log(`Adding ${urlDoc.fetchedDocuments.length} chunks from ${urlDoc.url}...`);

        // Add URL documents in batches
        for (let i = 0; i < urlDoc.fetchedDocuments.length; i += batchSize) {
          const batch = urlDoc.fetchedDocuments.slice(i, i + batchSize);
          const ids = batch.map((_, idx) => `url_${urlDoc.id}_${i + idx}`);
          const documents = batch.map(doc => doc.pageContent);

          // Clean metadata to only include primitive types
          const metadatas = batch.map(doc => {
            const cleaned: Record<string, string | number | boolean> = {};

            // Only include primitive types from metadata
            for (const [key, value] of Object.entries(doc.metadata)) {
              if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
                cleaned[key] = value;
              }
            }

            return cleaned;
          });

          await collection.add({
            ids,
            documents,
            metadatas
          });

          totalUrlChunks += batch.length;

          // Small delay between batches
          if (i + batchSize < urlDoc.fetchedDocuments.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        processedUrls++;
        console.log(`Added ${urlDoc.fetchedDocuments.length} chunks from ${urlDoc.url}`);

        // Update progress for URLs (60% to 90%)
        if (jobId) {
          const urlProgress = 60 + Math.floor((processedUrls / urlDocsToIndex.length) * 30);
          updateRebuildJob(jobId, {
            progress: {
              currentStep: `Processing URLs: ${processedUrls}/${urlDocsToIndex.length}`,
              percentage: urlProgress,
              processedUrls,
            }
          });
        }
      }

      console.log(`Successfully added ${totalUrlChunks} URL chunks from ${urlDocsToIndex.length} URLs`);
    }

    if (jobId) {
      updateRebuildJob(jobId, {
        progress: {
          currentStep: 'Finalizing embeddings',
          percentage: 95,
        }
      });
    }

    const finalCount = await collection.count();
    console.log(`✅ Successfully rebuilt embeddings! Total documents in collection: ${finalCount}`);

    // Mark job as completed
    if (jobId) {
      updateRebuildJob(jobId, {
        status: 'completed',
        progress: {
          currentStep: 'Completed successfully',
          percentage: 100,
        },
        completedAt: new Date(),
      });
    }

    return collection;
  } catch (error) {
    console.error('Error during embedding rebuild:', error);

    // Mark job as failed
    if (jobId) {
      updateRebuildJob(jobId, {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        completedAt: new Date(),
      });
    }

    throw error;
  }
}
