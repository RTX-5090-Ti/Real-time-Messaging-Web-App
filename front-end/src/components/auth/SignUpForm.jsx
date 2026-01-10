import { useState } from "react";
import GradientButton from "./GradientButton";
import TextInput from "./TextInput";
import { AuthAPI } from "../../api/auth.api.js";

export default function SignUpForm({ onSignIn }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    setError("");
    setSuccess("");

    if (!name.trim() || !email.trim() || !password) {
      setError("Please fill in all fields.");
      return;
    }

    try {
      setSubmitting(true);
      await AuthAPI.register(name.trim(), email.trim(), password);
      setSuccess("Account created. Please sign in.");
      onSignIn?.();
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        "Sign up failed. Please try again.";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-full bg-white">
      <form
        onSubmit={handleSubmit}
        className="transform-gpu [transform:translateZ(0)] flex flex-col items-center justify-center w-full h-full px-12 text-center max-md:px-6"
      >
        <h1 className="font-bold text-[32px] mb-4 subpixel-antialiased">
          Create Account
        </h1>

        <TextInput
          type="text"
          placeholder="Name"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error ? (
          <p className="w-full mt-2 text-sm text-left text-red-600">{error}</p>
        ) : null}
        {success ? (
          <p className="w-full mt-2 text-sm text-left text-emerald-600">
            {success}
          </p>
        ) : null}

        <GradientButton
          onClick={handleSubmit}
          label={submitting ? "Signing Up..." : "Sign Up"}
          disabled={submitting}
          type="submit"
        />

        <p className="hidden max-md:block mt-4 text-[14px]">
          Already have an account?
          <button
            type="button"
            onClick={onSignIn}
            className="ml-2 font-bold text-[#4568dc] active:scale-[0.98]"
          >
            Sign In
          </button>
        </p>
      </form>
    </div>
  );
}
