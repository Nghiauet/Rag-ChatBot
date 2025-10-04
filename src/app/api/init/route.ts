import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import { DOCS_FOLDER } from '@/lib/config';
import { getVectorstore } from '@/lib/vectordb';
import { setVectordbInstance } from '@/lib/sessionManager';

/**
 * POST /api/init
 * Initialize the vector database on server startup or on demand
 */
export async function POST(request: NextRequest) {
  console.log('Initializing vector database...');

  try {
    // Ensure docs folder exists
    await fs.mkdir(DOCS_FOLDER, { recursive: true });

    // Get list of PDF files
    const allFiles = await fs.readdir(DOCS_FOLDER);
    const pdfFiles = allFiles.filter((file) => file.toLowerCase().endsWith('.pdf'));

    console.log(`Found ${pdfFiles.length} PDF documents`);

    if (pdfFiles.length === 0) {
      console.warn('No PDF documents found. Vector database will not be initialized.');
      return NextResponse.json(
        {
          message: 'No PDF documents found. Please upload documents and rebuild embeddings.',
          initialized: false,
        },
        { status: 200 }
      );
    }

    try {
      // Load or create vector database
      console.log('Loading vector database...');
      const vectordb = await getVectorstore(pdfFiles, false); // rebuild=false, try to load existing
      setVectordbInstance(vectordb);
      console.log('Vector database initialized successfully');

      return NextResponse.json({
        message: `Vector database initialized with ${pdfFiles.length} documents`,
        documents: pdfFiles,
        initialized: true,
      });
    } catch (error) {
      console.error('Failed to initialize vector database:', error);
      return NextResponse.json(
        {
          error: `Failed to initialize vector database: ${error}`,
          initialized: false,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in init handler:', error);
    return NextResponse.json(
      { error: 'Failed to initialize application', initialized: false },
      { status: 500 }
    );
  }
}

/**
 * GET /api/init
 * Check if vector database is initialized
 */
export async function GET() {
  const { getVectordbInstance } = await import('@/lib/sessionManager');
  const vectordb = getVectordbInstance();

  return NextResponse.json({
    initialized: vectordb !== null,
    message: vectordb
      ? 'Vector database is initialized'
      : 'Vector database is not initialized',
  });
}
