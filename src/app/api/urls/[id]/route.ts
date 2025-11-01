import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { UrlDocument } from '@/lib/types';
import { removeUrlDocuments } from '@/lib/vectordb';
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
 * DELETE /api/urls/[id]
 * Remove a URL and its indexed documents
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
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

    const urlToDelete = urls[urlIndex];

    // Remove from vector database only if it's indexed
    // URLs with 'fetched' or 'pending' status are not in the vector DB yet
    if (urlToDelete.status === 'indexed') {
      try {
        const vectorDB = await getVectorDB();
        if (vectorDB) {
          await removeUrlDocuments(vectorDB, urlToDelete.url);
          console.log(`Removed URL documents from vector database: ${urlToDelete.url}`);
        } else {
          console.warn('Vector database not initialized, skipping removal from vector DB');
        }
      } catch (error) {
        console.error(`Error removing URL documents from vector DB:`, error);
        // Continue with deletion even if vector DB cleanup fails
      }
    } else {
      console.log(`URL not indexed yet (status: ${urlToDelete.status}), skipping vector DB removal`);
    }

    // Remove from URLs list
    urls.splice(urlIndex, 1);
    await writeUrls(urls);

    console.log(`Successfully deleted URL: ${urlToDelete.url}`);

    return NextResponse.json({
      message: 'URL deleted successfully'
    });
  } catch (error) {
    console.error('Error in DELETE /api/urls/[id]:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
