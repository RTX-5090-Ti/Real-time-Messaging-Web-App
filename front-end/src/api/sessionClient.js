export const refreshable = error => error?.response?.status === 401 &&
  ["NO_ACCESS_TOKEN", "ACCESS_EXPIRED"].includes(error.response.data?.code);
export const unauthenticated = error => error?.response?.status === 401 || error?.code === "SESSION_ENDED";
const sessionEnded = () => Object.assign(new Error("Session ended"), { code: "SESSION_ENDED" });

// raw has no response interceptor: refresh failures cannot recursively refresh.
export function createSessionClient(raw, { notify, lock = work => work() }) {
  let refreshing = null;
  let stopped = false;
  let generation = 0;
  let terminated = false;
  const started = () => { stopped = false; terminated = false; generation++; notify("auth:started"); };
  const ended = (broadcast = true) => {
    if (terminated) return;
    terminated = true;
    stopped = true;
    generation++;
    notify("auth:ended", { broadcast });
  };
  const refresh = () => {
    if (stopped) return Promise.reject(sessionEnded());
    if (refreshing) return refreshing;
    const run = generation;
    refreshing = lock(async () => {
      if (stopped || run !== generation) throw sessionEnded();
      // Another tab/request may already have refreshed the shared cookies.
      try { await raw.get("/auth/me"); }
      catch (error) {
        if (!refreshable(error)) throw error;
        await raw.post("/auth/refresh");
      }
      if (stopped || run !== generation) throw sessionEnded();
      notify("auth:refreshed");
    }).catch(error => {
      if (run === generation && error?.response?.status === 401) ended();
      throw error;
    }).finally(() => { refreshing = null; });
    return refreshing;
  };
  const logout = async () => {
    // Queue behind refresh before clearing cookies/revoking; no late refresh can resurrect login.
    stopped = true;
    generation++;
    try {
      if (refreshing) await refreshing.catch(() => {});
      const response = await lock(() => raw.post("/auth/logout"));
      ended();
      return response;
    } catch (error) {
      stopped = false;
      throw error;
    }
  };
  const authenticate = async (path, body) => {
    stopped = true;
    generation++;
    try {
      if (refreshing) await refreshing.catch(() => {});
      return await lock(async () => {
        const response = await raw.post(path, body);
        started();
        return response;
      });
    } catch (error) {
      stopped = false;
      throw error;
    }
  };
  return { refresh, logout, authenticate, started, ended, generation: () => generation };
}

export function installSessionInterceptor(api, session) {
  api.interceptors.request?.use(config => {
    config._sessionGeneration ??= session.generation?.();
    return config;
  });
  const stale = config => config?._sessionGeneration !== undefined &&
    config._sessionGeneration !== session.generation?.();
  return api.interceptors.response.use(response => {
    if (stale(response.config)) throw Object.assign(new Error("Session changed"), { code: "STALE_SESSION" });
    return response;
  }, async error => {
    const config = error.config;
    if (stale(config)) throw Object.assign(new Error("Session changed"), { code: "STALE_SESSION" });
    if (!config || /^\/?auth\/(login|register|refresh|logout)(?:$|\?)/.test(config.url || "")) throw error;
    if (config._retried || !refreshable(error)) {
      if (error?.response?.status === 401) session.ended();
      throw error;
    }
    config._retried = true;
    await session.refresh();
    return api.request(config);
  });
}
