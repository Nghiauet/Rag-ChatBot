from fastapi import FastAPI, HTTPException, Depends
from pydantic import BaseModel
import os
from utils.prepare_vectordb import get_vectorstore
from utils.chatbot import get_answer_with_history, get_chat_history, clear_chat_history
import uvicorn
from typing import List, Dict, Optional
from uuid import uuid4
import time

# Define request and response models
class QueryRequest(BaseModel):
    question: str
    session_id: Optional[str] = None

class QueryResponse(BaseModel):
    answer: str
    session_id: str
    sources: Optional[Dict[str, List[int]]] = None

class ChatHistoryResponse(BaseModel):
    session_id: str
    history: List[Dict[str, str]]

class HealthAssistantAPI:
    """
    A FastAPI application for a women's healthcare chatbot API
    
    This class encapsulates the functionality for serving a specialized healthcare assistant
    through API endpoints. It loads pre-embedded documents and provides endpoints for querying
    the healthcare knowledge base with session management.
    """
    def __init__(self):
        """
        Initializes the HealthAssistantAPI class
        
        This method ensures the existence of the 'docs' folder and loads the vector database
        """
        # Fix for protobuf compatibility issue
        os.environ["PROTOCOL_BUFFERS_PYTHON_IMPLEMENTATION"] = "python"
        
        # Ensure the docs folder exists
        if not os.path.exists("docs"):
            os.makedirs("docs")
            
        # Load documents from the docs folder
        self.upload_docs = os.listdir("docs")
        if not self.upload_docs:
            raise Exception("No documents found in the 'docs' folder. Please add documents before starting the API.")
            
        # Load the vector database
        self.vectordb = get_vectorstore(self.upload_docs)
        
        # Track active sessions and their last activity time
        self.active_sessions = {}
        
        # Session timeout in seconds (30 minutes)
        self.session_timeout = 30 * 60
        
    def create_app(self):
        """
        Creates and configures the FastAPI application
        
        Returns:
            FastAPI: The configured FastAPI application
        """
        app = FastAPI(
            title="Women's Health Assistant API",
            description="API for querying women's health information with session management",
            version="1.0.0"
        )
        
        @app.get("/")
        async def root():
            return {"message": "Welcome to the Women's Health Assistant API"}
        
        @app.post("/query", response_model=QueryResponse)
        async def query(request: QueryRequest):
            # Clean up expired sessions
            self._cleanup_expired_sessions()
            
            if not request.question:
                raise HTTPException(status_code=400, detail="Question cannot be empty")
            
            # Create or use provided session ID
            session_id = request.session_id or str(uuid4())
            
            # Update session activity time
            self.active_sessions[session_id] = time.time()
                
            try:
                # Get answer with conversation history
                answer, sources, _ = get_answer_with_history(
                    session_id, 
                    request.question, 
                    self.vectordb
                )
                return QueryResponse(answer=answer, session_id=session_id, sources=sources)
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error processing query: {str(e)}")
        
        @app.get("/history/{session_id}", response_model=ChatHistoryResponse)
        async def get_history(session_id: str):
            # Clean up expired sessions
            self._cleanup_expired_sessions()
            
            history = get_chat_history(session_id)
            if not history and session_id in self.active_sessions:
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
        
        @app.delete("/history/{session_id}")
        async def clear_history(session_id: str):
            if session_id not in self.active_sessions:
                raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
            
            clear_chat_history(session_id)
            return {"message": f"Chat history for session {session_id} has been cleared"}
        
        return app
    
    def _cleanup_expired_sessions(self):
        """
        Remove sessions that have been inactive for longer than the timeout period
        """
        current_time = time.time()
        expired_sessions = []
        
        for session_id, last_active in self.active_sessions.items():
            if current_time - last_active > self.session_timeout:
                expired_sessions.append(session_id)
                clear_chat_history(session_id)
        
        for session_id in expired_sessions:
            del self.active_sessions[session_id]

def run_api():
    """
    Creates and runs the FastAPI application
    """
    api = HealthAssistantAPI()
    app = api.create_app()
    return app

if __name__ == "__main__":
    app = run_api()
    uvicorn.run(app, host="0.0.0.0", port=8300)