import { it, expect, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const handlers = new Map();
  const socket = { connected: false, on: vi.fn((name, fn) => handlers.set(name, fn)) };
  socket.connect = vi.fn(() => { socket.connected = true; });
  socket.disconnect = vi.fn(() => { socket.connected = false; });
  return { handlers, socket, refreshSession: vi.fn(), endSession: vi.fn() };
});
vi.mock("socket.io-client", () => ({ io: () => mocks.socket }));
vi.mock("../src/api/axios.js", () => ({ refreshSession: mocks.refreshSession, endSession: mocks.endSession }));

it("renews expired sockets, shares recovery and prevents reconnection after logout", async () => {
  await import("../src/socket/socket.js");
  let finish;
  mocks.refreshSession.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  mocks.socket.connected = true;
  mocks.handlers.get("auth:expired")();
  mocks.handlers.get("connect_error")({ data: { code: "ACCESS_EXPIRED" } });
  expect(mocks.socket.connected).toBe(false);
  expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
  finish();
  await vi.waitFor(() => expect(mocks.socket.connected).toBe(true));

  window.dispatchEvent(new Event("auth:refreshed"));
  expect(mocks.socket.connect).toHaveBeenCalledTimes(2);
  mocks.handlers.get("auth:expired")();
  window.dispatchEvent(new Event("auth:ended"));
  finish();
  await Promise.resolve();
  expect(mocks.socket.connected).toBe(false);
  expect(mocks.socket.connect).toHaveBeenCalledTimes(2);
  mocks.handlers.get("auth:revoked")();
  expect(mocks.endSession).toHaveBeenCalledTimes(1);
});
