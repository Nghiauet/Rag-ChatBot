# Women's Health Assistant - RAG ChatBot

A specialized chatbot application for women's health information powered by Next.js, LangChain, and Google Gemini AI. This full-stack application combines a modern React frontend with server-side RAG (Retrieval-Augmented Generation) capabilities.

## 🌟 Features

- **Intelligent Q&A**: RAG-powered responses grounded in medical documents
- **Bilingual Support**: Handles both Vietnamese and English questions
- **Document Management**: Upload, download, and delete PDF documents
- **Vector Search**: ChromaDB-powered semantic search for relevant context
- **Session Management**: Conversation history tracking per session
- **Prompt Configuration**: Customizable system prompts via YAML
- **Authentication**: Secure login system with SHA-256 password hashing
- **Real-time Chat**: Interactive chat interface with source citations

## 🏗️ Technology Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **AI/ML**:
  - LangChain.js for RAG orchestration
  - Google Gemini (gemini-flash-lite-latest) for chat
  - Google Gemini embedding (gemini-embedding-001)
- **Vector Database**: ChromaDB Cloud
- **Styling**: Tailwind CSS 4
- **State Management**: React Context API
- **UI Components**: Custom components with Lucide icons

## 📋 Prerequisites

- Node.js 20+ and npm
- Google API key with Gemini API access
- ChromaDB Cloud account (or local ChromaDB server)

## 🚀 Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Rag-ChatBot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
# Google AI Configuration
GOOGLE_API_KEY=your-google-api-key-here

# Model Configuration
MODEL=models/gemini-flash-lite-latest
EMBEDDING_MODEL=models/gemini-embedding-001

# ChromaDB Cloud Configuration
CHROMADB_API_KEY=your-chromadb-api-key
CHROMADB_TENANT=your-tenant-id
CHROMADB_DATABASE=your-database-name

# Application Configuration
LOG_LEVEL=info
NODE_ENV=development
```

### 4. Prepare Your Documents

1. Place your PDF documents in the `data/docs/` folder
2. The application will process these documents for RAG

### 5. Run Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

### 6. Initialize Vector Database

On first run, initialize the vector database:
- Navigate to the Documents tab in the UI
- Upload your PDF documents
- Click "Rebuild Embeddings" button

Alternatively, call the initialization API:
```bash
curl -X POST http://localhost:3000/api/init
```

## 📁 Project Structure

```
Rag-ChatBot/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes (backend)
│   │   │   ├── auth/         # Authentication endpoints
│   │   │   ├── documents/    # Document management
│   │   │   ├── prompts/      # Prompt configuration
│   │   │   ├── query/        # RAG query endpoint
│   │   │   ├── history/      # Chat history
│   │   │   └── init/         # Vector DB initialization
│   │   ├── layout.tsx        # Root layout
│   │   ├── page.tsx          # Home page
│   │   └── globals.css       # Global styles
│   ├── components/            # React components
│   │   ├── Login.tsx         # Login form
│   │   ├── DocumentUpload.tsx
│   │   ├── DocumentList.tsx
│   │   ├── PromptManager.tsx
│   │   └── ConfirmDialog.tsx
│   ├── contexts/              # React contexts
│   │   └── AuthContext.tsx
│   ├── lib/                   # Utilities & core logic
│   │   ├── config.ts         # Configuration constants
│   │   ├── types.ts          # TypeScript types & Zod schemas
│   │   ├── vectordb.ts       # Vector database operations
│   │   ├── chatbot.ts        # RAG chain logic
│   │   ├── sessionManager.ts # Session management
│   │   └── api.ts            # API client functions
│   └── instrumentation.ts     # Next.js instrumentation
├── data/                      # Application data (not in git)
│   ├── docs/                 # PDF documents
│   ├── vector_db/            # ChromaDB persistence (if local)
│   ├── prompts.yaml          # System prompts
│   └── users.json            # User credentials
├── archived/                  # Legacy Python backend (reference)
├── public/                    # Static assets
├── Dockerfile                 # Docker configuration
├── docker-compose.yml         # Docker Compose setup
└── package.json              # Dependencies

