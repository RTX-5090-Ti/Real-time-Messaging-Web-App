import axios from "axios";
import { createSessionClient, installSessionInterceptor } from "./sessionClient.js";

const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000";
const raw = axios.create({ baseURL, withCredentials: true });
export const api = axios.create({ baseURL, withCredentials: true });
const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel("chat-session") : null;
export const session = createSessionClient(raw, {
  lock: work => navigator.locks?.request ? navigator.locks.request("chat-session-refresh", work) : Promise.resolve().then(work),
  notify: (event, detail) => {
    window.dispatchEvent(new CustomEvent(event, { detail }));
    if (event === "auth:ended" && detail?.broadcast !== false) channel?.postMessage("logout");
  },
});
if (channel) channel.onmessage = event => { if (event.data === "logout") session.ended(false); };
installSessionInterceptor(api, session);
export const refreshSession = () => session.refresh();
export const logoutSession = () => session.logout();
export const authenticateSession = (path, body) => session.authenticate(path, body);
export const endSession = () => session.ended();
