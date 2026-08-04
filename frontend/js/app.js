/* ============================================================================
   Enterprise PPM Platform - single-page application shell + views.
   ========================================================================== */
(function () {
  "use strict";
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  let USER = null;

  // ---- inline icon set (stroke = currentColor) ----
  const IC = {
    exec: '<path d="M3 3v18h18"/><path d="M7 14l3-3 3 3 5-6"/>',
    portfolio: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
    resources: '<circle cx="9" cy="7" r="3"/><path d="M3 21v-1a6 6 0 0 1 6-6"/><circle cx="17" cy="9" r="2.5"/><path d="M14.5 21v-.5a4.5 4.5 0 0 1 7-3.7"/>',
    financial: '<path d="M12 2v20"/><path d="M17 6a4 4 0 0 0-4-2H10a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-3a4 4 0 0 1-4-2"/>',
    risk: '<path d="M12 3l9 16H3z"/><path d="M12 10v4"/><circle cx="12" cy="17" r=".6" fill="currentColor"/>',
    projects: '<path d="M4 5h16"/><path d="M4 12h16"/><path d="M4 19h10"/>',
    tasks: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 9l2 2 4-4"/><path d="M8 15h6"/>',
    kanban: '<rect x="3" y="4" width="5" height="16" rx="1"/><rect x="9.5" y="4" width="5" height="10" rx="1"/><rect x="16" y="4" width="5" height="13" rx="1"/>',
    gantt: '<path d="M4 6h8"/><path d="M8 12h9"/><path d="M6 18h7"/>',
    calendar: '<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/>',
    workflow: '<circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><circle cx="12" cy="18" r="2"/><path d="M7 6h10M6 8l5 8M18 8l-5 8"/>',
    raci: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 3v18"/>',
    sla: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 2h6"/>',
    approvals: '<path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="9"/>',
    okr: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/>',
    kpi: '<path d="M3 3v18h18"/><rect x="7" y="11" width="3" height="7"/><rect x="12" y="7" width="3" height="11"/><rect x="17" y="14" width="3" height="4"/>',
    capacity: '<path d="M3 12h4l2 6 4-14 2 8h6"/>',
    audit: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
    users: '<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.6"/><path d="M15 20a5 5 0 0 1 7-4.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.3l2-1.5-2-3.4-2.3 1a7 7 0 0 0-2.2-1.3L14 2h-4l-.3 2.2a7 7 0 0 0-2.2 1.3l-2.3-1-2 3.4 2 1.5A7 7 0 0 0 5 12a7 7 0 0 0 .1 1.3l-2 1.5 2 3.4 2.3-1a7 7 0 0 0 2.2 1.3L10 22h4l.3-2.2a7 7 0 0 0 2.2-1.3l2.3 1 2-3.4-2-1.5A7 7 0 0 0 19 12z"/>',
    bell: '<path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
    moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>', menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  };
  const icon = (n, sz = 17) => `<svg class="nav-ic" width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[n] || ""}</svg>`;

  // ---- nav definition: [section, [ [route, icon, i18nKey, minLevel] ] ] ----
  const NAV = [
    ["nav_overview", [
      ["executive", "exec", "executive", 0], ["portfolio", "portfolio", "portfolio", 0],
      ["resources", "resources", "resources", 0], ["financial", "financial", "financial", 0],
      ["risk", "risk", "risk", 0]]],
    ["nav_delivery", [
      ["projects", "projects", "projects", 0], ["tasks", "tasks", "tasks", 0],
      ["kanban", "kanban", "kanban", 0], ["gantt", "gantt", "gantt", 0],
      ["calendar", "calendar", "calendar", 0]]],
    ["nav_governance", [
      ["workflow", "workflow", "workflow", 0], ["raci", "raci", "raci", 0],
      ["sla", "sla", "sla", 0], ["approvals", "approvals", "approvals", 0],
      ["audit", "audit", "audit", 70]]],
    ["nav_strategy", [
      ["okr", "okr", "okr", 0], ["kpi", "kpi", "kpi", 0],
      ["capacity", "capacity", "capacity", 0]]],
    ["nav_admin", [
      ["users", "users", "users", 0], ["settings", "settings", "settings", 100]]],
  ];

  // ---- formatting helpers ----
  const money = (n) => "€" + Charts.fmt(n || 0);
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
  const tr = (k) => window.t(k);
  function statusLabel(s) { return tr(s) !== s ? tr(s) : cap(String(s).replace(/_/g, " ")); }
  function healthClass(h) { return { green: "b-green", amber: "b-amber", red: "b-red" }[h] || "b-grey"; }
  function statusClass(s) {
    return ({ active: "b-blue", completed: "b-green", on_hold: "b-amber", cancelled: "b-red",
      planning: "b-grey", done: "b-green", in_progress: "b-blue", review: "b-amber",
      blocked: "b-red", todo: "b-grey", open: "b-blue", closed: "b-grey", mitigating: "b-amber",
      approved: "b-green", rejected: "b-red", pending: "b-amber", resolved: "b-green",
      responded: "b-blue", on_track: "b-green", at_risk: "b-amber", off_track: "b-red" })[s] || "b-grey";
  }
  function prioClass(p) { return ({ low: "b-grey", medium: "b-blue", high: "b-amber", critical: "b-red" })[p] || "b-grey"; }
  function badge(s, cls) { return `<span class="badge ${cls || statusClass(s)}">${statusLabel(s)}</span>`; }
  function pbar(pct, cls) { pct = Math.max(0, Math.min(100, pct || 0));
    const c = cls || (pct >= 70 ? "green" : pct >= 40 ? "amber" : "red");
    return `<div class="pbar ${c}"><span style="width:${pct}%"></span></div>`; }
  function avatar(name, color, sz) {
    const init = (name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
    return `<div class="avatar" style="background:${color || "#64748b"};${sz ? `width:${sz}px;height:${sz}px;font-size:${sz * .38}px` : ""}">${init}</div>`;
  }

  // ---- toast / modal ----
  function toast(msg, type) {
    const t = document.createElement("div");
    t.className = "toast " + (type || "");
    t.textContent = msg; document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 250); }, 2600);
  }
  function modal(title, bodyHTML, footHTML) {
    const back = document.createElement("div"); back.className = "modal-back";
    back.innerHTML = `<div class="modal"><div class="modal-head"><h3>${title}</h3>
      <button class="icon-btn" style="margin-left:auto" data-close>✕</button></div>
      <div class="modal-body">${bodyHTML}</div>
      ${footHTML ? `<div class="modal-foot">${footHTML}</div>` : ""}</div>`;
    document.body.appendChild(back);
    const close = () => back.remove();
    back.addEventListener("click", e => { if (e.target === back || e.target.hasAttribute("data-close")) close(); });
    return { el: back, close };
  }

  function canWrite() { return USER && USER.role_level > 10; }

  // ======================================================== AUTH / LOGIN =====
  function renderLogin(errorMsg) {
    document.body.innerHTML = `
      <div class="login-wrap"><div class="login-card">
        <div class="login-lang">
          <button data-llang="en" class="${window.LOCALE === "en" ? "active" : ""}">EN</button>
          <button data-llang="hr" class="${window.LOCALE === "hr" ? "active" : ""}">HR</button>
        </div>
        <div class="login-brand"><div class="login-logo">P</div>
          <div><div class="login-title">${tr("app_name")}</div>
          <div class="login-sub">${tr("login_sub")}</div></div></div>
        <div id="login-err">${errorMsg ? `<div class="login-error">${errorMsg}</div>` : ""}</div>
        <div class="field"><label>${tr("username")}</label><input id="u" autofocus autocomplete="username"></div>
        <div class="field"><label>${tr("password")}</label><input id="p" type="password" autocomplete="current-password"></div>
        <button class="btn btn-primary btn-block" id="go">${tr("sign_in")}</button>
        <div class="login-hint"><b>${tr("admin_account")}:</b><br>
          <code>director</code> / <code>director123</code> — ${tr("full_access")}<br>
          <span style="color:var(--text-faint)">${tr("admin_creates_users")}</span></div>
      </div></div>`;
    $$("[data-llang]").forEach(b => b.onclick = () => { window.setLocale(b.dataset.llang); renderLogin(errorMsg); });
    const doLogin = async () => {
      const go = $("#go"); go.disabled = true; go.textContent = tr("signing_in");
      try {
        const r = await API.post("/api/auth/login",
          { username: $("#u").value.trim(), password: $("#p").value });
        API.setToken(r.token); USER = r.user;
        window.setLocale(USER.locale || window.LOCALE);
        applyTheme(USER.theme || "light");
        boot();
      } catch (e) {
        $("#login-err").innerHTML = `<div class="login-error">${tr("login_error")}</div>`;
        go.disabled = false; go.textContent = tr("sign_in");
      }
    };
    $("#go").onclick = doLogin;
    $("#p").addEventListener("keydown", e => { if (e.key === "Enter") doLogin(); });
    $("#u").addEventListener("keydown", e => { if (e.key === "Enter") $("#p").focus(); });
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("ppm_theme", theme);
  }

  // ============================================================== SHELL ======
  function renderShell() {
    let nav = "";
    NAV.forEach(([section, items]) => {
      const visible = items.filter(([, , , lvl]) => USER.role_level >= lvl);
      if (!visible.length) return;
      nav += `<div class="sb-section">${tr(section)}</div>`;
      visible.forEach(([route, ic, key]) => {
        nav += `<div class="nav-item" data-route="${route}">${icon(ic)}<span>${tr(key)}</span></div>`;
      });
    });
    document.body.innerHTML = `
      <div class="app">
        <aside class="sidebar" id="sidebar">
          <div class="sb-brand"><div class="sb-logo">P</div>
            <div><div class="sb-brand-name">${tr("app_name")}</div>
            <div class="sb-brand-sub">${tr("app_tag")}</div></div></div>
          ${nav}
          <div style="flex:1"></div>
          <div class="nav-item" id="logout" style="margin-bottom:12px">${icon("settings")}<span>${tr("logout")}</span></div>
        </aside>
        <header class="topbar">
          <button class="icon-btn hidden" id="menu-btn" style="border:none">${icon("menu")}</button>
          <div><div class="tb-title" id="tb-title">${tr("executive")}</div></div>
          <div class="tb-spacer"></div>
          <div class="tb-search"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${IC.search}</svg>
            <input id="global-search" placeholder="${tr("search")}"></div>
          <div class="lang-switch">
            <button data-lang="en" class="${window.LOCALE === "en" ? "active" : ""}">EN</button>
            <button data-lang="hr" class="${window.LOCALE === "hr" ? "active" : ""}">HR</button></div>
          <button class="icon-btn" id="theme-btn">${document.documentElement.getAttribute("data-theme") === "dark" ? svg(IC.sun) : svg(IC.moon)}</button>
          <button class="icon-btn" id="notif-btn">${svg(IC.bell)}<span class="dot hidden" id="notif-dot"></span></button>
          <div class="user-chip" id="user-chip">${avatar(USER.full_name, USER.avatar_color, 32)}
            <div><div class="u-name">${USER.full_name}</div><div class="u-role">${USER.role_name}</div></div></div>
        </header>
        <main class="main" id="view"></main>
      </div>`;

    $$(".nav-item[data-route]").forEach(n => n.onclick = () => { location.hash = n.dataset.route; $("#sidebar").classList.remove("open"); });
    $("#logout").onclick = logout;
    $("#menu-btn").onclick = () => $("#sidebar").classList.toggle("open");
    $$(".lang-switch button").forEach(b => b.onclick = () => switchLang(b.dataset.lang));
    $("#theme-btn").onclick = toggleTheme;
    $("#notif-btn").onclick = toggleNotifPanel;
    $("#user-chip").onclick = () => { location.hash = "settings-me"; };
    $("#global-search").addEventListener("keydown", e => {
      if (e.key === "Enter" && e.target.value.trim()) { SEARCH_TERM = e.target.value.trim(); location.hash = "projects"; }
    });
    loadNotifBadge();
  }
  function svg(inner, sz = 18) { return `<svg width="${sz}" height="${sz}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`; }

  let SEARCH_TERM = "";

  async function switchLang(lang) {
    window.setLocale(lang);
    try { await API.put("/api/me/prefs", { locale: lang }); } catch (e) {}
    renderShell(); route();
  }
  function toggleTheme() {
    const cur = document.documentElement.getAttribute("data-theme");
    const next = cur === "dark" ? "light" : "dark";
    applyTheme(next);
    API.put("/api/me/prefs", { theme: next }).catch(() => {});
    $("#theme-btn").innerHTML = next === "dark" ? svg(IC.sun) : svg(IC.moon);
    route(); // re-render charts for theme colors
  }
  function logout() {
    API.post("/api/auth/logout").catch(() => {});
    API.clearToken(); USER = null; location.hash = ""; renderLogin();
  }

  async function loadNotifBadge() {
    try { const n = await API.get("/api/notifications");
      const unread = n.filter(x => !x.is_read).length;
      $("#notif-dot").classList.toggle("hidden", unread === 0);
    } catch (e) {}
  }
  async function toggleNotifPanel() {
    const existing = $("#notif-panel"); if (existing) { existing.remove(); return; }
    const n = await API.get("/api/notifications");
    const panel = document.createElement("div"); panel.className = "notif-panel"; panel.id = "notif-panel";
    panel.innerHTML = `<div class="card-head"><h3>${tr("notifications")}</h3></div>
      <div style="max-height:340px;overflow:auto">${n.length ? n.map(x => `
        <div class="notif-item ${x.is_read ? "" : "unread"}" data-id="${x.id}">
          <span class="ni-dot" style="background:${x.type === "warning" ? "var(--amber-500)" : "var(--blue-500)"}"></span>
          <div><div style="font-weight:600;font-size:12.5px">${x.title}</div>
          <div style="color:var(--text-muted);font-size:11.5px">${x.body || ""}</div></div></div>`).join("")
        : `<div class="empty">${tr("no_notifications")}</div>`}</div>`;
    $("#notif-btn").parentElement.style.position = "relative";
    $("#notif-btn").insertAdjacentElement("afterend", panel);
    $$(".notif-item", panel).forEach(it => it.onclick = async () => {
      await API.put(`/api/notifications/${it.dataset.id}/read`); it.classList.remove("unread"); loadNotifBadge();
    });
    setTimeout(() => document.addEventListener("click", function h(e) {
      if (!panel.contains(e.target) && e.target.id !== "notif-btn") { panel.remove(); document.removeEventListener("click", h); }
    }), 0);
  }

  // ============================================================== ROUTER =====
  const ROUTES = {}; // filled below by registering views
  function register(name, fn) { ROUTES[name] = fn; }

  async function route() {
    if (!USER) return;
    let hash = (location.hash || "#executive").slice(1);
    const [name, param] = hash.split("/");
    const view = ROUTES[name] || ROUTES.executive;
    $$(".nav-item[data-route]").forEach(n => n.classList.toggle("active", n.dataset.route === name));
    const titleKey = { "settings-me": "settings" }[name] || name;
    if ($("#tb-title")) $("#tb-title").textContent = tr(titleKey) || cap(name);
    const root = $("#view");
    root.innerHTML = `<div class="spinner"></div>`;
    try { await view(root, param); }
    catch (e) {
      if (e && e.status === 401) return;
      root.innerHTML = `<div class="empty">${tr("error_occurred")}<br><small>${(e && e.message) || ""}</small></div>`;
    }
  }
  window.addEventListener("hashchange", route);
  window.addEventListener("ppm:logout", () => { USER = null; renderLogin(tr("login_error")); });
  window.addEventListener("ppm:hostlost", showHostLost);

  let hostLostShown = false;
  function showHostLost() {
    if (hostLostShown) return;
    hostLostShown = true;
    const bar = document.createElement("div");
    bar.className = "hostlost-bar";
    bar.innerHTML = `<span>${tr("host_lost")}</span>
      <button onclick="location.reload()">${tr("reconnect")}</button>`;
    document.body.appendChild(bar);
  }

  // small helper: build a stat card
  function statCard(label, value, opts = {}) {
    const ic = opts.icon ? `<div class="ic" style="background:${opts.iconBg || "var(--blue-100)"};color:${opts.iconColor || "var(--blue-600)"}">${svg(IC[opts.icon], 18)}</div>` : "";
    const delta = opts.delta ? `<div class="delta ${opts.deltaClass || "flat"}">${opts.delta}</div>` : "";
    return `<div class="card stat">${ic}<div class="label">${label}</div>
      <div class="value">${value}</div>${delta}</div>`;
  }
  function cardChart(titleKey, id, height, subKey) {
    return `<div class="card"><div class="card-head"><h3>${tr(titleKey)}</h3>
      ${subKey ? `<span class="sub">${tr(subKey)}</span>` : ""}<div class="spacer"></div></div>
      <div class="card-pad"><div id="${id}" style="min-height:${height || 240}px"></div></div></div>`;
  }

  window.PPM = { register, ROUTES, $, $$, tr, badge, pbar, avatar, money, toast, modal,
    statCard, cardChart, statusLabel, statusClass, prioClass, healthClass, canWrite,
    getUser: () => USER, svg, IC, route, cap };

  // ================================================================ BOOT =====
  async function boot() {
    renderShell();
    if (!location.hash) location.hash = "executive";
    route();
  }

  async function init() {
    applyTheme(localStorage.getItem("ppm_theme") || "light");
    if (API.hasToken()) {
      try { USER = await API.get("/api/me"); window.setLocale(USER.locale || window.LOCALE);
        applyTheme(USER.theme || localStorage.getItem("ppm_theme") || "light"); boot(); return;
      } catch (e) { API.clearToken(); }
    }
    renderLogin();
  }
  window.addEventListener("DOMContentLoaded", init);
})();
