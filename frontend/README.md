# Document Management Frontend

A Next.js frontend for managing documents in the Women's Health Assistant RAG ChatBot system.

## Features

- **Document Upload**: Drag-and-drop interface for PDF uploads
- **Document List**: View all uploaded documents with metadata
- **Document Management**: Download and delete documents
- **Real-time Updates**: Automatic refresh after upload/delete operations
- **Responsive Design**: Mobile-friendly interface with Tailwind CSS

## Prerequisites

- Node.js 18+
- npm or yarn
- FastAPI backend running on `http://localhost:8300`

## Getting Started

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Usage

1. **Upload Documents**: Drag and drop PDF files or click to select
2. **View Documents**: See all uploaded files with size and upload date
3. **Download**: Click download button to save documents locally
4. **Delete**: Remove documents (with confirmation dialog)

## API Integration

The frontend connects to the FastAPI backend at `http://localhost:8300` with the following endpoints:

- `GET /api/documents` - List all documents
- `POST /api/documents/upload` - Upload new document
- `DELETE /api/documents/{filename}` - Delete document
- `GET /api/documents/{filename}/download` - Download document

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Styling**: Tailwind CSS
- **File Upload**: react-dropzone
- **HTTP Client**: axios
- **Notifications**: react-hot-toast
- **Language**: TypeScript
