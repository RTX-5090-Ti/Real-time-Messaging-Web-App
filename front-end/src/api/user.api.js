import { api } from "./axios.js";

export const UserAPI = {
  me: () => api.get("/users/me"),

  getById: (id) => api.get(`/users/${id}`),

  updateMe: (payload) => api.patch("/users/me", payload),

  updateAvatar: (file) => {
    const fd = new FormData();
    fd.append("file", file); //  match uploadSingle (multer field "file")
    return api.patch("/users/me/avatar", fd);
  },
};
