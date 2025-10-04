/**
 * Next.js instrumentation hook
 * This runs once when the server starts (both dev and production)
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    console.log('🚀 Server starting - initializing vector database...');

    try {
      const { getVectorstore } = await import('./lib/vectordb');
      const { setVectordbInstance } = await import('./lib/sessionManager');
      const { DOCS_FOLDER } = await import('./lib/config');
      const fs = await import('fs/promises');

      // Ensure docs folder exists
      await fs.mkdir(DOCS_FOLDER, { recursive: true });

      // Get list of PDF files
      const allFiles = await fs.readdir(DOCS_FOLDER);
      const pdfFiles = allFiles.filter((file) => file.toLowerCase().endsWith('.pdf'));

      if (pdfFiles.length === 0) {
        console.warn('⚠️  No PDF documents found. Vector database will not be initialized.');
        console.warn('   Please upload documents to data/docs/ and restart the server.');
        return;
      }

      console.log(`📚 Found ${pdfFiles.length} PDF documents`);
      console.log('🔄 Loading vector database from ChromaDB Cloud...');

      // Load existing vector database (rebuild=false)
      const vectordb = await getVectorstore(pdfFiles, false);
      setVectordbInstance(vectordb);

      console.log('✅ Vector database initialized successfully!');
      console.log('   Ready to accept queries at /api/query');
    } catch (error) {
      console.error('❌ Failed to initialize vector database:', error);
      console.error('   Server will start but /api/query will fail until initialized.');
      console.error('   You can manually initialize by calling POST /api/init');
    }
  }
}
