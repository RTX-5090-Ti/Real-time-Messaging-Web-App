import { useState } from "react";
import { useNavigate } from "react-router-dom";
import AuthCard from "../components/auth/AuthCard";

export default function AuthPage() {
  const [rightPanelActive, setRightPanelActive] = useState(false);
  const navigate = useNavigate();

  const handleSignInSuccess = () => {
    navigate("/home");
  };

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
