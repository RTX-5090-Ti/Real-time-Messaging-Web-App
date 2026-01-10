import { useState } from "react";
import GradientButton from "./GradientButton";
import TextInput from "./TextInput";
import ForgotPasswordModal from "./ForgotPasswordModal";
import { AuthAPI } from "../../api/auth.api.js";

export default function SignInForm({ onSignUp, onSuccess }) {
  const [openForgot, setOpenForgot] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleChangePassword = (data) => {
    // TODO: gọi API change password ở đây
    console.log("Change password payload:", data);

    // đóng modal sau khi submit (demo)
    setOpenForgot(false);
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
      await AuthAPI.login(email.trim(), password);
      const { data } = await AuthAPI.me();
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
          onClick={() => setOpenForgot(true)}
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

      <ForgotPasswordModal
        open={openForgot}
        onClose={() => setOpenForgot(false)}
        onSubmit={handleChangePassword}
      />
    </div>
  );
}
