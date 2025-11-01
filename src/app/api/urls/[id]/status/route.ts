import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { UrlDocument } from '@/lib/types';

const URLS_FILE = path.join(process.cwd(), 'data', 'urls.json');

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
 * GET /api/urls/[id]/status
 * Check the status of a URL being processed
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params;

    // Read current URLs
    const urls = await readUrls();
    const urlDoc = urls.find(u => u.id === id);

    if (!urlDoc) {
      return NextResponse.json(
        { error: 'URL not found' },
        { status: 404 }
      );
    }

    // Determine progress message based on status
    let progress = '';
    switch (urlDoc.status) {
      case 'pending':
        progress = 'Waiting to fetch content...';
        break;
      case 'fetched':
        progress = 'Content fetched successfully';
        break;
      case 'indexed':
        progress = 'Indexed in database';
        break;
      case 'error':
        progress = 'Failed to fetch content';
        break;
      default:
        progress = 'Unknown status';
    }

    return NextResponse.json({
      id: urlDoc.id,
      url: urlDoc.url,
      title: urlDoc.title,
      status: urlDoc.status,
      progress,
      error: urlDoc.error,
      contentType: urlDoc.contentType,
      lastFetched: urlDoc.lastFetched,
      lastIndexed: urlDoc.lastIndexed,
    });
  } catch (error) {
    console.error('Error in GET /api/urls/[id]/status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
