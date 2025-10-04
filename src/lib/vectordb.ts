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

  // Initialize ChromaDB Cloud client
  const client = new CloudClient({
    apiKey: CHROMADB_API_KEY,
    tenant: CHROMADB_TENANT,
    database: CHROMADB_DATABASE
  });

  console.log('Connected to ChromaDB Cloud successfully!');

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
        name: collectionName
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
        // Clean metadata to only include primitive types
        const metadatas = batch.map(doc => {
          const cleaned: Record<string, string | number | boolean> = {};
          for (const [key, value] of Object.entries(doc.metadata)) {
            if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
              cleaned[key] = value;
            } else if (value !== null && value !== undefined) {
              // Convert complex types to string
              cleaned[key] = String(value);
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
