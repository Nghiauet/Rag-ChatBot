'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { documentAPI } from '@/lib/api';
import toast from 'react-hot-toast';

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
      await documentAPI.uploadDocument(file);
      toast.success(`Document "${file.name}" uploaded successfully!`);
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
    <div className="w-full max-w-2xl mx-auto">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragActive ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
          ${uploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input {...getInputProps()} />

        <div className="space-y-4">
          <div className="text-6xl">📄</div>

          {uploading ? (
            <div className="space-y-2">
              <div className="text-lg font-medium text-gray-700">Uploading...</div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full animate-pulse w-1/2"></div>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-lg font-medium text-gray-700">
                {isDragActive ? 'Drop the PDF file here...' : 'Drag & drop a PDF file here'}
              </div>
              <div className="text-sm text-gray-500">
                or click to select a file
              </div>
              <div className="text-xs text-gray-400">
                Only PDF files are supported
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}