import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import DeviceSessions from "../src/components/chat/DeviceSessions.jsx";
const api = vi.hoisted(() => ({ sessions: vi.fn(), revokeSession: vi.fn(), revokeOtherSessions: vi.fn(), logout: vi.fn() }));
vi.mock("../src/api/auth.api.js", () => ({ AuthAPI: api }));
vi.mock("../src/socket/socket.js", () => ({ socket: { on: vi.fn(), off: vi.fn() } }));
const current = { id: "current", current: true, device: { browser: "Chrome", os: "Windows", kind: "desktop" }, createdAt: "2026-01-01", lastUsedAt: "2026-01-02" };
const other = { ...current, id: "other", current: false, device: { browser: "Safari", os: "iPhone", kind: "mobile" } };
beforeEach(() => {
  Object.values(api).forEach(mock => mock.mockReset());
  api.sessions.mockResolvedValue({ data: { sessions: [current, other] } });
});
afterEach(cleanup);
it("loads real sessions and revokes the selected session only after confirmation", async () => {
  render(<DeviceSessions />);
  const name = await screen.findByText("Safari · iPhone");
  expect(screen.getByText("Phiên hiện tại")).toBeTruthy();
  fireEvent.click(within(name.closest("li")).getByText("Đăng xuất"));
  expect(api.revokeSession).not.toHaveBeenCalled();
  api.revokeSession.mockResolvedValue({});
  api.sessions.mockResolvedValue({ data: { sessions: [current] } });
  fireEvent.click(screen.getByText("Xác nhận đăng xuất"));
  await waitFor(() => expect(api.revokeSession).toHaveBeenCalledWith("other"));
  await waitFor(() => expect(screen.queryByText("Safari · iPhone")).toBeNull());
  expect(api.logout).not.toHaveBeenCalled();
});
it("revokes other sessions while preserving the current one", async () => {
  render(<DeviceSessions />);
  await screen.findByText("Safari · iPhone");
  fireEvent.click(screen.getByText("Đăng xuất các thiết bị khác"));
  api.revokeOtherSessions.mockResolvedValue({});
  api.sessions.mockResolvedValue({ data: { sessions: [current] } });
  fireEvent.click(screen.getByText("Xác nhận đăng xuất"));
  await waitFor(() => expect(api.revokeOtherSessions).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.queryByText("Safari · iPhone")).toBeNull());
  expect(screen.getByText("Phiên hiện tại")).toBeTruthy();
});
it("uses the established logout flow for the current session", async () => {
  render(<DeviceSessions />);
  const name = await screen.findByText("Chrome · Windows");
  fireEvent.click(within(name.closest("li")).getByText("Đăng xuất"));
  api.logout.mockResolvedValue({});
  fireEvent.click(screen.getByText("Xác nhận đăng xuất"));
  await waitFor(() => expect(api.logout).toHaveBeenCalledTimes(1));
  expect(api.revokeSession).not.toHaveBeenCalled();
});
it("retries loading failures and handles legacy sessions without metadata", async () => {
  api.sessions.mockRejectedValueOnce(new Error("offline")).mockResolvedValue({ data: { sessions: [{ ...current, device: null }] } });
  render(<DeviceSessions />);
  fireEvent.click(await screen.findByText("Thử lại"));
  expect(await screen.findByText("Thiết bị chưa xác định")).toBeTruthy();
});
