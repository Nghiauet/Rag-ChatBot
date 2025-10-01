import { NextRequest, NextResponse } from 'next/server';
import { getChatHistory, formatChatHistory } from '@/lib/chatbot';
import {
  cleanupExpiredSessions,
  sessionExists,
  deleteSession,
} from '@/lib/sessionManager';
import { ChatHistoryResponseSchema } from '@/lib/types';

/**
 * GET /api/history/[sessionId]
 * Get chat history for a specific session
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Clean up expired sessions
    cleanupExpiredSessions();

    const history = getChatHistory(sessionId);

    if (history.length === 0 && sessionExists(sessionId)) {
      // Session exists but has no history
      const response = ChatHistoryResponseSchema.parse({
        session_id: sessionId,
        history: [],
      });
      return NextResponse.json(response);
    } else if (history.length === 0) {
      // Session doesn't exist
      return NextResponse.json(
        { error: `Session ${sessionId} not found` },
        { status: 404 }
      );
    }

    // Convert LangChain message objects to dictionaries
    const formattedHistory = formatChatHistory(history);

    const response = ChatHistoryResponseSchema.parse({
      session_id: sessionId,
      history: formattedHistory,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in get history handler:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve chat history' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/history/[sessionId]
 * Clear chat history for a specific session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    if (!sessionExists(sessionId)) {
      return NextResponse.json(
        { error: `Session ${sessionId} not found` },
        { status: 404 }
      );
    }

    deleteSession(sessionId);

    return NextResponse.json({
      message: `Chat history for session ${sessionId} has been cleared`,
    });
  } catch (error) {
    console.error('Error in clear history handler:', error);
    return NextResponse.json(
      { error: 'Failed to clear chat history' },
      { status: 500 }
    );
  }
}
