import { NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DOCS_FOLDER } from '@/lib/config';
import { rebuildAllEmbeddings, createRebuildJob, cleanupOldJobs } from '@/lib/vectordb';
import { setVectordbInstance } from '@/lib/sessionManager';
import { UrlDocument } from '@/lib/types';
import { randomUUID } from 'crypto';

const URLS_FILE = path.join(process.cwd(), 'data', 'urls.json');

/**
 * Read URL documents from storage
 */
async function readUrls(): Promise<UrlDocument[]> {
  try {
    const data = await fs.readFile(URLS_FILE, 'utf-8');
    const parsed = JSON.parse(data);
    return parsed.urls || [];
  } catch (error) {
    console.log('No URL documents found or error reading urls.json:', error);
    return [];
  }
}

/**
 * Write URL documents to storage
 */
async function writeUrls(urls: UrlDocument[]): Promise<void> {
  await fs.writeFile(
    URLS_FILE,
    JSON.stringify({ urls }, null, 2),
    'utf-8'
  );
}

/**
 * POST /api/documents/rebuild-embeddings
 * Rebuild vector embeddings for ALL documents (PDFs + URLs)
 * Returns immediately with a jobId for status polling
 */
export async function POST() {
  console.log('Starting embeddings rebuild process for ALL documents...');

  try {
    // Clean up old jobs
    cleanupOldJobs();

    // Get current PDF documents in docs folder
    const allFiles = await fs.readdir(DOCS_FOLDER);
    const pdfFiles = allFiles.filter((file) => file.toLowerCase().endsWith('.pdf'));
    console.log(`Found ${pdfFiles.length} PDF documents`);

    // Get URL documents
    const urlDocuments = await readUrls();
    const fetchedUrls = urlDocuments.filter(url => url.status === 'fetched' || url.status === 'indexed');
    console.log(`Found ${urlDocuments.length} URL documents (${fetchedUrls.length} with fetched content)`);

    if (pdfFiles.length === 0 && fetchedUrls.length === 0) {
      console.warn('No documents found to index');
      return NextResponse.json(
        { error: 'No documents found. Please upload PDFs or add URLs first.' },
        { status: 400 }
      );
    }

    // Generate unique job ID
    const jobId = randomUUID();
    console.log(`Created rebuild job with ID: ${jobId}`);

    // Create job tracking entry
    const job = createRebuildJob(jobId, pdfFiles.length, fetchedUrls.length);

    // Start background processing (don't await)
    processRebuildInBackground(jobId, pdfFiles, fetchedUrls, urlDocuments).catch(error => {
      console.error(`Background rebuild failed for job ${jobId}:`, error);
    });

    // Return immediately with job ID
    return NextResponse.json({
      jobId,
      status: job.status,
      progress: job.progress,
      message: 'Rebuild started in background',
    });
  } catch (error) {
    console.error('Error starting embeddings rebuild:', error);
    return NextResponse.json(
      { error: `Error starting embeddings rebuild: ${error}` },
      { status: 500 }
    );
  }
}

/**
 * Background processing function
 */
async function processRebuildInBackground(
  jobId: string,
  pdfFiles: string[],
  fetchedUrls: UrlDocument[],
  urlDocuments: UrlDocument[]
) {
  try {
    console.log(`Background processing started for job ${jobId}`);

    // Rebuild vector database with ALL documents (PDFs + URLs)
    const vectordb = await rebuildAllEmbeddings(pdfFiles, fetchedUrls, jobId);

    // Update URL statuses to 'indexed' for successfully embedded URLs
    for (const urlDoc of urlDocuments) {
      if (urlDoc.status === 'fetched' && urlDoc.fetchedDocuments && urlDoc.fetchedDocuments.length > 0) {
        urlDoc.status = 'indexed';
        urlDoc.lastIndexed = new Date().toISOString();
      }
    }
    await writeUrls(urlDocuments);

    // Update the global instance with the rebuilt collection
    setVectordbInstance(vectordb);
    console.log(`Background rebuild completed for job ${jobId}`);
  } catch (error) {
    console.error(`Background rebuild failed for job ${jobId}:`, error);
    // Error is already tracked in rebuildAllEmbeddings via updateRebuildJob
  }
}
