import { io } from "socket.io-client";
import { refreshSession, endSession } from "../api/axios.js";

const socketURL = import.meta.env.VITE_SOCKET_URL || import.meta.env.VITE_API_URL || "http://localhost:5000";
export const socket = io(socketURL, { withCredentials: true, autoConnect: false });
let ended = false;
let recovering = null;
let retryTimer;
const recover = () => {
  if (ended || recovering) return;
  recovering = refreshSession().then(() => {
    if (!ended && !socket.connected) socket.connect();
  }).catch(error => {
    if (error?.response?.status !== 401 && !ended) {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(recover, 5000);
    }
  }).finally(() => { recovering = null; });
};
socket.on("auth:expired", () => { socket.disconnect(); recover(); });
socket.on("auth:revoked", () => endSession());
socket.on("connect_error", error => {
  if (["NO_ACCESS_TOKEN", "ACCESS_EXPIRED"].includes(error.data?.code)) recover();
  else if (["SESSION_REVOKED", "INVALID_ACCESS_TOKEN"].includes(error.data?.code)) endSession();
});
window.addEventListener("auth:refreshed", () => {
  if (!ended && socket.connected) { socket.disconnect(); socket.connect(); }
});
window.addEventListener("auth:ended", () => {
  ended = true;
  clearTimeout(retryTimer);
  socket.disconnect();
});
window.addEventListener("auth:started", () => { ended = false; });
