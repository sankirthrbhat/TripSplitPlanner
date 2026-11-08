import { AlertTriangle } from 'lucide-react';
import { Button } from './Button';
import { Modal } from './Modal';

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm action',
  message = 'Are you sure you want to proceed?',
  confirmLabel = 'Confirm',
  isPending = false,
  variant = 'danger',
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} maxWidth="max-w-md">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-rose-100 p-2 text-rose-600 shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{message}</p>
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button variant="secondary" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button variant={variant} onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Processing...' : confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

