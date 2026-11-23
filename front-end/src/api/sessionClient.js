export const refreshable = error => error?.response?.status === 401 &&
  ["NO_ACCESS_TOKEN", "ACCESS_EXPIRED"].includes(error.response.data?.code);

// raw has no response interceptor: refresh failures cannot recursively refresh.
export function createSessionClient(raw, { notify, lock = work => work() }) {
  let refreshing = null;
  let stopped = false;
  let generation = 0;
  const started = () => { stopped = false; generation++; notify("auth:started"); };
  const ended = (broadcast = true) => { stopped = true; generation++; notify("auth:ended", { broadcast }); };
  const refresh = () => {
    if (stopped) return Promise.reject(new Error("Session ended"));
    if (refreshing) return refreshing;
    const run = generation;
    refreshing = lock(async () => {
      if (stopped || run !== generation) throw new Error("Session ended");
      // Another tab/request may already have refreshed the shared cookies.
      try { await raw.get("/auth/me"); }
      catch (error) {
        if (!refreshable(error)) throw error;
        await raw.post("/auth/refresh");
      }
      if (stopped || run !== generation) throw new Error("Session ended");
      notify("auth:refreshed");
    }).catch(error => {
      if (error?.response?.status === 401) ended();
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
  return { refresh, logout, started, ended };
}

export function installSessionInterceptor(api, session) {
  return api.interceptors.response.use(response => response, async error => {
    const config = error.config;
    if (!config || config._retried || /^\/?auth\/(login|register|refresh|logout)(?:$|\?)/.test(config.url || "")) throw error;
    if (!refreshable(error)) {
      if (error?.response?.status === 401) session.ended();
      throw error;
    }
    config._retried = true;
    await session.refresh();
    return api.request(config);
  });
}
