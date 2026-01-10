import { useEffect, useState } from "react";

export default function ForgotPasswordModal({ open, onClose, onSubmit }) {
  const [email, setEmail] = useState("");
  const [newPass, setNewPass] = useState("");
  const [rePass, setRePass] = useState("");

  // đóng bằng ESC
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit?.({ email, newPassword: newPass, reEnterPassword: rePass });
  };

  return (
    <div
      className={[
        "fixed inset-0 z-[200] flex items-center justify-center px-4",
        "transition-opacity duration-300",
        open ? "opacity-100" : "opacity-0 pointer-events-none",
      ].join(" ")}
      aria-hidden={!open}
    >
      {/* overlay */}
      <div
        className={[
          "absolute inset-0 bg-black/50",
          "transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={onClose}
      />

      {/* modal box */}
      <div
        className={[
          "relative w-full max-w-md rounded-2xl bg-white shadow-2xl",
          "p-6",
          "transition-all duration-300 ease-out",
          open
            ? "translate-y-0 scale-100 opacity-100"
            : "translate-y-3 scale-95 opacity-0",
        ].join(" ")}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="mb-1 text-xl font-bold">Change password</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Enter your email and a new password.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            className="w-full px-4 py-3 outline-none rounded-xl bg-zinc-100 focus:ring-2 focus:ring-indigo-400"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <input
            type="password"
            placeholder="New password"
            className="w-full px-4 py-3 outline-none rounded-xl bg-zinc-100 focus:ring-2 focus:ring-indigo-400"
            value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
          />

          <input
            type="password"
            placeholder="Re-enter the new password"
            className="w-full px-4 py-3 outline-none rounded-xl bg-zinc-100 focus:ring-2 focus:ring-indigo-400"
            value={rePass}
            onChange={(e) => setRePass(e.target.value)}
          />

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-zinc-200 py-3 font-semibold hover:bg-zinc-50 active:scale-[0.99] cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="flex-1 rounded-xl py-3 font-semibold text-white
                         bg-gradient-to-r from-[#6441a5] via-[#2a0845] to-[#6441a5]
                         hover:opacity-95 active:scale-[0.99] cursor-pointer"
            >
              Change password
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
