'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { documentAPI } from '@/lib/api';
import toast from 'react-hot-toast';
import { Upload, FileText, Loader2 } from 'lucide-react';

interface DocumentUploadProps {
  onUploadSuccess: () => void;
}

export default function DocumentUpload({ onUploadSuccess }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];

    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      toast.error('Only PDF files are allowed');
      return;
    }

    setUploading(true);

    try {
      const response = await documentAPI.uploadDocument(file);
      toast.success(response.message, { duration: 5000 });

      // Show additional warning about rebuilding embeddings
      setTimeout(() => {
        toast('Remember to rebuild embeddings to update the knowledge base', {
          duration: 6000,
          icon: '⚠️',
          style: {
            background: '#FEF3C7',
            color: '#92400E',
            border: '1px solid #FCD34D',
          },
        });
      }, 500);

      onUploadSuccess();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.detail || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  }, [onUploadSuccess]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    multiple: false,
    disabled: uploading
  });

  return (
    <div className="w-full max-w-3xl mx-auto">
      <div
        {...getRootProps()}
        className={`
          relative bg-white border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all duration-200
          ${isDragActive
            ? 'border-blue-500 bg-blue-50/50 shadow-lg shadow-blue-100'
            : 'border-gray-200 hover:border-blue-400 hover:bg-gray-50'
          }
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />

        <div className="space-y-5">
          {uploading ? (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <div className="space-y-3">
                <p className="text-lg font-medium text-gray-900">Uploading document...</p>
                <div className="max-w-xs mx-auto">
                  <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
                    <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: '60%' }}></div>
                  </div>
                </div>
              </div>
            </>
          ) : isDragActive ? (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl">
                <FileText className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-medium text-gray-900">Drop your file here</p>
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-2xl">
                <Upload className="w-8 h-8 text-gray-600" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium text-gray-900">
                  Drop your PDF file here
                </p>
                <p className="text-sm text-gray-500">
                  or click to browse
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-full">
                <FileText className="w-4 h-4 text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">PDF files only</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}