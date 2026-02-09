# Docker Quickstart Guide

Get your Women's Health Assistant up and running in 5 minutes with Docker!

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/install/) installed
- Google API key for Gemini ([Get it here](https://aistudio.google.com/app/apikey))
- ChromaDB Cloud account ([Sign up here](https://www.trychroma.com/))

## Quick Start

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Rag-ChatBot
```

### 2. Set Up Environment Variables

Copy the example environment file and fill in your API keys:

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
# Google AI Configuration
GOOGLE_API_KEY=your_google_api_key_here        # From https://aistudio.google.com/app/apikey
MODEL=gemini-1.5-flash                          # Or gemini-1.5-pro for better quality
EMBEDDING_MODEL=models/gemini-embedding-001

# ChromaDB Cloud Configuration
CHROMADB_API_KEY=your_chromadb_api_key         # From ChromaDB Cloud dashboard
CHROMADB_TENANT=your_tenant_id                 # From ChromaDB Cloud dashboard
CHROMADB_DATABASE=your_database_name           # From ChromaDB Cloud dashboard

# Optional
LOG_LEVEL=info
```

**Where to get credentials:**
- **Google API Key**: Visit [Google AI Studio](https://aistudio.google.com/app/apikey), sign in, and create a new API key
- **ChromaDB Cloud**: Sign up at [trychroma.com](https://www.trychroma.com/), create a database, and find your credentials in the dashboard

### 3. Build and Start the Application

```bash
docker-compose up -d --build
```

This will:
- Build the Docker image
- Start the container in the background
- Mount the `data/` directory for persistent storage

### 4. Initialize the Database

After the container starts, initialize the vector database with your documents:

```bash
curl -X POST http://localhost:3003/api/documents/rebuild-embeddings
```

### 5. Access the Application

Open your browser and navigate to:
```
http://localhost:3003
```

**Default credentials:**
- Username: `admin`
- Password: `admin123`

> **Note:** Change these credentials after first login for security!

## First Steps

Once logged in, you can:

1. **Upload Documents**: Go to the "Documents" tab and upload PDF files
2. **Add Web Sources**: Go to the "Web Sources" tab to add URLs for content indexing
3. **Configure Prompts**: Go to the "Prompts" tab to customize the AI assistant's behavior
4. **Rebuild Embeddings**: After uploading documents, click "Rebuild Embeddings" to index them

## Common Commands

### View Logs

```bash
docker-compose logs -f
```

### Restart the Service

```bash
docker-compose restart
```

### Stop the Application

```bash
docker-compose down
```

### Rebuild After Code Changes

```bash
docker-compose up -d --build
```

### Clear All Data (Fresh Start)

```bash
docker-compose down -v
rm -rf data/vector_db/*
docker-compose up -d --build
```

## Troubleshooting

### Container Fails Health Check

Wait 40-60 seconds after starting. The application needs time to initialize. Check logs:

```bash
docker-compose logs women-health-assistant-nextjs
```

### "No documents found" Error

Make sure to:
1. Upload at least one PDF or add a URL
2. Run the rebuild embeddings API call or use the "Rebuild Embeddings" button in the UI

### Port 3003 Already in Use

Change the port in `docker-compose.yml`:

```yaml
ports:
  - "8080:3000"  # Use 8080 instead of 3003
```

Then access the app at `http://localhost:8080`

### ChromaDB Connection Errors

Verify your credentials in `.env`:
- Check that `CHROMADB_API_KEY`, `CHROMADB_TENANT`, and `CHROMADB_DATABASE` are correct
- Ensure your ChromaDB Cloud database is active

### Google API Quota Exceeded

If you see quota errors:
- Wait a few minutes for the quota to reset
- Consider upgrading to `gemini-1.5-flash` (fewer tokens) or a paid plan
- Reduce the number of documents processed at once

## Production Deployment

For production use:

1. **Change Default Passwords**: Update `data/users.json` with secure credentials
2. **Use Environment-Specific .env**: Create `.env.production` with production values
3. **Enable HTTPS**: Put the application behind a reverse proxy (nginx, Caddy, etc.)
4. **Regular Backups**: Back up the `data/` directory regularly
5. **Monitor Logs**: Set up log aggregation and monitoring

## Need Help?

- Check the main [README.md](README.md) for detailed documentation
- Review logs: `docker-compose logs -f`
- Open an issue on GitHub if you encounter problems

---

**Enjoy your Women's Health Assistant!**
