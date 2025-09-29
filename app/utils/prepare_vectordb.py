from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_google_genai._common import GoogleGenerativeAIError
from dotenv import load_dotenv
import os
import time
import logging
from app.config import DOCS_FOLDER

# Configure logger for this module
logger = logging.getLogger(__name__)

def extract_pdf_text(pdfs):
    """
    Extract text from PDF documents

    Parameters:
    - pdfs (list): List of PDF documents

    Returns:
    - docs: List of text extracted from PDF documents
    """
    logger.info(f"Starting PDF text extraction for {len(pdfs)} documents")
    docs = []
    for pdf in pdfs:
        pdf_path = os.path.join(DOCS_FOLDER, pdf)
        logger.debug(f"Extracting text from: {pdf}")
        try:
            # Load text from the PDF and extend the list of documents
            loaded_docs = PyPDFLoader(pdf_path).load()
            docs.extend(loaded_docs)
            logger.info(f"Successfully extracted {len(loaded_docs)} pages from {pdf}")
        except Exception as e:
            logger.error(f"Failed to extract text from {pdf}: {str(e)}")
            raise

    logger.info(f"PDF text extraction completed. Total documents: {len(docs)}")
    return docs

def get_text_chunks(docs):
    """
    Split text into chunks

    Parameters:
    - docs (list): List of text documents

    Returns:
    - chunks: List of text chunks
    """
    logger.info(f"Starting text chunking for {len(docs)} documents")
    # Chunk size is configured to be an approximation to the model limit of 2048 tokens
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=8000, chunk_overlap=800, separators=["\n\n", "\n", " ", ""])
    chunks = text_splitter.split_documents(docs)
    logger.info(f"Text chunking completed. Created {len(chunks)} chunks from {len(docs)} documents")
    return chunks

def get_vectorstore(pdfs, max_retries=3, retry_delay=5):
    """
    Create or retrieve a vectorstore from PDF documents with error handling

    Parameters:
    - pdfs (list): List of PDF documents
    - max_retries (int): Maximum number of retries for embedding failures. Defaults to 3
    - retry_delay (int): Delay in seconds between retries. Defaults to 5

    Returns:
    - vectordb or None: The created or retrieved vectorstore. Returns None if loading from session state and the database does not exist

    Raises:
    - Exception: If embedding creation fails after all retries
    """
    # - from_session_state (bool, optional): Flag indicating whether to load from session state. Defaults to False
    load_dotenv()
    from_session_state = os.getenv("FROM_SESSION_STATE").lower() == "true"
    logger.info(f"Creating vectorstore for {len(pdfs)} PDFs (from_session_state={from_session_state})")
    embedding = GoogleGenerativeAIEmbeddings(model=os.getenv("EMBEDDING_MODEL"))

    vector_db_path = "data/vector_db"

    if from_session_state and os.path.exists(vector_db_path):
        logger.info("Existing vector database found, attempting to load...")
        try:
            vectordb = Chroma(persist_directory=vector_db_path, embedding_function=embedding)
            logger.info("Successfully loaded existing vector database")
            return vectordb
        except Exception as e:
            logger.warning(f"Failed to load existing vector database: {e}")
            logger.info("Will attempt to create new vector database")

    if not from_session_state or not os.path.exists(vector_db_path):
        logger.info("Creating new vector database from documents...")
        docs = extract_pdf_text(pdfs)
        chunks = get_text_chunks(docs)

        logger.info(f"Starting embedding creation with {len(chunks)} chunks (max_retries={max_retries})")
        
        for attempt in range(max_retries):
            try:
                logger.info(f"Embedding attempt {attempt + 1}/{max_retries}")
                vectordb = Chroma.from_documents(
                    documents=chunks,
                    embedding=embedding,
                    persist_directory=vector_db_path
                )
                logger.info(f"Successfully created vector database on attempt {attempt + 1}")
                return vectordb

            except Exception as e:
                if attempt < max_retries - 1:
                    wait_time = retry_delay * (2 ** attempt)  # Exponential backoff
                    logger.warning(f"Embedding attempt {attempt + 1} failed: {str(e)}. Retrying in {wait_time} seconds...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"Failed to create embeddings after {max_retries} attempts: {str(e)}")
                    raise Exception(f"Failed to create embeddings after {max_retries} attempts: {e}")

    return None

# if __name__ == "__main__":
#     # Ensure the docs folder exists
#     if not os.path.exists("docs"):
#         os.makedirs("docs")
#         print("Created 'docs' directory. Please add PDF documents to this folder.")
#     else:
#         # Get list of PDF files in the docs folder
#         pdf_files = [f for f in os.listdir("docs") if f.lower().endswith('.pdf')]
        
#         if not pdf_files:
#             print("No PDF documents found in the 'docs' folder. Please add documents before running.")
#         else:
#             print(f"Found {len(pdf_files)} PDF documents. Preparing vector database...")
#             vectordb = get_vectorstore(pdf_files)
#             print("Vector database preparation complete.")