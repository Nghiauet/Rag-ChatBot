import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DOCS_FOLDER } from '@/lib/config';
import { DocumentListResponseSchema } from '@/lib/types';

/**
 * GET /api/documents
 * List all PDF documents in the docs folder
 */
export async function GET() {
  try {
    // Ensure docs folder exists
    await fs.mkdir(DOCS_FOLDER, { recursive: true });

    const files = await fs.readdir(DOCS_FOLDER);
    const documents = [];

    for (const file of files) {
      const filePath = path.join(DOCS_FOLDER, file);
      const stats = await fs.stat(filePath);

      if (stats.isFile() && file.toLowerCase().endsWith('.pdf')) {
        documents.push({
          filename: file,
          size: stats.size,
          upload_date: stats.mtime.toISOString(),
        });
      }
    }

    const response = DocumentListResponseSchema.parse({ documents });
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error listing documents:', error);
    return NextResponse.json(
      { error: 'Failed to list documents' },
      { status: 500 }
    );
  }
}
