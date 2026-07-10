import { Modal } from "./Modal";
import { btnDanger, btnPrimary, btnSecondary } from "../lib/ui";
import { Loader2 } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** destructive = red confirm button */
  variant?: "danger" | "primary";
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Lanjutkan",
  cancelLabel = "Batal",
  variant = "primary",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <Modal isOpen={open} onClose={loading ? () => {} : onClose} title={title} size="md">
      <p className="text-sm text-slate-600 leading-relaxed mb-6">{description}</p>
      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        <button
          type="button"
          disabled={loading}
          onClick={onClose}
          className={`${btnSecondary} w-full sm:w-auto`}
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => void onConfirm()}
          className={`${variant === "danger" ? btnDanger : btnPrimary} w-full sm:w-auto`}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
