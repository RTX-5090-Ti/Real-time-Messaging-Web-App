import { api, logoutSession, authenticateSession } from "./axios.js";

export const AuthAPI = {
  login: (email, password) => authenticateSession("/auth/login", { email, password }),
  register: (name, email, password) => authenticateSession("/auth/register", { name, email, password }),
  me: () => api.get("/auth/me"),
  logout: () => logoutSession(),
  sessions: () => api.get("/auth/sessions"),
  revokeSession: id => api.delete(`/auth/sessions/${id}`),
  revokeOtherSessions: () => api.post("/auth/sessions/revoke-others"),
};
