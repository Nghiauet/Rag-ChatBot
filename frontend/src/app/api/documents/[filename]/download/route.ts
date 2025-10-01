import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DOCS_FOLDER } from '@/lib/config';

/**
 * GET /api/documents/[filename]/download
 * Download a specific document
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const filePath = path.join(DOCS_FOLDER, filename);

    try {
      await fs.access(filePath);
    } catch {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    try {
      const fileBuffer = await fs.readFile(filePath);

      // Convert Buffer to Uint8Array for NextResponse
      return new NextResponse(new Uint8Array(fileBuffer), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    } catch (error) {
      console.error(`Failed to read file ${filename}:`, error);
      return NextResponse.json(
        { error: `Failed to read file: ${error}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in download handler:', error);
    return NextResponse.json({ error: 'Failed to process download request' }, { status: 500 });
  }
}
