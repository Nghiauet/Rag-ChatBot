import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';
import { DOCS_FOLDER } from '@/lib/config';
import { UploadResponseSchema } from '@/lib/types';

/**
 * POST /api/documents/upload
 * Upload a PDF document
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      console.warn(`Invalid file type uploaded: ${file.name}`);
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }

    // Create docs directory if it doesn't exist
    await fs.mkdir(DOCS_FOLDER, { recursive: true });

    // Save the file
    const filePath = path.join(DOCS_FOLDER, file.name);
    console.log(`Saving file to: ${filePath}`);

    try {
      const buffer = Buffer.from(await file.arrayBuffer());
      await fs.writeFile(filePath, buffer);
      console.log(`File saved successfully: ${file.name}`);

      const response = UploadResponseSchema.parse({
        message: `Document ${file.name} uploaded successfully. Please rebuild embeddings to include this document in the knowledge base.`,
        filename: file.name,
      });

      return NextResponse.json(response);
    } catch (error) {
      console.error(`Failed to upload file ${file.name}:`, error);

      // Clean up file if it was created but processing failed
      try {
        await fs.unlink(filePath);
        console.log(`Cleaned up failed upload file: ${file.name}`);
      } catch {
        console.warn(`Failed to clean up file: ${file.name}`);
      }

      return NextResponse.json(
        { error: `Failed to upload file: ${error}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in upload handler:', error);
    return NextResponse.json({ error: 'Failed to process upload' }, { status: 500 });
  }
}
