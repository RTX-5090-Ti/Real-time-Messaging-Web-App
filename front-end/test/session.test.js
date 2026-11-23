import { describe, it, expect, vi } from "vitest";
import { createSessionClient, installSessionInterceptor } from "../src/api/sessionClient.js";

const expired = () => ({ response: { status: 401, data: { code: "ACCESS_EXPIRED" } } });
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };

describe("refresh coordination", () => {
  it("concurrent requests in a tab share one refresh", async () => {
    const gate = deferred();
    const raw = { get: vi.fn().mockRejectedValue(expired()), post: vi.fn().mockReturnValue(gate.promise) };
    const notify = vi.fn();
    const session = createSessionClient(raw, { notify, lock: work => Promise.resolve().then(work) });
    const tasks = [session.refresh(), session.refresh(), session.refresh()];
    gate.resolve({ data: { ok: true } });
    await Promise.all(tasks);
    expect(raw.post).toHaveBeenCalledTimes(1);
    expect(raw.post).toHaveBeenCalledWith("/auth/refresh");
    expect(notify).toHaveBeenCalledWith("auth:refreshed");
  });

  it("two tabs using the shared lock recheck cookies and rotate only once", async () => {
    let queue = Promise.resolve();
    const lock = work => { const task = queue.then(work); queue = task.catch(() => {}); return task; };
    let valid = false;
    const raw = { get: vi.fn(async () => { if (!valid) throw expired(); return {}; }), post: vi.fn(async () => { valid = true; }) };
    const a = createSessionClient(raw, { notify: vi.fn(), lock });
    const b = createSessionClient(raw, { notify: vi.fn(), lock });
    await Promise.all([a.refresh(), b.refresh()]);
    expect(raw.post).toHaveBeenCalledTimes(1);
  });

  it("refresh rejection ends the session; network failure does not", async () => {
    const raw = { get: vi.fn().mockRejectedValue(expired()), post: vi.fn().mockRejectedValue({ response: { status: 401 } }) };
    const notify = vi.fn();
    const session = createSessionClient(raw, { notify, lock: work => Promise.resolve().then(work) });
    await expect(session.refresh()).rejects.toBeTruthy();
    expect(notify).toHaveBeenCalledWith("auth:ended", { broadcast: true });
    session.started(); notify.mockClear(); raw.post.mockRejectedValue(new Error("offline"));
    await expect(session.refresh()).rejects.toThrow("offline");
    expect(notify).not.toHaveBeenCalled();
  });

  it("logout waits for a pending refresh and does not emit refreshed afterward", async () => {
    const gate = deferred();
    const raw = { get: vi.fn().mockRejectedValue(expired()), post: vi.fn(path => path === "/auth/refresh" ? gate.promise : Promise.resolve({})) };
    const notify = vi.fn();
    const session = createSessionClient(raw, { notify, lock: work => Promise.resolve().then(work) });
    const pending = session.refresh().catch(() => {});
    await vi.waitFor(() => expect(raw.post).toHaveBeenCalledWith("/auth/refresh"));
    const logout = session.logout();
    gate.resolve({});
    await Promise.all([pending, logout]);
    expect(raw.post.mock.calls.map(c => c[0])).toEqual(["/auth/refresh", "/auth/logout"]);
    expect(notify).not.toHaveBeenCalledWith("auth:refreshed");
    await expect(session.refresh()).rejects.toThrow("Session ended");
  });

  it("interceptor retries once, never refreshes login errors and never loops", async () => {
    let rejected;
    const api = { interceptors: { response: { use: (_, fn) => { rejected = fn; } } }, request: vi.fn().mockResolvedValue({ data: "ok" }) };
    const session = { refresh: vi.fn().mockResolvedValue(), ended: vi.fn() };
    installSessionInterceptor(api, session);
    const config = { url: "/messages" };
    expect((await rejected({ ...expired(), config })).data).toBe("ok");
    expect(config._retried).toBe(true);
    await expect(rejected({ ...expired(), config })).rejects.toBeTruthy();
    await expect(rejected({ ...expired(), config: { url: "/auth/login" } })).rejects.toBeTruthy();
    expect(session.refresh).toHaveBeenCalledTimes(1);
  });
});
