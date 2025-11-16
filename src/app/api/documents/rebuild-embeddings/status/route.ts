import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getRebuildJob } from '@/lib/vectordb';

/**
 * GET /api/documents/rebuild-embeddings/status?jobId=xxx
 * Check the status of a rebuild embeddings job
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');

    if (!jobId) {
      return NextResponse.json(
        { error: 'Missing jobId parameter' },
        { status: 400 }
      );
    }

    const job = getRebuildJob(jobId);

    if (!job) {
      return NextResponse.json(
        { error: 'Job not found. It may have expired or never existed.' },
        { status: 404 }
      );
    }

    // Return job status
    return NextResponse.json({
      jobId: job.jobId,
      status: job.status,
      progress: job.progress,
      error: job.error,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
    });
  } catch (error) {
    console.error('Error checking rebuild status:', error);
    return NextResponse.json(
      { error: `Error checking rebuild status: ${error}` },
      { status: 500 }
    );
  }
}
