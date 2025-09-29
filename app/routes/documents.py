from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from pathlib import Path
from datetime import datetime
import shutil
import os
import logging

from app.models import DocumentListResponse, DocumentInfo, UploadResponse
from app.utils.prepare_vectordb import get_vectorstore
from app.config import DOCS_FOLDER

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["documents"])


def create_document_routes(app_instance):
    """Create document-related routes with app instance dependency"""

    @router.get("", response_model=DocumentListResponse)
    async def list_documents():
        docs_path = Path(DOCS_FOLDER)
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

    @router.post("/upload", response_model=UploadResponse)
    async def upload_document(file: UploadFile = File(...)):
        logger.info(f"Received upload request for file: {file.filename}")

        # Validate file type
        if not file.filename.lower().endswith('.pdf'):
            logger.warning(f"Invalid file type uploaded: {file.filename}")
            raise HTTPException(status_code=400, detail="Only PDF files are allowed")

        # Create docs directory if it doesn't exist
        docs_path = Path(DOCS_FOLDER)
        docs_path.mkdir(exist_ok=True)

        # Save the file
        file_path = docs_path / file.filename
        try:
            logger.info(f"Saving file to: {file_path}")
            with open(file_path, "wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            logger.info(f"File saved successfully: {file.filename}")

            # Reload vector database with new document
            app_instance.upload_docs = [f for f in os.listdir(DOCS_FOLDER) if f.lower().endswith('.pdf')]
            logger.info(f"Found {len(app_instance.upload_docs)} PDF documents, rebuilding vector database...")

            try:
                app_instance.vectordb = get_vectorstore(app_instance.upload_docs)
                logger.info(f"Document {file.filename} indexed successfully")
                return UploadResponse(
                    message=f"Document {file.filename} uploaded and indexed successfully",
                    filename=file.filename
                )
            except Exception as embedding_error:
                # File uploaded but embedding failed
                error_msg = str(embedding_error)
                logger.error(f"Embedding failed for {file.filename}: {error_msg}")

                if "quota" in error_msg.lower() or "429" in error_msg:
                    logger.warning(f"API quota exceeded during indexing of {file.filename}")
                    return UploadResponse(
                        message=f"Document {file.filename} uploaded but indexing failed due to API quota limits. Please rebuild embeddings later.",
                        filename=file.filename
                    )
                elif "rate" in error_msg.lower():
                    logger.warning(f"Rate limit exceeded during indexing of {file.filename}")
                    return UploadResponse(
                        message=f"Document {file.filename} uploaded but indexing failed due to rate limits. Please wait and rebuild embeddings.",
                        filename=file.filename
                    )
                else:
                    logger.error(f"Unexpected embedding error for {file.filename}: {error_msg}")
                    return UploadResponse(
                        message=f"Document {file.filename} uploaded but indexing failed: {error_msg}. Please rebuild embeddings manually.",
                        filename=file.filename
                    )

        except Exception as e:
            logger.error(f"Failed to upload file {file.filename}: {str(e)}")
            # Clean up file if it was created but processing failed
            if file_path.exists():
                try:
                    file_path.unlink()
                    logger.info(f"Cleaned up failed upload file: {file.filename}")
                except:
                    logger.warning(f"Failed to clean up file: {file.filename}")
                    pass
            raise HTTPException(status_code=500, detail=f"Failed to upload file: {str(e)}")

    @router.delete("/{filename}")
    async def delete_document(filename: str):
        file_path = Path(DOCS_FOLDER) / filename

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Document not found")

        try:
            file_path.unlink()

            # Reload vector database without deleted document
            app_instance.upload_docs = os.listdir(DOCS_FOLDER)
            if app_instance.upload_docs:
                app_instance.vectordb = get_vectorstore(app_instance.upload_docs)
            else:
                app_instance.vectordb = None

            return {"message": f"Document {filename} deleted successfully"}
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to delete file: {str(e)}")

    @router.get("/{filename}/download")
    async def download_document(filename: str):
        file_path = Path(DOCS_FOLDER) / filename

        if not file_path.exists():
            raise HTTPException(status_code=404, detail="Document not found")

        return FileResponse(
            path=str(file_path),
            filename=filename,
            media_type='application/pdf'
        )

    @router.post("/rebuild-embeddings")
    async def rebuild_embeddings():
        logger.info("Starting embeddings rebuild process...")

        try:
            # Get current PDF documents in docs folder
            all_files = os.listdir(DOCS_FOLDER)
            app_instance.upload_docs = [f for f in all_files if f.lower().endswith('.pdf')]
            logger.info(f"Found {len(app_instance.upload_docs)} PDF documents for rebuilding: {app_instance.upload_docs}")

            if not app_instance.upload_docs:
                logger.warning("No PDF documents found in docs folder")
                raise HTTPException(status_code=400, detail="No PDF documents found in docs folder")

            # Rebuild vector database with retry logic
            try:
                logger.info("Starting vector database rebuild...")
                app_instance.vectordb = get_vectorstore(app_instance.upload_docs, from_session_state=False)
                logger.info(f"Embeddings rebuilt successfully for {len(app_instance.upload_docs)} documents")
                return {
                    "message": f"Embeddings rebuilt successfully for {len(app_instance.upload_docs)} documents",
                    "documents_processed": app_instance.upload_docs
                }
            except Exception as embedding_error:
                error_msg = str(embedding_error)
                logger.error(f"Embedding rebuild failed: {error_msg}")

                if "quota" in error_msg.lower() or "429" in error_msg:
                    logger.warning("API quota exceeded during rebuild")
                    raise HTTPException(
                        status_code=429,
                        detail="API quota exceeded. Please check your Google API billing and quota limits, then try again later."
                    )
                elif "rate" in error_msg.lower():
                    logger.warning("Rate limit exceeded during rebuild")
                    raise HTTPException(
                        status_code=429,
                        detail="Rate limit exceeded. Please wait a few minutes and try again."
                    )
                else:
                    logger.error(f"Unexpected error during rebuild: {error_msg}")
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to create embeddings: {error_msg}"
                    )

        except HTTPException:
            # Re-raise HTTP exceptions as-is
            raise
        except Exception as e:
            logger.error(f"General error during embeddings rebuild: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Error rebuilding embeddings: {str(e)}")

    return router