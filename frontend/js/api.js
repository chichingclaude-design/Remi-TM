/* Thin fetch wrapper. Stores the session token, attaches it to every call. */
(function () {
  let token = localStorage.getItem("ppm_token") || null;

  async function req(method, path, body) {
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = "Bearer " + token;
    let res;
    try {
      res = await fetch(path, {
        method, headers, body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch (e) {
      // Network-level failure: the host machine that runs the shared server has
      // most likely been closed or gone to sleep. Tell the user how to recover.
      window.dispatchEvent(new CustomEvent("ppm:hostlost"));
      throw { status: 0, message: "Connection to the host was lost" };
    }
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (res.status === 401 && path !== "/api/auth/login") {
      // session expired
      API.clearToken();
      window.dispatchEvent(new CustomEvent("ppm:logout"));
      throw { status: 401, message: "Session expired" };
    }
    if (!res.ok) throw { status: res.status, message: (data && data.error) || "Request failed" };
    return data;
  }

  const API = {
    get: (p) => req("GET", p),
    post: (p, b) => req("POST", p, b || {}),
    put: (p, b) => req("PUT", p, b || {}),
    del: (p) => req("DELETE", p),
    setToken: (t) => { token = t; localStorage.setItem("ppm_token", t); },
    clearToken: () => { token = null; localStorage.removeItem("ppm_token"); },
    hasToken: () => !!token,
  };
  window.API = API;
})();
