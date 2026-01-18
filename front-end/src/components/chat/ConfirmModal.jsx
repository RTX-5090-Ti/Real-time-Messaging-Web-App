import { useEffect } from "react";

export default function ConfirmModal({
  open,
  title = "Confirm",
  description = "",
  confirmText = "Confirm",
  cancelText = "Cancel",
  loading = false,
  onConfirm,
  onCancel,
}) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onCancel?.();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[220]">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !loading && onCancel?.()}
      />

      <div className="absolute inset-0 grid p-4 place-items-center">
        <div className="w-full max-w-[380px] rounded-2xl bg-white border border-zinc-200 shadow-xl p-5">
          <h3 className="text-base font-bold text-zinc-900">{title}</h3>
          {description ? (
            <p className="mt-2 text-sm text-zinc-600">{description}</p>
          ) : null}

          <div className="flex items-center justify-end gap-2 mt-5">
            <button
              type="button"
              className="h-10 px-4 text-sm font-semibold border rounded-xl border-zinc-200 hover:bg-zinc-50 text-zinc-700 disabled:opacity-50"
              onClick={() => onCancel?.()}
              disabled={loading}
            >
              {cancelText}
            </button>

            <button
              type="button"
              className="h-10 px-4 text-sm font-semibold text-white bg-red-600 rounded-xl hover:bg-red-700 disabled:opacity-60"
              onClick={() => onConfirm?.()}
              disabled={loading}
            >
              {loading ? "Processing..." : confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
