import { io } from "socket.io-client";

const socketURL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || "http://localhost:5000";

export const socket = io(socketURL, {
  withCredentials: true,
  autoConnect: false, // chỉ connect sau khi login/me ok
});
