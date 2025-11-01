import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  AddUrlRequestSchema,
  AddBulkUrlsRequestSchema,
  UrlDocument,
  UrlListResponse,
  AddUrlResponse,
  AddBulkUrlsResponse,
  BulkUrlResult
} from '@/lib/types';
import { fetchUrlContent } from '@/lib/urlFetcher';

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
 * Background processor for URL content fetching
 * Updates the URL document status when fetch completes
 */
async function processUrlInBackground(urlId: string, url: string): Promise<void> {
  try {
    console.log(`Background: Starting fetch for ${url}`);

    // Fetch content with 30-second timeout
    const fetchResult = await fetchUrlContent(url, 30000);

    // Read current URLs
    const urls = await readUrls();
    const urlDoc = urls.find(u => u.id === urlId);

    if (!urlDoc) {
      console.error(`Background: URL document ${urlId} not found`);
      return;
    }

    if (fetchResult.error) {
      // Update with error status
      urlDoc.status = 'error';
      urlDoc.error = fetchResult.error;
      urlDoc.title = fetchResult.title || extractTitleFromUrl(url);
      await writeUrls(urls);
      console.log(`Background: Fetch failed for ${url}: ${fetchResult.error}`);
      return;
    }

    // Update with fetched data
    urlDoc.title = fetchResult.title;
    urlDoc.contentType = fetchResult.contentType;
    urlDoc.status = 'fetched';
    urlDoc.lastFetched = new Date().toISOString();

    // Store the fetched documents for later embedding during rebuild
    urlDoc.fetchedDocuments = fetchResult.documents.map(doc => ({
      pageContent: doc.pageContent,
      metadata: doc.metadata as Record<string, string | number | boolean>
    }));

    await writeUrls(urls);
    console.log(`Background: Successfully fetched ${fetchResult.documents.length} documents from ${url}`);
  } catch (error) {
    console.error(`Background: Error processing URL ${url}:`, error);

    // Update with error status
    try {
      const urls = await readUrls();
      const urlDoc = urls.find(u => u.id === urlId);
      if (urlDoc) {
        urlDoc.status = 'error';
        urlDoc.error = error instanceof Error ? error.message : 'Unknown error during background processing';
        await writeUrls(urls);
      }
    } catch (updateError) {
      console.error(`Background: Failed to update error status:`, updateError);
    }
  }
}

/**
 * Helper to extract title from URL
 */
function extractTitleFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname + urlObj.pathname;
  } catch {
    return url;
  }
}

/**
 * Process a single URL - Returns immediately, processes in background
 */
async function processSingleUrl(url: string, urls: UrlDocument[]): Promise<BulkUrlResult> {
  try {
    // Check if URL already exists
    const existingUrl = urls.find(u => u.url === url);
    if (existingUrl) {
      return {
        url,
        status: 'error',
        message: 'URL already exists'
      };
    }

    // Create new URL document with 'processing' status
    const newUrl: UrlDocument = {
      id: uuidv4(),
      url,
      title: extractTitleFromUrl(url),
      status: 'pending',
      dateAdded: new Date().toISOString(),
    };

    // Add to list immediately
    urls.push(newUrl);
    await writeUrls(urls);

    // Start background processing (don't await)
    processUrlInBackground(newUrl.id, url).catch(err => {
      console.error(`Background process error for ${url}:`, err);
    });

    // Return immediately with pending status
    return {
      url,
      status: 'success',
      message: 'URL added successfully. Processing in background...',
      document: newUrl
    };
  } catch (error) {
    return {
      url,
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Handle bulk URL addition
 */
async function handleBulkUrlAdd(urlList: string[]): Promise<NextResponse<AddBulkUrlsResponse>> {
  const results: BulkUrlResult[] = [];
  let successful = 0;
  let failed = 0;

  // Load existing URLs once
  const urls = await readUrls();

  // Process URLs sequentially
  for (const url of urlList) {
    console.log(`Processing URL ${results.length + 1}/${urlList.length}: ${url}`);

    const result = await processSingleUrl(url, urls);
    results.push(result);

    if (result.status === 'success') {
      successful++;
    } else {
      failed++;
    }
  }

  const message = `Processed ${urlList.length} URLs: ${successful} successful, ${failed} failed`;

  return NextResponse.json({
    message,
    total: urlList.length,
    successful,
    failed,
    results
  });
}

/**
 * GET /api/urls
 * List all URLs
 */
export async function GET(): Promise<NextResponse<UrlListResponse>> {
  try {
    const urls = await readUrls();

    return NextResponse.json({
      urls
    });
  } catch (error) {
    console.error('Error fetching URLs:', error);
    return NextResponse.json(
      { urls: [] },
      { status: 500 }
    );
  }
}

/**
 * POST /api/urls
 * Add a new URL to fetch and index (supports both single and bulk)
 */
export async function POST(request: NextRequest): Promise<NextResponse<AddUrlResponse | AddBulkUrlsResponse | { error: string }>> {
  try {
    // Parse request body
    const body = await request.json();

    // Check if it's a bulk request
    const bulkValidation = AddBulkUrlsRequestSchema.safeParse(body);
    if (bulkValidation.success) {
      return await handleBulkUrlAdd(bulkValidation.data.urls);
    }

    // Try single URL request
    const singleValidation = AddUrlRequestSchema.safeParse(body);
    if (!singleValidation.success) {
      return NextResponse.json(
        { error: singleValidation.error.errors[0].message },
        { status: 400 }
      );
    }

    const { url } = singleValidation.data;

    // Check if URL already exists
    const urls = await readUrls();
    const existingUrl = urls.find(u => u.url === url);

    if (existingUrl) {
      return NextResponse.json(
        { error: 'URL already exists' },
        { status: 409 }
      );
    }

    // Create new URL document with pending status
    const newUrl: UrlDocument = {
      id: uuidv4(),
      url,
      title: extractTitleFromUrl(url),
      status: 'pending',
      dateAdded: new Date().toISOString(),
    };

    // Save to file immediately
    urls.push(newUrl);
    await writeUrls(urls);

    // Start background processing (don't await - process asynchronously)
    processUrlInBackground(newUrl.id, url).catch(err => {
      console.error(`Background process error for ${url}:`, err);
    });

    console.log(`URL added, processing in background: ${url}`);

    // Return immediately with pending status
    return NextResponse.json({
      message: 'URL added successfully. Content is being fetched in the background.',
      url: newUrl
    });
  } catch (error) {
    console.error('Error in POST /api/urls:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
