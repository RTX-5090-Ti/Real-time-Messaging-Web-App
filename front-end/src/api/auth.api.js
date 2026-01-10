import { api } from "./axios.js";

export const AuthAPI = {
  login: (email, password) => api.post("/auth/login", { email, password }),
  register: (name, email, password) =>
    api.post("/auth/register", { name, email, password }),
  me: () => api.get("/auth/me"),
  logout: () => api.post("/auth/logout"),
};
