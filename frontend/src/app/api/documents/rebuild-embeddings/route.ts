import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import { DOCS_FOLDER } from '@/lib/config';
import { getVectorstore } from '@/lib/vectordb';
import { setVectordbInstance } from '@/lib/sessionManager';

/**
 * POST /api/documents/rebuild-embeddings
 * Rebuild vector embeddings for all PDF documents
 */
export async function POST(request: NextRequest) {
  console.log('Starting embeddings rebuild process...');

  try {
    // Get current PDF documents in docs folder
    const allFiles = await fs.readdir(DOCS_FOLDER);
    const pdfFiles = allFiles.filter((file) => file.toLowerCase().endsWith('.pdf'));
    console.log(`Found ${pdfFiles.length} PDF documents for rebuilding: ${pdfFiles}`);

    if (pdfFiles.length === 0) {
      console.warn('No PDF documents found in docs folder');
      return NextResponse.json(
        { error: 'No PDF documents found in docs folder' },
        { status: 400 }
      );
    }

    // Rebuild vector database with retry logic
    try {
      console.log('Starting vector database rebuild...');
      const vectordb = await getVectorstore(pdfFiles, true); // rebuild=true to delete old collection

      // Update the global instance with the rebuilt collection
      setVectordbInstance(vectordb);
      console.log(`Embeddings rebuilt successfully for ${pdfFiles.length} documents`);

      return NextResponse.json({
        message: `Embeddings rebuilt successfully for ${pdfFiles.length} documents`,
        documents_processed: pdfFiles,
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
          { error: `Failed to create embeddings: ${errorMsg}` },
          { status: 500 }
        );
      }
    }
  } catch (error) {
    console.error('General error during embeddings rebuild:', error);
    return NextResponse.json(
      { error: `Error rebuilding embeddings: ${error}` },
      { status: 500 }
    );
  }
}
