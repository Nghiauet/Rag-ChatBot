from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
import time
import logging

from app.config import SESSION_TIMEOUT, DOCS_FOLDER
from app.utils.prepare_vectordb import get_vectorstore
from app.utils.chatbot import clear_chat_history
from app.routes.chat import create_chat_routes
from app.routes.documents import create_document_routes
from app.routes.prompts import router as prompts_router

logger = logging.getLogger(__name__)


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
        logger.info("Initializing HealthAssistantAPI...")

        # Ensure the docs folder exists
        if not os.path.exists(DOCS_FOLDER):
            logger.info("Creating docs folder...")
            os.makedirs(DOCS_FOLDER)
        else:
            logger.info("Docs folder exists")

        # Load documents from the docs folder
        self.upload_docs = os.listdir(DOCS_FOLDER)
        logger.info(f"Found {len(self.upload_docs)} files in docs folder")

        if not self.upload_docs:
            logger.error("No documents found in the 'docs' folder")
            raise Exception("No documents found in the 'docs' folder. Please add documents before starting the API.")

        # Load the vector database
        logger.info("Loading vector database...")
        self.vectordb = get_vectorstore(self.upload_docs)
        logger.info("Vector database loaded successfully")

        # Track active sessions and their last activity time
        self.active_sessions = {}
        self.session_timeout = SESSION_TIMEOUT

        logger.info("HealthAssistantAPI initialization completed")

    def create_app(self) -> FastAPI:
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
            allow_origins=["*"],
            allow_credentials=True,
            allow_methods=["*"],
            allow_headers=["*"],
        )

        # Root endpoint
        @app.get("/")
        async def root():
            return {"message": "Welcome to the Women's Health Assistant API"}

        # Health check endpoint
        @app.get("/health")
        async def health_check():
            return {"status": "healthy"}

        # Include route modules
        chat_router = create_chat_routes(self)
        doc_router = create_document_routes(self)

        app.include_router(chat_router)
        app.include_router(doc_router)
        app.include_router(prompts_router)

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


def create_app() -> FastAPI:
    """
    Factory function to create and return the FastAPI application
    """
    api = HealthAssistantAPI()
    return api.create_app()