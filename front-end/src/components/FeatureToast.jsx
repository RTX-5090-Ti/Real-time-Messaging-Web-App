import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// Mount with a new key to restart the three-second toast on repeated clicks.
export default function FeatureToast() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  return createPortal(
    <div className="pointer-events-none fixed inset-x-4 z-[300] flex justify-center" style={{ bottom: "max(24px, env(safe-area-inset-bottom))" }} role="status" aria-live="polite" aria-atomic="true">
      {visible && (
        <div className="auth-feature-toast relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-4 shadow-[0_12px_40px_-10px_rgba(65,32,115,0.4)] backdrop-blur-xl">
          <p className="text-center text-sm leading-5 text-[#513a83]">Tính năng này đang được phát triển</p>
          <div className="absolute inset-x-0 bottom-0 h-[3px] bg-violet-100" aria-hidden="true">
            <div className="auth-feature-toast-progress h-full origin-left bg-gradient-to-r from-[#b06ab3] to-[#4568dc]" />
          </div>
        </div>
      )}
    </div>, document.body,
  );
}
