import { PDFLoader } from '@langchain/community/document_loaders/fs/pdf';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai';
import { CloudClient, Collection } from 'chromadb';
import { Document } from '@langchain/core/documents';
import * as path from 'path';
import {
  DOCS_FOLDER,
  GOOGLE_API_KEY,
  EMBEDDING_MODEL,
  CHROMADB_API_KEY,
  CHROMADB_TENANT,
  CHROMADB_DATABASE
} from './config';

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
 * Split text into chunks
 * @param docs - List of text documents
 * @returns Promise<Document[]> - List of text chunks
 */
async function getTextChunks(docs: Document[]): Promise<Document[]> {
  console.log(`Starting text chunking for ${docs.length} documents`);

  // Chunk size is configured to be an approximation to the model limit of 2048 tokens
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 8000,
    chunkOverlap: 800,
    separators: ['\n\n', '\n', ' ', ''],
  });

  const chunks = await textSplitter.splitDocuments(docs);
  console.log(`Text chunking completed. Created ${chunks.length} chunks from ${docs.length} documents`);

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

  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: GOOGLE_API_KEY,
    modelName: EMBEDDING_MODEL,
  });

  const collectionName = 'health_docs';
  let collection: Collection;

  // Try to load existing collection if not rebuilding
  if (!rebuild) {
    console.log('Attempting to load existing collection from ChromaDB Cloud...');
    try {
      collection = await client.getCollection({
        name: collectionName,
        embeddingFunction: {
          generate: async (texts: string[]) => {
            const embedResults = await Promise.all(
              texts.map(text => embeddings.embedQuery(text))
            );
            return embedResults;
          }
        }
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
        embeddingFunction: {
          generate: async (texts: string[]) => {
            const embedResults = await Promise.all(
              texts.map(text => embeddings.embedQuery(text))
            );
            return embedResults;
          }
        }
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

    // Test the connection by trying to list collections
    try {
      await client.listCollections();
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

  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: GOOGLE_API_KEY,
    modelName: EMBEDDING_MODEL,
  });

  const collectionName = 'health_docs';

  // Try to load existing collection
  try {
    const collection = await client.getCollection({
      name: collectionName,
      embeddingFunction: {
        generate: async (texts: string[]) => {
          const embedResults = await Promise.all(
            texts.map(text => embeddings.embedQuery(text))
          );
          return embedResults;
        }
      }
    });
    const count = await collection.count();
    console.log(`Loaded existing collection with ${count} documents`);
    return collection;
  } catch (error) {
    console.log('No existing collection found, creating empty one...');
  }

  // Create new empty collection
  try {
    const collection = await client.createCollection({
      name: collectionName,
      metadata: { description: 'Women\'s Health Documents Vector Store' },
      embeddingFunction: {
        generate: async (texts: string[]) => {
          const embedResults = await Promise.all(
            texts.map(text => embeddings.embedQuery(text))
          );
          return embedResults;
        }
      }
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
  }>
): Promise<Collection> {
  console.log(`Rebuilding embeddings for ${pdfFiles.length} PDFs and ${urlDocuments.length} URLs`);

  // Initialize ChromaDB Cloud client with validation
  const client = await createChromaDBClient();

  const embeddings = new GoogleGenerativeAIEmbeddings({
    apiKey: GOOGLE_API_KEY,
    modelName: EMBEDDING_MODEL,
  });

  const collectionName = 'health_docs';

  // Delete existing collection for fresh rebuild
  try {
    await client.deleteCollection({ name: collectionName });
    console.log('Deleted existing collection for rebuild');
  } catch {
    console.log('No existing collection to delete');
  }

  // Create new collection with embedding function
  const collection = await client.createCollection({
    name: collectionName,
    metadata: { description: 'Women\'s Health Documents Vector Store' },
    embeddingFunction: {
      generate: async (texts: string[]) => {
        const embedResults = await Promise.all(
          texts.map(text => embeddings.embedQuery(text))
        );
        return embedResults;
      }
    }
  });

  console.log(`Created collection '${collectionName}'`);

  // Step 1: Process PDF documents
  if (pdfFiles.length > 0) {
    console.log(`Processing ${pdfFiles.length} PDF files...`);
    const pdfDocs = await extractPdfText(pdfFiles);
    const pdfChunks = await getTextChunks(pdfDocs);

    console.log(`Adding ${pdfChunks.length} PDF chunks to collection...`);

    // Add PDF documents in batches
    const batchSize = 10;
    for (let i = 0; i < pdfChunks.length; i += batchSize) {
      const batch = pdfChunks.slice(i, i + batchSize);
      const ids = batch.map((_, idx) => `doc_${i + idx}`);
      const documents = batch.map(doc => doc.pageContent);

      // Clean metadata for PDFs
      const metadatas = batch.map(doc => {
        const cleaned: Record<string, string | number | boolean> = {};

        if (doc.metadata.source && typeof doc.metadata.source === 'string') {
          cleaned.source = doc.metadata.source;
        }

        if (doc.metadata.loc && typeof doc.metadata.loc === 'object' && 'pageNumber' in doc.metadata.loc) {
          cleaned.page = doc.metadata.loc.pageNumber as number;
        }

        for (const [key, value] of Object.entries(doc.metadata)) {
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

      console.log(`Added PDF batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(pdfChunks.length / batchSize)}`);

      // Small delay between batches
      if (i + batchSize < pdfChunks.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log(`Successfully added ${pdfChunks.length} PDF chunks`);
  }

  // Step 2: Process URL documents
  const urlDocsToIndex = urlDocuments.filter(url => url.fetchedDocuments && url.fetchedDocuments.length > 0);

  if (urlDocsToIndex.length > 0) {
    console.log(`Processing ${urlDocsToIndex.length} URL documents...`);

    let totalUrlChunks = 0;
    const batchSize = 10;

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

      console.log(`Added ${urlDoc.fetchedDocuments.length} chunks from ${urlDoc.url}`);
    }

    console.log(`Successfully added ${totalUrlChunks} URL chunks from ${urlDocsToIndex.length} URLs`);
  }

  const finalCount = await collection.count();
  console.log(`✅ Successfully rebuilt embeddings! Total documents in collection: ${finalCount}`);

  return collection;
}

