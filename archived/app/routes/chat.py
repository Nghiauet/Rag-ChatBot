from fastapi import APIRouter, HTTPException
from uuid import uuid4
import time
import logging

from app.models import QueryRequest, QueryResponse, ChatHistoryResponse
from app.utils.chatbot import get_answer_with_history, get_chat_history, clear_chat_history

logger = logging.getLogger(__name__)

router = APIRouter(prefix="", tags=["chat"])


def create_chat_routes(app_instance):
    """Create chat-related routes with app instance dependency"""

    @router.post("/query", response_model=QueryResponse)
    async def query(request: QueryRequest):
        logger.info(f"Received query request for session: {request.session_id}")

        # Clean up expired sessions
        app_instance._cleanup_expired_sessions()

        if not request.question:
            logger.warning("Empty question received")
            raise HTTPException(status_code=400, detail="Question cannot be empty")

        # Create or use provided session ID
        session_id = request.session_id or str(uuid4())
        logger.info(f"Processing query for session: {session_id}")

        # Update session activity time
        app_instance.active_sessions[session_id] = time.time()

        try:
            # Get answer with conversation history
            logger.debug(f"Getting answer for question: {request.question[:100]}...")
            answer, sources, _ = get_answer_with_history(
                session_id,
                request.question,
                app_instance.vectordb
            )
            logger.info(f"Successfully processed query for session: {session_id}")
            return QueryResponse(answer=answer, session_id=session_id, sources=sources)
        except Exception as e:
            logger.error(f"Error processing query for session {session_id}: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")

    @router.get("/history/{session_id}", response_model=ChatHistoryResponse)
    async def get_history(session_id: str):
        # Clean up expired sessions
        app_instance._cleanup_expired_sessions()

        history = get_chat_history(session_id)
        if not history and session_id in app_instance.active_sessions:
            # Session exists but has no history
            return ChatHistoryResponse(
                session_id=session_id,
                history=[]
            )
        elif not history:
            # Session doesn't exist
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

        # Convert LangChain message objects to dictionaries
        formatted_history = []
        for msg in history:
            role = "ai" if msg.__class__.__name__ == "AIMessage" else "human"
            formatted_history.append({
                "role": role,
                "content": msg.content
            })

        return ChatHistoryResponse(
            session_id=session_id,
            history=formatted_history
        )

    @router.delete("/history/{session_id}")
    async def clear_history(session_id: str):
        if session_id not in app_instance.active_sessions:
            raise HTTPException(status_code=404, detail=f"Session {session_id} not found")

        clear_chat_history(session_id)
        return {"message": f"Chat history for session {session_id} has been cleared"}

    return router