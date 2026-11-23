import { api, logoutSession, loginSucceeded } from "./axios.js";

export const AuthAPI = {
  login: async (email, password) => { const result = await api.post("/auth/login", { email, password }); loginSucceeded(); return result; },
  register: async (name, email, password) => { const result = await api.post("/auth/register", { name, email, password }); loginSucceeded(); return result; },
  me: () => api.get("/auth/me"),
  logout: () => logoutSession(),
};
