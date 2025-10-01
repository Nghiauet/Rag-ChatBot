import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DOCS_FOLDER } from '@/lib/config';

/**
 * DELETE /api/documents/[filename]
 * Delete a specific document
 */
export async function DELETE(
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
      await fs.unlink(filePath);
      console.log(`Document ${filename} deleted successfully`);

      return NextResponse.json({
        message: `Document ${filename} deleted successfully. Please rebuild embeddings to update the knowledge base.`,
      });
    } catch (error) {
      console.error(`Failed to delete file ${filename}:`, error);
      return NextResponse.json(
        { error: `Failed to delete file: ${error}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in delete handler:', error);
    return NextResponse.json({ error: 'Failed to process delete request' }, { status: 500 });
  }
}
