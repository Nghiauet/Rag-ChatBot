import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DOCS_FOLDER } from '@/lib/config';
import { rebuildAllEmbeddings } from '@/lib/vectordb';
import { setVectordbInstance } from '@/lib/sessionManager';
import { UrlDocument } from '@/lib/types';

const URLS_FILE = path.join(process.cwd(), 'data', 'urls.json');

/**
 * Read URL documents from storage
 */
async function readUrls(): Promise<UrlDocument[]> {
  try {
    const data = await fs.readFile(URLS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.urls || [];
  } catch (error) {
    console.log('No URL documents found or error reading urls.json:', error);
    return [];
  }
}

/**
 * Write URL documents to storage
 */
async function writeUrls(urls: UrlDocument[]): Promise<void> {
  await fs.writeFile(
    URLS_FILE,
    JSON.stringify({ urls }, null, 2),
    'utf-8'
  );
}

/**
 * POST /api/documents/rebuild-embeddings
 * Rebuild vector embeddings for ALL documents (PDFs + URLs)
 */
export async function POST(request: NextRequest) {
  console.log('Starting embeddings rebuild process for ALL documents...');

  try {
    // Get current PDF documents in docs folder
    const allFiles = await fs.readdir(DOCS_FOLDER);
    const pdfFiles = allFiles.filter((file) => file.toLowerCase().endsWith('.pdf'));
    console.log(`Found ${pdfFiles.length} PDF documents`);

    // Get URL documents
    const urlDocuments = await readUrls();
    const fetchedUrls = urlDocuments.filter(url => url.status === 'fetched' || url.status === 'indexed');
    console.log(`Found ${urlDocuments.length} URL documents (${fetchedUrls.length} with fetched content)`);

    if (pdfFiles.length === 0 && fetchedUrls.length === 0) {
      console.warn('No documents found to index');
      return NextResponse.json(
        { error: 'No documents found. Please upload PDFs or add URLs first.' },
        { status: 400 }
      );
    }

    // Rebuild vector database with ALL documents (PDFs + URLs)
    try {
      console.log('Starting vector database rebuild with PDFs and URLs...');
      const vectordb = await rebuildAllEmbeddings(pdfFiles, fetchedUrls);

      // Update URL statuses to 'indexed' for successfully embedded URLs
      for (const urlDoc of urlDocuments) {
        if (urlDoc.status === 'fetched' && urlDoc.fetchedDocuments && urlDoc.fetchedDocuments.length > 0) {
          urlDoc.status = 'indexed';
          urlDoc.lastIndexed = new Date().toISOString();
        }
      }
      await writeUrls(urlDocuments);

      // Update the global instance with the rebuilt collection
      setVectordbInstance(vectordb);
      console.log(`Embeddings rebuilt successfully for ${pdfFiles.length} PDFs and ${fetchedUrls.length} URLs`);

      return NextResponse.json({
        message: `Embeddings rebuilt successfully for ${pdfFiles.length} PDFs and ${fetchedUrls.length} URLs`,
        pdfs_processed: pdfFiles,
        urls_processed: fetchedUrls.map(u => u.url),
      });
    } catch (embeddingError: any) {
      const errorMsg = String(embeddingError);
      console.error(`Embedding rebuild failed: ${errorMsg}`);

      if (errorMsg.toLowerCase().includes('quota') || errorMsg.includes('429')) {
        console.warn('API quota exceeded during rebuild');
        return NextResponse.json(
          {
            error:
              'API quota exceeded. Please check your Google API billing and quota limits, then try again later.',
          },
          { status: 429 }
        );
      } else if (errorMsg.toLowerCase().includes('rate')) {
        console.warn('Rate limit exceeded during rebuild');
        return NextResponse.json(
          { error: 'Rate limit exceeded. Please wait a few minutes and try again.' },
          { status: 429 }
        );
      } else {
        console.error(`Unexpected error during rebuild: ${errorMsg}`);
        return NextResponse.json(
          { error: `Failed to create embeddings for all documents: ${errorMsg}` },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error('General error during embeddings rebuild:', error);
    return NextResponse.json(
      { error: `Error rebuilding embeddings for all documents: ${error}` },
      { status: 500 }
    );
  }
}
