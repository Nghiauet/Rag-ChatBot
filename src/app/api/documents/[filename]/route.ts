import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DOCS_FOLDER } from '@/lib/config';
import { getOrCreateEmptyCollection, removePdfDocument } from '@/lib/vectordb';

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
      // First, remove embeddings from vector database
      let chunksRemoved = 0;
      let embeddingRemovalSuccess = true;
      let embeddingError = '';

      try {
        console.log(`Removing embeddings for: ${filename}`);
        const collection = await getOrCreateEmptyCollection();
        chunksRemoved = await removePdfDocument(collection, filename);
        console.log(`Successfully removed ${chunksRemoved} chunks for ${filename}`);
      } catch (removeError) {
        console.error(`Failed to remove embeddings for ${filename}:`, removeError);
        embeddingRemovalSuccess = false;
        embeddingError = removeError instanceof Error ? removeError.message : 'Unknown error';
        // Continue to delete the file even if embedding removal fails
      }

      // Delete the physical file
      await fs.unlink(filePath);
      console.log(`Document ${filename} deleted successfully`);

      const message = embeddingRemovalSuccess
        ? `Document ${filename} deleted successfully! Removed ${chunksRemoved} chunks from the knowledge base.`
        : `Document ${filename} file deleted, but failed to remove embeddings: ${embeddingError}. Consider rebuilding embeddings.`;

      return NextResponse.json({ message });
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
