import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { QueryRequestSchema, QueryResponseSchema } from '@/lib/types';
import { getAnswerWithHistory } from '@/lib/chatbot';
import {
  cleanupExpiredSessions,
  updateSessionActivity,
  getVectordbInstance,
} from '@/lib/sessionManager';

/**
 * POST /api/query
 * Process a chat query with RAG
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = QueryRequestSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: validationResult.error },
        { status: 400 }
      );
    }

    const { question, session_id } = validationResult.data;

    // Clean up expired sessions
    cleanupExpiredSessions();

    if (!question) {
      console.warn('Empty question received');
      return NextResponse.json({ error: 'Question cannot be empty' }, { status: 400 });
    }

    // Create or use provided session ID
    const sessionId = session_id || uuidv4();
    console.log(`Processing query for session: ${sessionId}`);

    // Update session activity time
    updateSessionActivity(sessionId);

    // Get vectordb instance (will lazy-load if not initialized)
    const vectordb = await getVectordbInstance();
    if (!vectordb) {
      return NextResponse.json(
        { error: 'Vector database not initialized. Please add PDF documents to data/docs/ and restart the server.' },
        { status: 500 }
      );
    }

    try {
      // Get answer with conversation history
      console.log(`Getting answer for question: ${question.substring(0, 100)}...`);
      const { response: answer, sources } = await getAnswerWithHistory(
        sessionId,
        question,
        vectordb
      );

      console.log(`Successfully processed query for session: ${sessionId}`);

      const response = QueryResponseSchema.parse({
        answer,
        session_id: sessionId,
        sources,
      });

      return NextResponse.json(response);
    } catch (error) {
      console.error(`Error processing query for session ${sessionId}:`, error);
      return NextResponse.json(
        { error: `Error processing query: ${error}` },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in query handler:', error);
    return NextResponse.json({ error: 'Failed to process query request' }, { status: 500 });
  }
}
