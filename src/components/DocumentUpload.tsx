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
    } catch (error: unknown) {
      console.error('Upload error:', error);
      const err = error as { response?: { data?: { detail?: string } } };
      toast.error(err.response?.data?.detail || 'Failed to upload document');
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
        className={`relative border-2 border-dashed rounded-[var(--md-sys-shape-corner-xl)] p-12 text-center cursor-pointer transition-all duration-200 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
        style={{
          background: isDragActive ? 'color-mix(in oklab, var(--md-sys-color-primary) 6%, var(--md-sys-color-surface))' : 'var(--md-sys-color-surface)',
          borderColor: isDragActive ? 'var(--md-sys-color-primary)' : 'var(--md-sys-color-outline-variant)',
          boxShadow: isDragActive ? 'var(--md-elev-2)' : 'none'
        }}
      >
        <input {...getInputProps()} />

        <div className="space-y-5">
          {uploading ? (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl" style={{ background: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}>
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <div className="space-y-3">
                <p className="text-lg font-medium">Uploading document...</p>
                <div className="max-w-xs mx-auto">
                <div className="w-full rounded-full h-2 overflow-hidden" style={{ background: 'var(--md-sys-color-surface-container)' }}>
                    <div className="h-2 rounded-full animate-pulse" style={{ width: '60%', background: 'var(--md-sys-color-primary)' }}></div>
                </div>
                </div>
              </div>
            </>
          ) : isDragActive ? (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl" style={{ background: 'var(--md-sys-color-primary-container)', color: 'var(--md-sys-color-on-primary-container)' }}>
                <FileText className="w-8 h-8" />
              </div>
              <div>
                <p className="text-lg font-medium">Drop your file here</p>
              </div>
            </>
          ) : (
            <>
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl" style={{ background: 'var(--md-sys-color-surface-container-high)', color: 'color-mix(in oklab, var(--md-sys-color-on-surface) 70%, transparent)' }}>
                <Upload className="w-8 h-8" />
              </div>
              <div className="space-y-2">
                <p className="text-lg font-medium">
                  Drop your PDF file here
                </p>
                <p className="text-sm opacity-70">
                  or click to browse
                </p>
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'var(--md-sys-color-surface-container-high)' }}>
                <FileText className="w-4 h-4" />
                <span className="text-xs font-medium" style={{ color: 'color-mix(in oklab, var(--md-sys-color-on-surface) 70%, transparent)' }}>PDF files only</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
