import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { UrlDocument, RefreshUrlResponse } from '@/lib/types';
import { fetchUrlContent } from '@/lib/urlFetcher';
import { removeUrlDocuments, addUrlDocuments } from '@/lib/vectordb';
import { getVectorDB } from '@/lib/sessionManager';

const URLS_FILE = path.join(process.cwd(), 'data', 'urls.json');

// File lock to prevent race conditions during concurrent operations
let fileLock: Promise<void> = Promise.resolve();

/**
 * Execute a file operation with locking to prevent race conditions
 */
async function withFileLock<T>(operation: () => Promise<T>): Promise<T> {
  const currentLock = fileLock;
  let releaseLock: () => void;

  fileLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });

  try {
    await currentLock;
    return await operation();
  } finally {
    releaseLock!();
  }
}

/**
 * Read URLs from storage
 */
async function readUrls(): Promise<UrlDocument[]> {
  try {
    const data = await fs.readFile(URLS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.urls || [];
  } catch (error) {
    console.error('Error reading URLs file:', error);
    return [];
  }
}

/**
 * Write URLs to storage (with locking)
 */
async function writeUrls(urls: UrlDocument[]): Promise<void> {
  await withFileLock(async () => {
    await fs.writeFile(
      URLS_FILE,
      JSON.stringify({ urls }, null, 2),
      'utf-8'
    );
  });
}

/**
 * POST /api/urls/[id]/refresh
 * Re-fetch and re-index a URL
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<RefreshUrlResponse | { error: string }>> {
  try {
    const { id } = await params;

    // Read current URLs
    const urls = await readUrls();
    const urlIndex = urls.findIndex(u => u.id === id);

    if (urlIndex === -1) {
      return NextResponse.json(
        { error: 'URL not found' },
        { status: 404 }
      );
    }

    const urlDoc = urls[urlIndex];

    // Update status to pending
    urlDoc.status = 'pending';
    urlDoc.error = undefined;
    await writeUrls(urls);

    try {
      console.log(`Refreshing URL: ${urlDoc.url}`);

      // Fetch new content
      const fetchResult = await fetchUrlContent(urlDoc.url);

      if (fetchResult.error) {
        // Update status to error
        urlDoc.status = 'error';
        urlDoc.error = fetchResult.error;
        await writeUrls(urls);

        return NextResponse.json(
          { error: fetchResult.error },
          { status: 400 }
        );
      }

      // Update title if changed
      urlDoc.title = fetchResult.title;
      urlDoc.contentType = fetchResult.contentType;

      // Remove old documents from vector DB
      const vectorDB = await getVectorDB();
      if (!vectorDB) {
        throw new Error('Vector database not initialized');
      }
      await removeUrlDocuments(vectorDB, urlDoc.url);

      // Add new documents
      await addUrlDocuments(vectorDB, fetchResult.documents, urlDoc.url);

      // Update status to indexed
      urlDoc.status = 'indexed';
      urlDoc.lastIndexed = new Date().toISOString();
      await writeUrls(urls);

      console.log(`Successfully refreshed URL: ${urlDoc.url}`);

      return NextResponse.json({
        message: 'URL refreshed successfully',
        url: urlDoc
      });
    } catch (error) {
      console.error(`Error refreshing URL ${urlDoc.url}:`, error);

      // Update status to error
      urlDoc.status = 'error';
      urlDoc.error = error instanceof Error ? error.message : 'Unknown error';
      await writeUrls(urls);

      return NextResponse.json(
        {
          error: `Failed to refresh URL: ${error instanceof Error ? error.message : 'Unknown error'}`
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in POST /api/urls/[id]/refresh:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
