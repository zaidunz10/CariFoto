"use client";

import { useEffect } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: "primary" | "whatsapp" | "danger";
  hideCancel?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Lanjutkan",
  cancelLabel = "Batal",
  confirmVariant = "primary",
  hideCancel = false,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const confirmClass =
    confirmVariant === "whatsapp"
      ? "bg-[#25D366] hover:bg-[#1ebc5c] shadow-[#25D366]/25"
      : confirmVariant === "danger"
        ? "bg-rose-600 hover:bg-rose-500 shadow-rose-600/25"
        : "bg-[#7B4FE0] hover:bg-[#683ec9] shadow-[#7B4FE0]/25";

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-2xl border border-[#302A3A] bg-[#181520] p-5 text-white shadow-2xl"
      >
        <h3 id="confirm-dialog-title" className="text-base font-bold text-white">
          {title}
        </h3>
        <p className="mt-2 whitespace-pre-line text-xs leading-relaxed text-[#AAA1B8] sm:text-sm">
          {description}
        </p>

        <div className="mt-5 flex items-center justify-end gap-2">
          {!hideCancel && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#302A3A] bg-[#100E17] px-4 py-2 text-xs font-bold text-[#AAA1B8] transition hover:border-[#7B4FE0] hover:text-white"
            >
              {cancelLabel}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`rounded-xl px-4 py-2 text-xs font-bold text-white shadow-lg transition ${confirmClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
