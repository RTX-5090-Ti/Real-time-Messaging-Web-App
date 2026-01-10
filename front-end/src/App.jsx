import { Routes, Route, Navigate } from "react-router-dom";
import AuthPage from "./pages/AuthPage";
import ChatApp from "./pages/ChatPage";

export default function App() {
  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/home" element={<ChatApp />} />

      {/* default */}
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  );
}