```

## 🔌 API Endpoints

### Chat & RAG

- `POST /api/query` - Ask a question with RAG
  ```json
  {
    "question": "Your question here",
    "session_id": "optional-session-id"
  }
  ```

- `GET /api/history/[sessionId]` - Get chat history
- `DELETE /api/history/[sessionId]` - Clear chat history

### Documents

- `GET /api/documents` - List all documents
- `POST /api/documents/upload` - Upload PDF
- `DELETE /api/documents/[filename]` - Delete document
- `GET /api/documents/[filename]/download` - Download document
- `POST /api/documents/rebuild-embeddings` - Rebuild vector database

### Prompts

- `GET /api/prompts` - Get current prompts
- `PUT /api/prompts` - Update prompts

### Initialization

- `POST /api/init` - Initialize vector database
- `GET /api/init` - Check initialization status

### Authentication

- `POST /api/auth/login` - User login

## 🐳 Docker Deployment

### Quick Start with Docker (Recommended)

**New to Docker or want a 5-minute setup?**

**See [QUICKSTART_DOCKER.md](QUICKSTART_DOCKER.md) for a step-by-step guide!**

### Build and Run with Docker Compose

```bash
# Build and start the application
docker-compose up -d --build

# Initialize the vector database
curl -X POST http://localhost:3003/api/documents/rebuild-embeddings

# Access the application
# Open http://localhost:3003 in your browser

# View logs
docker-compose logs -f

# Restart the service
docker-compose restart

# Stop the application
docker-compose down
```

The application will be available at `http://localhost:3003`

### Build Docker Image Manually

```bash
docker build -t women-health-assistant:latest .
docker run -p 3003:3000 --env-file .env women-health-assistant:latest
```

### Docker Configuration

- **Port**: 3003 (external) → 3000 (internal)
- **Image**: `women-health-assistant:nextjs-0.0.2`
- **Health Check**: Automatic with 40s startup grace period
- **Volumes**: `./data` mounted to `/app/data` for persistence
- **Restart Policy**: `unless-stopped`

For detailed Docker troubleshooting, see the [QUICKSTART_DOCKER.md](QUICKSTART_DOCKER.md) guide.

## 📝 Configuration

### Prompt Configuration

Edit `data/prompts.yaml` to customize system prompts:

```yaml
rag_prompt_template: |
  Context: {context}

  Question: {question}

  Answer the question based on the context provided.

system_message: |
  You are a helpful medical assistant specializing in women's health.
```

### User Management

Edit `data/users.json` to manage users:

```json
{
  "users": [
    {
      "username": "admin",
      "password": "sha256-hashed-password",
      "name": "Administrator"
    }
  ]
}
```

Generate password hash:
```bash
echo -n "your-password" | sha256sum
```

## 🔧 Development

### Build for Production

```bash
npm run build
npm start
```

### Linting

```bash
npm run lint
```

### Type Checking

TypeScript will automatically check types during development and build.

## 🗂️ Data Persistence

- **Documents**: Stored in `data/docs/`
- **Vector Database**: ChromaDB Cloud (or local in `data/vector_db/`)
- **User Data**: `data/users.json`
- **Prompts**: `data/prompts.yaml`
- **Session Data**: In-memory (consider Redis for production)

## 🔐 Security Notes

- Never commit `.env` file to version control
- Store API keys securely
- Use strong passwords for user accounts
- In production, consider:
  - HTTPS/TLS encryption
  - Rate limiting
  - Redis for session management
  - Database for user management
  - Regular security audits

## 🐛 Troubleshooting

### ChromaDB Connection Issues
- Verify ChromaDB Cloud credentials in `.env`
- Check network connectivity
- For local ChromaDB: Ensure server is running on port 8000

### Documents Not Loading
- Check PDF files are in `data/docs/`
- Verify file permissions
- Rebuild embeddings via UI or API

### Build Errors
- Clear `.next` folder: `rm -rf .next`
- Clear node_modules: `rm -rf node_modules && npm install`
- Check Node.js version: `node --version` (should be 20+)

## 📚 Migration Note

This project was migrated from a Python/FastAPI backend to a unified Next.js full-stack application. The legacy Python code is preserved in the `archived/` folder for reference. See `archived/MIGRATION_SUMMARY.md` for details.

## 📄 License

[Your License Here]

## 🤝 Contributing

[Your Contributing Guidelines Here]

## 📞 Support

For issues and questions, please open a GitHub issue or contact the development team.
