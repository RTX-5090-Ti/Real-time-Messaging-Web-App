import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { useNotifications } from "../src/hooks/chat/useNotifications.js";
import SearchFriendModal from "../src/components/chat/SearchFriendModal.jsx";
import NotificationsDropdown from "../src/components/chat/NotificationsDropdown.jsx";

const mocks = vi.hoisted(() => ({ incoming: vi.fn(), handlers: new Map() }));
vi.mock("../src/api/chat.api.js", () => ({ ChatAPI: {
  listFriends: async () => ({ data: { friends: [] } }), listIncomingRequests: mocks.incoming,
} }));
vi.mock("../src/socket/socket.js", () => ({ socket: {
  on: (name, fn) => mocks.handlers.set(name, fn), off: (name, fn) => { if (mocks.handlers.get(name) === fn) mocks.handlers.delete(name); },
} }));
const invitation = { id: "request-1", from: { id: "sender", name: "Sender" }, createdAt: "2026-01-01" };
const empty = { data: { requests: [] } };
beforeEach(() => { localStorage.clear(); mocks.handlers.clear(); mocks.incoming.mockReset().mockResolvedValue({ data: { requests: [invitation] } }); });
afterEach(cleanup);
const hook = () => renderHook(() => useNotifications({ me: { id: "recipient" }, onlineSet: new Set(), setFriends: vi.fn() }));

it("Clear All keeps pending invitations and removes ordinary notifications", async () => {
  const { result } = hook();
  await waitFor(() => expect(result.current.notiItems).toHaveLength(1));
  act(() => result.current.onNotificationNew({ id: "ordinary", type: "kicked_from_group" }));
  expect(result.current.notiItems).toHaveLength(2);
  act(() => result.current.clearAll());
  expect(result.current.notiItems.map(n => n.requestId)).toEqual(["request-1"]);
});

it("cancel removes the invitation/count and late HTTP responses cannot resurrect it", async () => {
  const { result } = hook();
  await waitFor(() => expect(result.current.notiCount).toBe(1));
  let resolve;
  mocks.incoming.mockReturnValueOnce(new Promise(done => { resolve = done; }));
  let pending;
  act(() => { pending = result.current.loadIncomingRequests(); });
  mocks.incoming.mockResolvedValue(empty);
  act(() => mocks.handlers.get("friend:request-updated")({ requestId: "request-1", status: "canceled" }));
  await waitFor(() => expect(result.current.notiItems).toHaveLength(0));
  await act(async () => { resolve({ data: { requests: [invitation] } }); await pending; });
  expect(result.current.notiCount).toBe(0);
  expect(result.current.notiItems).toHaveLength(0);
  mocks.incoming.mockResolvedValue({ data: { requests: [{ ...invitation, id: "request-2" }] } });
  act(() => result.current.onNotificationNew({ type: "friend_request", requestId: "request-2" }));
  await waitFor(() => expect(result.current.notiItems[0]?.requestId).toBe("request-2"));
});

it("sender can cancel, resend and cancel the new request without reopening search", async () => {
  const cancel = vi.fn().mockResolvedValue({});
  const send = vi.fn().mockResolvedValue({ id: "request-2" });
  const search = vi.fn().mockResolvedValue({ user: { id: "recipient", name: "Recipient", email: "b@test.invalid" }, relationship: "outgoing_pending", outgoingRequestId: "request-1" });
  render(<SearchFriendModal open onSearchEmail={search} onSendRequest={send} onCancelRequest={cancel} />);
  fireEvent.change(screen.getByPlaceholderText("Enter email…"), { target: { value: "b@test.invalid" } });
  fireEvent.click(screen.getByText("Search"));
  fireEvent.click(await screen.findByText("Hủy lời mời"));
  fireEvent.click(await screen.findByText("Add friend"));
  await waitFor(() => expect(send).toHaveBeenCalledWith("recipient"));
  fireEvent.click(await screen.findByText("Hủy lời mời"));
  await waitFor(() => expect(cancel.mock.calls.map(c => c[0])).toEqual(["request-1", "request-2"]));
});

it("shows the server explanation when accepting a revoked invitation", async () => {
  render(<NotificationsDropdown items={[{ type: "friend_request", requestId: "request-1" }]} onAccept={async () => {
    throw { response: { data: { message: "Lời mời đã được thu hồi" } } };
  }} />);
  fireEvent.click(screen.getByText("Accept"));
  expect((await screen.findByRole("alert")).textContent).toBe("Lời mời đã được thu hồi");
  expect(screen.getByText("Lời mời đã được thu hồi")).toBeTruthy();
});
