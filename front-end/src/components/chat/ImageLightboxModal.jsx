import { useEffect } from "react";

export default function ImageLightboxModal({ open, src, alt, onClose }) {
  useEffect(() => {
    if (!open) return;

    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200]">
      {/* ✅ Overlay nằm dưới */}
      <div
        className="absolute inset-0 z-0 bg-black/70"
        onClick={() => onClose?.()}
      />

      {/* ✅ Close button nằm trên cùng */}
      <button
        type="button"
        className="absolute z-20 grid w-10 h-10 text-white rounded-full cursor-pointer top-4 right-4 place-items-center bg-black/50 hover:bg-black/60"
        onClick={(e) => {
          e.stopPropagation();
          onClose?.();
        }}
        title="Close"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M18 6L6 18M6 6l12 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* ✅ Ảnh nằm trên overlay */}
      <div className="absolute inset-0 z-10 grid p-6 place-items-center">
        <img
          src={src}
          alt={alt || "image"}
          className="max-h-[90vh] max-w-[92vw] object-contain rounded-2xl shadow-2xl"
          draggable={false}
        />
      </div>
    </div>
  );
}
