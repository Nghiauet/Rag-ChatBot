# Migration Summary: Python FastAPI → Next.js Full Stack

## Overview
Successfully migrated the Women's Health Assistant RAG ChatBot from a Python/FastAPI backend + Next.js frontend architecture to a **fully unified Next.js application**.

## What Was Migrated

### Python Backend (app/) → Next.js API Routes (src/app/api/)

#### Core Utilities
- **`app/utils/prepare_vectordb.py`** → **`src/lib/vectordb.ts`**
  - PDF text extraction using LangChain.js PDFLoader
  - Text chunking with RecursiveCharacterTextSplitter
  - ChromaDB vector store creation and retrieval

- **`app/utils/chatbot.py`** → **`src/lib/chatbot.ts`**
  - RAG chain with Google Gemini (LangChain.js)
  - Session-based chat history management
  - Prompt configuration loading from YAML

- **`app/config.py`** → **`src/lib/config.ts`**
  - Environment variable configuration
  - Path constants

- **`app/models.py`** → **`src/lib/types.ts`**
  - Pydantic models → Zod schemas
  - TypeScript type definitions

#### API Endpoints
All FastAPI routes converted to Next.js API routes:

**Documents Management**:
- `GET /api/documents` - List all PDF documents
- `POST /api/documents/upload` - Upload new PDF
- `DELETE /api/documents/[filename]` - Delete document
- `GET /api/documents/[filename]/download` - Download document
- `POST /api/documents/rebuild-embeddings` - Rebuild vector embeddings

**Chat/RAG**:
- `POST /api/query` - Ask questions with RAG
- `GET /api/history/[sessionId]` - Get chat history
- `DELETE /api/history/[sessionId]` - Clear chat history

**Prompts**:
- `GET /api/prompts` - Get prompt configuration
- `PUT /api/prompts` - Update prompts

**Initialization**:
- `POST /api/init` - Initialize vector database
- `GET /api/init` - Check initialization status

### New Components
- **`src/lib/sessionManager.ts`** - Centralized session and vector DB management

## Technology Stack Changes

### Backend
| Before | After |
|--------|-------|
| Python 3.13 | Node.js (Next.js 15) |
| FastAPI | Next.js API Routes |
| Uvicorn | Next.js Dev Server |
| langchain (Python) | langchain (JavaScript) |
| chromadb (Python) | chromadb (JavaScript client) |
| PyPDF | @langchain/community PDFLoader |
| Pydantic | Zod |
| python-dotenv | Next.js env support |

### Frontend
- No changes needed - already using Next.js 15
- Updated `src/lib/api.ts` to use relative paths instead of `http://localhost:8301`

## Key Architectural Changes

1. **Single Server**: One Next.js server handles both UI and API (previously: Python backend on 8301 + Next.js on 3000)

2. **No CORS**: Same-origin requests eliminate CORS configuration

3. **Unified Deployment**: Deploy as single Next.js app instead of managing two separate services

4. **Environment Variables**: Consolidated into `frontend/.env`

5. **TypeScript Throughout**: Type safety across frontend and backend

## Dependencies Installed
```bash
langchain @langchain/community @langchain/google-genai chromadb pdf-parse js-yaml zod uuid @types/js-yaml
```

## Configuration

### Environment Variables (`frontend/.env`)
```env
GOOGLE_API_KEY=<your-key>
MODEL=models/gemini-flash-lite-latest
EMBEDDING_MODEL=models/text-embedding-004
LOG_LEVEL=info
```

### Data Directories
All data paths reference the parent directory (project root):
- `../data/docs` - PDF documents
- `../data/vector_db` - ChromaDB persistence
- `../data/prompts.yaml` - Prompt configurations

## Breaking Changes / Important Notes

1. **ChromaDB Client Mode**: The JavaScript version requires a running ChromaDB server (default: `http://localhost:8000`). The Python version used file-based persistence.

2. **Async Params in Next.js 15**: Dynamic route params are now Promises and must be awaited.

3. **Session Storage**: In-memory session storage (same as before). For production, consider Redis.

4. **Initialization**: Vector database must be initialized before use:
   - Call `POST /api/init` on server start
   - Or rebuild embeddings via `POST /api/documents/rebuild-embeddings`

## Running the Application

### Development
```bash
cd frontend
npm run dev
```
Server runs on `http://localhost:3000`

### Production
```bash
cd frontend
npm run build
npm start
```

## Next Steps (Recommended)

1. **Start ChromaDB Server** (if not running):
   ```bash
   docker run -p 8000:8000 chromadb/chroma
   ```

2. **Initialize Vector DB**:
   - Upload PDFs via UI
   - Click "Rebuild Embeddings"
   - Or call `POST /api/init`

3. **Remove Python Backend**:
   - Can safely delete `app/` directory
   - Remove `pyproject.toml`, `uv.lock`, `.venv`

4. **Production Considerations**:
   - Configure persistent ChromaDB storage
   - Add Redis for session management
   - Set up proper logging
   - Configure error monitoring

## Files Created/Modified

### Created
- `frontend/src/lib/types.ts`
- `frontend/src/lib/config.ts`
- `frontend/src/lib/vectordb.ts`
- `frontend/src/lib/chatbot.ts`
- `frontend/src/lib/sessionManager.ts`
- `frontend/src/app/api/documents/route.ts`
- `frontend/src/app/api/documents/upload/route.ts`
- `frontend/src/app/api/documents/[filename]/route.ts`
- `frontend/src/app/api/documents/[filename]/download/route.ts`
- `frontend/src/app/api/documents/rebuild-embeddings/route.ts`
- `frontend/src/app/api/query/route.ts`
- `frontend/src/app/api/history/[sessionId]/route.ts`
- `frontend/src/app/api/prompts/route.ts`
- `frontend/src/app/api/init/route.ts`
- `frontend/.env`
- `frontend/MIGRATION_SUMMARY.md`

### Modified
- `frontend/src/lib/api.ts` - Removed hardcoded backend URL

## Migration Complete ✅

The application is now a fully unified Next.js application with server-side RAG capabilities. All Python backend functionality has been successfully converted to TypeScript and integrated into the Next.js API routes.
