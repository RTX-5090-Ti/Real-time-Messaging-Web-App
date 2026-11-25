import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthCard from "../components/auth/AuthCard";
import { AuthAPI } from "../api/auth.api.js";
import { unauthenticated } from "../api/sessionClient.js";
import SessionStatus from "../components/auth/SessionStatus.jsx";

export default function AuthPage() {
  const [rightPanelActive, setRightPanelActive] = useState(false);
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const onEnded = () => {
      cancelled = true;
      setStatus("guest");
    };
    window.addEventListener("auth:ended", onEnded);
    AuthAPI.me().then(({ data }) => {
      if (cancelled) return;
      if (!data?.user) { setStatus("error"); return; }
      navigate("/home", { replace: true });
    }).catch(error => {
      if (cancelled) return;
      if (error?.code === "STALE_SESSION") {
        setAttempt(value => value + 1);
        return;
      }
      setStatus(unauthenticated(error) ? "guest" : "error");
    });
    return () => { cancelled = true; window.removeEventListener("auth:ended", onEnded); };
  }, [navigate, attempt]);

  const handleSignInSuccess = () => {
    navigate("/home");
  };

  if (status !== "guest") return <SessionStatus error={status === "error"} onRetry={() => {
    setStatus("loading"); setAttempt(value => value + 1);
  }} />;
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-gradient-to-r from-[#b06ab3] to-[#4568dc]">
      <AuthCard
        rightPanelActive={rightPanelActive}
        onSignIn={() => setRightPanelActive(false)}
        onSignUp={() => setRightPanelActive(true)}
        onSignInSuccess={handleSignInSuccess}
      />
    </div>
  );
}
