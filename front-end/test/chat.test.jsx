import { useState } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import ChatPage from "../src/pages/ChatPage.jsx";
import { useChatHistory } from "../src/hooks/chat/useChatHistory.js";
import { useVisibleRead } from "../src/hooks/chat/useVisibleRead.js";
import { useChatBootstrap } from "../src/hooks/chat/useChatBootstrap.js";
import { useNotifications } from "../src/hooks/chat/useNotifications.js";
import { mapMessage, mergeMessages } from "../src/utils/chat/messageState.js";

const mocks = vi.hoisted(() => {
  const listeners = new Map();
  const socket = { connected: true,
    on: vi.fn((event, fn) => { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event).add(fn); }),
    off: vi.fn((event, fn) => listeners.get(event)?.delete(fn)),
    emit: vi.fn(), timeout: vi.fn(), connect: vi.fn(), disconnect: vi.fn(),
  };
  return { socket, listeners, get: vi.fn(), post: vi.fn(),
    dispatch: (event, payload) => { for (const fn of listeners.get(event) || []) fn(payload); } };
});
vi.mock("../src/socket/socket.js", () => ({ socket: mocks.socket }));
vi.mock("../src/api/axios.js", () => ({ api: { get: mocks.get, post: mocks.post } }));

const me = { id: "a".repeat(24), name: "Alpha", email: "alpha@example.test" };
const friend = { id: "b".repeat(24), name: "Bravo" };
const cid = "c".repeat(24);
const message = (id, text = id) => ({ id, text, conversationId: cid, sender: friend,
  createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", attachments: [] });
const page = (messages, extra = {}) => ({ data: { messages, hasMore: false,
  nextBefore: messages[0]?.createdAt || null, nextBeforeId: messages[0]?.id || null, ...extra } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

beforeEach(() => {
  mocks.listeners.clear();
  mocks.socket.connected = true;
  mocks.socket.emit.mockReset();
  mocks.socket.timeout.mockImplementation(() => mocks.socket);
  mocks.get.mockReset();
  mocks.get.mockImplementation(async path => {
    if (path === "/auth/me") return { data: { user: me } };
    if (path === "/conversations") return { data: { conversations: [{ id: cid, type: "direct", members: [me, friend], unread: 0 }] } };
    if (path === "/messages") return page([message("d".repeat(24), "History message")]);
    if (path === "/friends") return { data: { friends: [] } };
    if (path === "/notifications") return { data: { notifications: [] } };
    if (path === "/friends/requests/incoming") return { data: { requests: [] } };
    throw new Error(`Unexpected request: ${path}`);
  });
  mocks.post.mockReset();
  vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  vi.stubGlobal("matchMedia", vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })));
  Element.prototype.scrollTo = vi.fn();
  localStorage.clear();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

function useHistoryHarness(activeChatId = cid) {
  const [messages, setMessages] = useState({});
  const history = useChatHistory({ meId: me.id, activeChatId, setMessagesByChatId: setMessages });
  return { messages, setMessages, ...history };
}

describe("chat page after login", () => {
  it("keeps live presence when delayed friend loads overwrite profile data", async () => {
    const pending = deferred();
    const normal = mocks.get.getMockImplementation();
    mocks.get.mockImplementation(path => path === "/friends" ? pending.promise : normal(path));
    const { result } = renderHook(() => {
      const state = useChatBootstrap({ navigate: vi.fn() });
      useNotifications({ me: state.me, onlineSet: state.onlineSet, setFriends: state.setFriends });
      return state;
    });
    await waitFor(() => expect(mocks.get.mock.calls.filter(([path]) => path === "/friends").length).toBeGreaterThanOrEqual(2));
    act(() => result.current.setOnlineIds([friend.id]));
    await act(async () => pending.resolve({ data: { friends: [friend] } }));
    expect(result.current.friends[0].status).toBe("online");
    // An HTTP refresh cannot resurrect an offline friend either.
    act(() => result.current.setOnlineIds([]));
    act(() => result.current.setFriends([{ ...friend, status: "online" }]));
    expect(result.current.friends[0].status).toBe("offline");
    act(() => result.current.setOnlineIds([friend.id]));
    expect(result.current.friends[0].status).toBe("online");
  });

  it("requests an online snapshot on every socket reconnect", async () => {
    render(<MemoryRouter><ChatPage /></MemoryRouter>);
    await screen.findByText("History message");
    mocks.socket.emit.mockClear();
    act(() => { mocks.dispatch("connect"); mocks.dispatch("connect"); });
    expect(mocks.socket.emit.mock.calls.filter(([event]) => event === "presence:sync")).toHaveLength(2);
  });
  it.each(["/auth/me", "/friends"])("keeps network/server failure at %s out of login and allows retry", async path => {
    const normal = mocks.get.getMockImplementation();
    let fail = true;
    mocks.get.mockImplementation(url => url === path && fail ? Promise.reject({ response: { status: 500 } }) : normal(url));
    const navigate = vi.fn();
    const { result } = renderHook(() => useChatBootstrap({ navigate }));
    await waitFor(() => expect(result.current.bootstrapError).toBe(true));
    expect(navigate).not.toHaveBeenCalled();
    fail = false;
    act(() => result.current.retryBootstrap());
    await waitFor(() => expect(result.current.bootstrapLoading).toBe(false));
    expect(result.current.bootstrapError).toBe(false);
    expect(result.current.me.id).toBe(me.id);
  });
  it("renders history using the actual page/hook wiring and cleans socket listeners on unmount", async () => {
    const view = render(<MemoryRouter><ChatPage /></MemoryRouter>);
    expect(await screen.findByText("History message")).toBeTruthy();
    expect(screen.getByPlaceholderText("Write a message...")).toBeTruthy();
    expect(mocks.listeners.get("connect")?.size).toBeGreaterThan(0);
    view.unmount();
    expect([...mocks.listeners.values()].every(set => set.size === 0)).toBe(true);
  });

  it("replaces an optimistic message using ACK even when message:new never arrives", async () => {
    mocks.socket.emit.mockImplementation((event, payload, callback) => {
      if (event === "message:send") callback(null, { ok: true, message: {
        ...message("e".repeat(24), payload.text), clientId: payload.clientId, sender: me,
      } });
    });
    const view = render(<MemoryRouter><ChatPage /></MemoryRouter>);
    await screen.findByText("History message");
    fireEvent.change(screen.getByPlaceholderText("Write a message..."), { target: { value: "ACK-only send" } });
    fireEvent.click(screen.getByTitle("Send"));
    await waitFor(() => expect(view.container.querySelector('[data-msg-id="eeeeeeeeeeeeeeeeeeeeeeee"]')).toBeTruthy());
    expect(view.container.querySelectorAll('[data-msg-id^="tmp:"]').length).toBe(0);
    expect(view.container.querySelectorAll('[data-msg-id="eeeeeeeeeeeeeeeeeeeeeeee"]').length).toBe(1);
  });
});

describe("history race conditions and reconnect", () => {
  it("does not overwrite a socket message or pending send with a delayed history response", async () => {
    const pending = deferred();
    mocks.get.mockReturnValueOnce(pending.promise);
    const { result } = renderHook(() => useHistoryHarness());
    act(() => result.current.setMessages({ [cid]: [mapMessage(message("new"), me.id),
      { id: "tmp:send", from: "me", clientId: "send", status: "sending", createdAt: "2026-01-02" }] }));
    await act(async () => pending.resolve(page([message("old")])));
    expect(result.current.messages[cid].map(m => m.id).sort()).toEqual(["new", "old", "tmp:send"]);
  });

  it("ignores responses belonging to a chat that was switched away from", async () => {
    const oldRequest = deferred();
    mocks.get.mockReturnValueOnce(oldRequest.promise).mockResolvedValueOnce(page([message("current")]));
    const { result, rerender } = renderHook(({ id }) => useHistoryHarness(id), { initialProps: { id: cid } });
    rerender({ id: "second" });
    await waitFor(() => expect(result.current.messages.second?.[0].id).toBe("current"));
    await act(async () => oldRequest.resolve(page([message("obsolete")])));
    expect(result.current.messages[cid]).toBeUndefined();
  });

  it("reconnect re-fetches history and keeps a newer socket mutation over stale server data", async () => {
    mocks.get.mockResolvedValueOnce(page([message("one")])).mockResolvedValueOnce(page([message("one"), message("two")]));
    const { result } = renderHook(() => useHistoryHarness());
    await waitFor(() => expect(result.current.messages[cid]?.length).toBe(1));
    act(() => result.current.setMessages(prev => ({ ...prev, [cid]: mergeMessages(prev[cid], [{
      ...mapMessage(message("one"), me.id), text: "latest edit", revision: 2,
    }]) })));
    act(() => mocks.dispatch("connect"));
    await waitFor(() => expect(result.current.messages[cid]?.length).toBe(2));
    expect(result.current.messages[cid][0].text).toBe("latest edit");
  });
});

it("seen hook waits until the tab is visible and focused, then emits a message ID", async () => {
  vi.useFakeTimers();
  const rect = { width: 100, height: 100, top: 0, bottom: 100, left: 0, right: 100 };
  const root = document.createElement("div");
  const row = document.createElement("div");
  row.dataset.msgId = "f".repeat(24);
  root.appendChild(row);
  root.getBoundingClientRect = () => rect;
  row.getBoundingClientRect = () => ({ ...rect, height: 30, bottom: 30 });
  const visibility = vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
  const focus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
  mocks.socket.emit.mockImplementation((event, payload, callback) => {
    if (event === "conversation:read") callback(null, { ok: true });
  });
  renderHook(() => useVisibleRead({ conversationId: cid, messages: [], listRef: { current: root } }));
  await act(async () => vi.advanceTimersByTimeAsync(300));
  expect(mocks.socket.emit).not.toHaveBeenCalled();
  visibility.mockReturnValue("visible");
  act(() => document.dispatchEvent(new Event("visibilitychange")));
  await act(async () => vi.advanceTimersByTimeAsync(300));
  expect(mocks.socket.emit).not.toHaveBeenCalled();
  focus.mockReturnValue(true);
  act(() => window.dispatchEvent(new Event("focus")));
  await act(async () => vi.advanceTimersByTimeAsync(300));
  expect(mocks.socket.emit).toHaveBeenCalledWith("conversation:read", { conversationId: cid, messageId: row.dataset.msgId }, expect.any(Function));
});
