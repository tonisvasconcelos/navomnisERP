import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  destructive,
  loading,
  onConfirm,
  onCancel,
}: Props) {
  if (!open) {
    return null;
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl"
      >
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <div className="mt-2 text-sm text-slate-300">{message}</div>
        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded px-4 py-2 text-sm text-slate-300 hover:bg-slate-800"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded px-4 py-2 text-sm text-white ${
              destructive ? 'bg-red-700 hover:bg-red-600' : 'bg-indigo-600 hover:bg-indigo-500'
            } disabled:opacity-50`}
          >
            {loading ? 'A processar…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
