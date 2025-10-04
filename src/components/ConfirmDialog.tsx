'use client';

import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
}

export default function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'warning'
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const variantStyles = {
    danger: {
      icon: 'bg-red-100 text-red-600',
      button: 'bg-red-600 hover:bg-red-700 hover:shadow-lg hover:shadow-red-600/30'
    },
    warning: {
      icon: 'bg-amber-100 text-amber-600',
      button: 'bg-amber-600 hover:bg-amber-700 hover:shadow-lg hover:shadow-amber-600/30'
    },
    info: {
      icon: 'bg-blue-100 text-blue-600',
      button: 'bg-blue-600 hover:bg-blue-700 hover:shadow-lg hover:shadow-blue-600/30'
    }
  };

  const styles = variantStyles[variant];

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="max-w-md w-full animate-in zoom-in-95 duration-200 elevation-3"
        style={{
          background: 'var(--md-sys-color-surface)',
          border: '1px solid var(--md-sys-color-outline-variant)',
          borderRadius: 'var(--md-sys-shape-corner-xl)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-6 pb-3">
          <div className="flex items-start gap-4">
            <div
              className={`flex items-center justify-center w-12 h-12 rounded-[var(--md-sys-shape-corner-xl)] ${styles.icon}`}
            >
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-medium mb-2" style={{ color: 'var(--md-sys-color-on-surface)' }}>
                {title}
              </h3>
              <p className="text-sm leading-relaxed" style={{ color: 'color-mix(in oklab, var(--md-sys-color-on-surface) 80%, transparent)' }}>
                {message}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="m3-icon-btn"
            title="Close"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ background: 'var(--md-sys-color-surface-container)' }}>
          <button
            onClick={onClose}
            className="m3-btn m3-btn--outline"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`m3-btn ${styles.button.includes('bg-red-') || styles.button.includes('bg-amber-') ? 'm3-btn--filled' : 'm3-btn--tonal'}`}
            style={styles.button.includes('bg-red-') || styles.button.includes('bg-amber-') ? {} : {}}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
