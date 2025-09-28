from fastapi import FastAPI, HTTPException, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
import shutil
from pathlib import Path
from app.utils.prepare_vectordb import get_vectorstore
from app.utils.chatbot import get_answer_with_history, get_chat_history, clear_chat_history
import uvicorn
from typing import List, Dict, Optional
from uuid import uuid4
import time
from datetime import datetime
from dotenv import load_dotenv
import yaml

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

class DocumentInfo(BaseModel):
    filename: str
    size: int
    upload_date: str

class DocumentListResponse(BaseModel):
    documents: List[DocumentInfo]

class UploadResponse(BaseModel):
    message: str
    filename: str

class PromptConfig(BaseModel):
    system_prompt: str
    user_greeting: str
    context_instruction: str
    fallback_response: str

class PromptUpdateRequest(BaseModel):
    prompts: PromptConfig

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

        # Add CORS middleware
        app.add_middleware(
            CORSMiddleware,
            allow_origins=["*"],  # Next.js default port
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
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
        
        # Document management endpoints
        @app.get("/api/documents", response_model=DocumentListResponse)
        async def list_documents():
            docs_path = Path("docs")
            documents = []

            if docs_path.exists():
                for file_path in docs_path.iterdir():
                    if file_path.is_file() and file_path.suffix.lower() == '.pdf':
                        stat = file_path.stat()
                        documents.append(DocumentInfo(
                            filename=file_path.name,
                            size=stat.st_size,
                            upload_date=datetime.fromtimestamp(stat.st_mtime).isoformat()
                        ))

            return DocumentListResponse(documents=documents)

        @app.post("/api/documents/upload", response_model=UploadResponse)
        async def upload_document(file: UploadFile = File(...)):
            # Validate file type
            if not file.filename.lower().endswith('.pdf'):
                raise HTTPException(status_code=400, detail="Only PDF files are allowed")

            # Create docs directory if it doesn't exist
            docs_path = Path("docs")
            docs_path.mkdir(exist_ok=True)

            # Save the file
            file_path = docs_path / file.filename
            try:
                with open(file_path, "wb") as buffer:
                    shutil.copyfileobj(file.file, buffer)

                # Reload vector database with new document
                self.upload_docs = [f for f in os.listdir("docs") if f.lower().endswith('.pdf')]
                try:
                    self.vectordb = get_vectorstore(self.upload_docs)
                    return UploadResponse(
                        message=f"Document {file.filename} uploaded and indexed successfully",
                        filename=file.filename
                    )
                except Exception as embedding_error:
                    # File uploaded but embedding failed
                    error_msg = str(embedding_error)
                    if "quota" in error_msg.lower() or "429" in error_msg:
                        return UploadResponse(
                            message=f"Document {file.filename} uploaded but indexing failed due to API quota limits. Please rebuild embeddings later.",
                            filename=file.filename
                        )
                    elif "rate" in error_msg.lower():
                        return UploadResponse(
                            message=f"Document {file.filename} uploaded but indexing failed due to rate limits. Please wait and rebuild embeddings.",
                            filename=file.filename
                        )
                    else:
                        return UploadResponse(
                            message=f"Document {file.filename} uploaded but indexing failed: {error_msg}. Please rebuild embeddings manually.",
                            filename=file.filename
                        )

            except Exception as e:
                # Clean up file if it was created but processing failed
                if file_path.exists():
                    try:
                        file_path.unlink()
                    except:
                        pass
                raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

        @app.delete("/api/documents/{filename}")
        async def delete_document(filename: str):
            file_path = Path("docs") / filename

            if not file_path.exists():
                raise HTTPException(status_code=404, detail="Document not found")

            try:
                file_path.unlink()

                # Reload vector database without deleted document
                self.upload_docs = os.listdir("docs")
                if self.upload_docs:
                    self.vectordb = get_vectorstore(self.upload_docs)
                else:
                    self.vectordb = None

                return {"message": f"Document {filename} deleted successfully"}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

        @app.get("/api/documents/{filename}/download")
        async def download_document(filename: str):
            file_path = Path("docs") / filename

            if not file_path.exists():
                raise HTTPException(status_code=404, detail="Document not found")

            return FileResponse(
                path=str(file_path),
                filename=filename,
                media_type='application/pdf'
            )

        # Prompt management endpoints
        @app.get("/api/prompts", response_model=PromptConfig)
        async def get_prompts():
            try:
                with open("prompts.yaml", "r") as file:
                    prompts = yaml.safe_load(file)
                return PromptConfig(**prompts)
            except FileNotFoundError:
                raise HTTPException(status_code=404, detail="Prompts configuration file not found")
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error reading prompts: {str(e)}")

        @app.put("/api/prompts")
        async def update_prompts(request: PromptUpdateRequest):
            try:
                prompts_dict = request.prompts.model_dump()
                with open("prompts.yaml", "w") as file:
                    yaml.dump(prompts_dict, file, default_flow_style=False, allow_unicode=True)
                return {"message": "Prompts updated successfully"}
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error updating prompts: {str(e)}")

        # Embedding management endpoints
        @app.post("/api/embeddings/rebuild")
        async def rebuild_embeddings():
            try:
                # Get current PDF documents in docs folder
                all_files = os.listdir("docs")
                self.upload_docs = [f for f in all_files if f.lower().endswith('.pdf')]

                if not self.upload_docs:
                    raise HTTPException(status_code=400, detail="No PDF documents found in docs folder")

                # Rebuild vector database with retry logic
                try:
                    self.vectordb = get_vectorstore(self.upload_docs, from_session_state=False)
                    return {
                        "message": f"Embeddings rebuilt successfully for {len(self.upload_docs)} documents",
                        "documents_processed": self.upload_docs
                    }
                except Exception as embedding_error:
                    error_msg = str(embedding_error)

                    if "quota" in error_msg.lower() or "429" in error_msg:
                        raise HTTPException(
                            status_code=429,
                            detail="API quota exceeded. Please check your Google API billing and quota limits, then try again later."
                        )
                    elif "rate" in error_msg.lower():
                        raise HTTPException(
                            status_code=429,
                            detail="Rate limit exceeded. Please wait a few minutes and try again."
                        )
                    else:
                        raise HTTPException(
                            status_code=500,
                            detail=f"Failed to create embeddings: {error_msg}"
                        )

            except HTTPException:
                # Re-raise HTTP exceptions as-is
                raise
            except Exception as e:
                raise HTTPException(status_code=500, detail=f"Error rebuilding embeddings: {str(e)}")

        # add health check endpoint
        @app.get("/health")
        async def health_check():
            return {"status": "healthy"}

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
    # set env for GOOGLE_API_KEY
    app = run_api()
    uvicorn.run(app, host="0.0.0.0", port=8301)