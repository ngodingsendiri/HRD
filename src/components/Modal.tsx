import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { ReactNode } from "react";
import { cn } from "../lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Narrower modal for confirmations (default: form width). */
  size?: "md" | "lg" | "xl";
}

const sizeClass = {
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "xl",
}: ModalProps) {
  return (
    <Dialog.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        {/* Flat overlay — no heavy blur (AGENTS.md) */}
        <Dialog.Overlay className="fixed inset-0 z-40 bg-slate-900/40 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2",
            "border border-slate-200 bg-white p-4 sm:p-6",
            "rounded-none sm:rounded-xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto",
            "focus:outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "duration-200",
            sizeClass[size],
          )}
        >
          <div className="flex items-start justify-between gap-4 mb-4 pr-8">
            <Dialog.Title className="text-lg font-semibold tracking-tight text-slate-900">
              {title}
            </Dialog.Title>
          </div>
          <Dialog.Close
            className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 transition-colors focus:outline-none focus:ring-1 focus:ring-slate-900 active:scale-95"
            aria-label="Tutup"
          >
            <X className="h-4 w-4" />
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
