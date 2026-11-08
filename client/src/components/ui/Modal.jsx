import { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'max-w-lg',
}) {
  useEffect(() => {
    if (!isOpen) return undefined;
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-950/55 backdrop-blur-[2px] overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className={`relative w-full ${maxWidth} rounded-2xl bg-white border border-canvas-border shadow-xl my-8 overflow-hidden`}
      >
        <div className="h-1 w-full bg-gradient-to-r from-[#0F766E] via-sunshine to-coral" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3 border-b border-canvas-border px-6 py-4 bg-canvas/70">
          <div>
            <h2 id="modal-title" className="text-lg font-bold text-ink">
              {title}
            </h2>
            {description ? (
              <p className="mt-0.5 text-xs text-ink-body">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="inline-flex min-h-[40px] min-w-[40px] items-center justify-center rounded-xl text-ink-body transition-colors duration-150 hover:bg-canvas-subtle hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-6 max-h-[78vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

