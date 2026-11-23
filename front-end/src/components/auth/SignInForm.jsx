import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import GradientButton from "./GradientButton";
import TextInput from "./TextInput";
import { AuthAPI } from "../../api/auth.api.js";

export default function SignInForm({ onSignUp, onSuccess }) {
  const [showForgotToast, setShowForgotToast] = useState(false);
  const [toastVersion, setToastVersion] = useState(0);
  const toastTimer = useRef(null);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleForgotPassword = () => {
    clearTimeout(toastTimer.current);
    setToastVersion(value => value + 1);
    setShowForgotToast(true);
    toastTimer.current = setTimeout(() => setShowForgotToast(false), 3000);
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError("");

    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }

    try {
      setSubmitting(true);
      const { data } = await AuthAPI.login(email.trim(), password);
      onSuccess?.(data?.user);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Login failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-full bg-white">
      <form
        onSubmit={handleSubmit}
        className="w-full h-full flex flex-col items-center justify-center px-12 max-md:px-6 transform-gpu [transform:translateZ(0)]"
      >
        <h1 className="font-bold text-[32px] mb-4 subpixel-antialiased">
          Sign In
        </h1>

        <TextInput
          type="email"
          placeholder="Email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextInput
          type="password"
          placeholder="Password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? (
          <p className="w-full mt-2 text-sm text-left text-red-600">{error}</p>
        ) : null}

        {/* đổi thành button để khỏi nhảy trang */}
        <button
          type="button"
          onClick={handleForgotPassword}
          className="text-[14px] text-[#333] my-4 hover:underline cursor-pointer"
        >
          Forgot your password?
        </button>

        <GradientButton
          onClick={handleSubmit}
          label={submitting ? "Signing In..." : "Sign In"}
          disabled={submitting}
        />

        <p className="hidden max-md:block mt-4 text-[14px]">
          Don&apos;t have an account?
          <button
            type="button"
            onClick={onSignUp}
            className="ml-2 font-bold text-[#4568dc] active:scale-[0.98]"
          >
            Sign Up
          </button>
        </p>
      </form>

      {createPortal(
        <div className="pointer-events-none fixed inset-x-4 z-[300] flex justify-center" style={{ bottom: "max(24px, env(safe-area-inset-bottom))" }} role="status" aria-live="polite" aria-atomic="true">
          {showForgotToast && (
            <div key={toastVersion} className="auth-feature-toast relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/80 bg-white/95 p-4 shadow-[0_12px_40px_-10px_rgba(65,32,115,0.4)] backdrop-blur-xl">
              <p className="text-center text-sm leading-5 text-[#513a83]">Tính năng này đang được phát triển</p>
              <div className="absolute inset-x-0 bottom-0 h-[3px] bg-violet-100" aria-hidden="true">
                <div className="auth-feature-toast-progress h-full origin-left bg-gradient-to-r from-[#b06ab3] to-[#4568dc]" />
              </div>
            </div>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
