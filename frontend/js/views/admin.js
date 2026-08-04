/* Admin views: Users directory, Settings + Backups, personal preferences. */
(function () {
  const P = window.PPM, tr = P.tr;

  // ---------------------------------------------------------------- USERS ----
  // Shared password-policy widget: renders a live checklist and validates input.
  const PW_RULES = [
    ["pw_len", pw => pw.length >= 12],
    ["pw_upper", pw => /[A-Z]/.test(pw)],
    ["pw_lower", pw => /[a-z]/.test(pw)],
    ["pw_digit", pw => /[0-9]/.test(pw)],
    ["pw_special", pw => /[!@#$%^&*()\-_=+\[\]{};:,.<>?/|\\`~"']/.test(pw)],
  ];
  function pwValid(pw) { return PW_RULES.every(([, fn]) => fn(pw)); }
  function pwRulesHTML() {
    return `<ul class="pw-rules" id="pw-rules">${PW_RULES.map(([k]) =>
      `<li data-rule="${k}">${tr(k)}</li>`).join("")}</ul>`;
  }
  function wirePwRules(scope, input) {
    const upd = () => PW_RULES.forEach(([k, fn]) =>
      P.$(`[data-rule="${k}"]`, scope).classList.toggle("ok", fn(input.value)));
    input.addEventListener("input", upd); upd();
  }
  function genPassword() {
    const U = "ABCDEFGHJKLMNPQRSTUVWXYZ", L = "abcdefghijkmnpqrstuvwxyz",
          D = "23456789", S = "!@#$%^&*-_=+?";
    const pick = s => s[Math.floor(Math.random() * s.length)];
    let base = pick(U) + pick(L) + pick(D) + pick(S);
    const all = U + L + D + S;
    for (let i = 0; i < 10; i++) base += pick(all);
    return base.split("").sort(() => Math.random() - 0.5).join("");
  }

  P.register("users", async (root) => {
    const isDirector = P.getUser().role_level >= 100;
    const [users, util, roles, teams, dests] = await Promise.all([
      API.get("/api/users"), API.get("/api/resources/utilization").catch(() => []),
      API.get("/api/roles").catch(() => []), API.get("/api/teams").catch(() => []),
      API.get("/api/destinations").catch(() => [])]);
    const utilMap = {}; util.forEach(u => utilMap[u.id] = u.utilization);

    root.innerHTML = `
      <div class="page-head"><div><div class="page-title">${tr("user_directory")}</div>
        <div class="page-desc">${users.length} ${tr("users").toLowerCase()}</div></div>
        ${isDirector ? `<div class="page-actions"><button class="btn btn-primary" id="new-user">${P.svg(P.IC.plus, 16)} ${tr("new_user")}</button></div>` : ""}</div>
      <div class="card"><table class="table"><thead><tr>
        <th>${tr("name")}</th><th>${tr("role")}</th><th>${tr("job_title")}</th>
        <th>${tr("team")}</th><th>${tr("destination")}</th><th>${tr("email")}</th>
        <th class="num">${tr("capacity_col")}</th><th style="width:120px">${tr("utilization")}</th>
        <th>${tr("status")}</th>${isDirector ? "<th></th>" : ""}</tr></thead>
        <tbody>${users.map(u => `<tr>
          <td><div style="display:flex;align-items:center;gap:8px">${P.avatar(u.full_name, u.avatar_color, 28)}
            <div><b>${u.full_name}</b><div style="font-size:11px;color:var(--text-faint)">@${u.username}</div></div></div></td>
          <td>${P.badge(u.role, roleClass(u.role))}</td>
          <td style="font-size:12.5px">${u.job_title || "—"}</td>
          <td>${u.team || "—"}</td><td>${u.destination || "—"}</td>
          <td style="font-size:12px;color:var(--text-muted)">${u.email || "—"}</td>
          <td class="num">${u.capacity_hours || 40}h</td>
          <td>${utilMap[u.id] != null ? P.pbar(Math.round(utilMap[u.id])) : "—"}</td>
          <td>${u.is_active ? `<span class="badge b-green">${tr("active")}</span>` : `<span class="badge b-grey">${tr("inactive")}</span>`}</td>
          ${isDirector ? `<td style="text-align:right"><button class="btn btn-sm" data-edit="${u.id}">${tr("edit")}</button></td>` : ""}
        </tr>`).join("")}</tbody></table></div>`;

    if (!isDirector) return;

    const optionList = (arr, sel) => arr.map(x =>
      `<option value="${x.id}" ${x.id === sel ? "selected" : ""}>${x.name}</option>`).join("");

    function userModal(existing) {
      const u = existing || {};
      const editing = !!existing;
      const m = P.modal(editing ? tr("edit_user") : tr("new_user"), `
        <div class="grid g-2">
          <div class="field"><label>${tr("name")}</label><input id="uf-name" value="${u.full_name || ""}"></div>
          <div class="field"><label>${tr("username")}</label>
            <input id="uf-user" value="${u.username || ""}" ${editing ? "disabled" : ""}></div>
          <div class="field"><label>${tr("email")}</label><input id="uf-email" type="email" value="${u.email || ""}"></div>
          <div class="field"><label>${tr("job_title")}</label><input id="uf-job" value="${u.job_title || ""}"></div>
          <div class="field"><label>${tr("role")}</label><select id="uf-role">${optionList(roles, u.role_id)}</select></div>
          <div class="field"><label>${tr("team")}</label><select id="uf-team">
            <option value="">${tr("none")}</option>${optionList(teams, u.team_id)}</select></div>
          <div class="field"><label>${tr("destination")}</label><select id="uf-dest">
            <option value="">${tr("none")}</option>${optionList(dests, u.destination_id)}</select></div>
          <div class="field"><label>${tr("capacity_col")} (h/${tr("hours")})</label>
            <input id="uf-cap" type="number" value="${u.capacity_hours || 40}"></div>
        </div>
        <div class="field"><label>${tr("password")}${editing ? ` <span style="color:var(--text-faint);font-weight:400">(${tr("leave_blank_keep")})</span>` : ""}</label>
          <div style="display:flex;gap:8px">
            <input id="uf-pw" type="text" style="flex:1" autocomplete="new-password" placeholder="••••••••••••">
            <button class="btn btn-sm" id="uf-gen" type="button">${tr("generate")}</button></div></div>
        <div class="field"><label>${tr("confirm_password")}</label><input id="uf-pw2" type="text" autocomplete="new-password"></div>
        <div><div style="font-size:11.5px;font-weight:600;color:var(--text-muted)">${tr("password_policy")}:</div>${pwRulesHTML()}</div>
        <div id="uf-err" class="login-error" style="display:none;margin-top:8px"></div>`,
        `<button class="btn" data-close>${tr("cancel")}</button>
         <button class="btn btn-primary" id="uf-save">${editing ? tr("save") : tr("create_user")}</button>`);

      const pw = P.$("#uf-pw", m.el);
      wirePwRules(m.el, pw);
      P.$("#uf-gen", m.el).onclick = () => { pw.value = genPassword(); P.$("#uf-pw2", m.el).value = pw.value;
        pw.dispatchEvent(new Event("input")); };
      const showErr = msg => { const e = P.$("#uf-err", m.el); e.textContent = msg; e.style.display = "block"; };

      P.$("#uf-save", m.el).onclick = async () => {
        const name = P.$("#uf-name", m.el).value.trim();
        const email = P.$("#uf-email", m.el).value.trim();
        const pwv = pw.value, pw2 = P.$("#uf-pw2", m.el).value;
        if (!name || !email) return showErr(tr("error_occurred"));
        if (!editing || pwv) {
          if (!pwValid(pwv)) return showErr(tr("password_policy"));
          if (pwv !== pw2) return showErr(tr("password_mismatch"));
        }
        const payload = { full_name: name, email, job_title: P.$("#uf-job", m.el).value.trim(),
          role_id: parseInt(P.$("#uf-role", m.el).value),
          team_id: P.$("#uf-team", m.el).value ? parseInt(P.$("#uf-team", m.el).value) : null,
          destination_id: P.$("#uf-dest", m.el).value ? parseInt(P.$("#uf-dest", m.el).value) : null,
          capacity_hours: parseFloat(P.$("#uf-cap", m.el).value) || 40 };
        if (pwv) payload.password = pwv;
        try {
          if (editing) await API.put("/api/users/" + u.id, payload);
          else { payload.username = P.$("#uf-user", m.el).value.trim();
            if (!payload.username) return showErr(tr("error_occurred"));
            await API.post("/api/users", payload); }
          m.close(); P.toast(editing ? tr("user_updated") : tr("user_created"), "ok"); P.route();
        } catch (e) { showErr(e.message || tr("error_occurred")); }
      };
    }

    P.$("#new-user").onclick = () => userModal(null);
    P.$$("[data-edit]").forEach(b => b.onclick = () => {
      const u = users.find(x => x.id === parseInt(b.dataset.edit)); userModal(u);
    });
  });
  function roleClass(r) {
    const s = (r || "").toLowerCase();
    if (s.includes("director")) return "b-red";
    if (s.includes("manager")) return "b-blue";
    if (s.includes("specialist")) return "b-amber";
    return "b-grey";
  }

  // ------------------------------------------------------------- SETTINGS ----
  P.register("settings", async (root) => {
    const isDirector = P.getUser().role_level >= 100;
    const settings = await API.get("/api/settings").catch(() => ({}));
    let backups = [];
    if (isDirector) backups = await API.get("/api/backups").catch(() => []);

    root.innerHTML = `
      <div class="page-head"><div class="page-title">${tr("settings")}</div></div>
      <div class="grid g-2" style="margin-bottom:16px">
        <div class="card"><div class="card-head"><h3>${tr("general")}</h3></div>
          <div class="card-pad">
            <div class="field"><label>${tr("company_name")}</label>
              <input id="set-company" value="${settings.company_name || ""}" ${isDirector ? "" : "disabled"}></div>
            <div class="field"><label>${tr("currency")}</label>
              <input id="set-currency" value="${settings.currency || "EUR"}" ${isDirector ? "" : "disabled"}></div>
            ${isDirector ? `<button class="btn btn-primary" id="set-save">${tr("save")}</button>`
              : `<div style="color:var(--text-muted);font-size:12.5px">${tr("read_only_note")}</div>`}
          </div></div>
        <div class="card"><div class="card-head"><h3>${tr("appearance")}</h3></div>
          <div class="card-pad">
            <div class="field"><label>${tr("theme")}</label>
              <select id="set-theme">
                <option value="light">${tr("light")}</option>
                <option value="dark">${tr("dark")}</option></select></div>
            <div class="field"><label>${tr("language")}</label>
              <select id="set-lang">
                <option value="en">English</option>
                <option value="hr">Hrvatski</option></select></div>
          </div></div>
      </div>
      ${isDirector ? `
      <div class="card"><div class="card-head"><h3>${tr("backups")}</h3>
        <div class="spacer"></div><button class="btn btn-primary btn-sm" id="bk-new">${tr("create_backup")}</button></div>
        <div class="card-pad"><div id="bk-list">${renderBackups(backups)}</div></div></div>` : ""}`;

    P.$("#set-theme").value = document.documentElement.getAttribute("data-theme") || "light";
    P.$("#set-lang").value = window.LOCALE;
    P.$("#set-theme").onchange = e => { window.PPM.applyThemePublic ? window.PPM.applyThemePublic(e.target.value) : 0;
      document.documentElement.setAttribute("data-theme", e.target.value);
      localStorage.setItem("ppm_theme", e.target.value);
      API.put("/api/me/prefs", { theme: e.target.value }).catch(() => {}); P.route(); };
    P.$("#set-lang").onchange = e => { window.setLocale(e.target.value);
      API.put("/api/me/prefs", { locale: e.target.value }).catch(() => {});
      location.reload(); };

    if (isDirector) {
      P.$("#set-save").onclick = async () => {
        await API.put("/api/settings", { company_name: P.$("#set-company").value,
          currency: P.$("#set-currency").value });
        P.toast(tr("saved"), "ok");
      };
      P.$("#bk-new").onclick = async () => {
        await API.post("/api/backups"); P.toast(tr("backup_created"), "ok");
        const b = await API.get("/api/backups"); P.$("#bk-list").innerHTML = renderBackups(b); wireRestore();
      };
      wireRestore();
    }

    function wireRestore() {
      P.$$("[data-restore]").forEach(btn => btn.onclick = async () => {
        if (!confirm(tr("restore_confirm"))) return;
        await API.post("/api/backups/restore", { name: btn.dataset.restore });
        P.toast(tr("restored"), "ok");
      });
    }
  });

  function renderBackups(backups) {
    if (!backups.length) return `<div class="empty">${tr("no_data")}</div>`;
    return `<table class="table"><thead><tr><th>${tr("name")}</th>
      <th class="num">${tr("size")}</th><th>${tr("date")}</th><th></th></tr></thead>
      <tbody>${backups.map(b => `<tr>
        <td class="mono" style="font-size:12px">${b.name || b}</td>
        <td class="num">${b.size ? (b.size / 1024).toFixed(0) + " KB" : "—"}</td>
        <td class="mono" style="font-size:12px">${(b.created || b.mtime || "").toString().replace("T", " ").slice(0, 19)}</td>
        <td style="text-align:right"><button class="btn btn-sm" data-restore="${b.name || b}">${tr("restore")}</button></td>
      </tr>`).join("")}</tbody></table>`;
  }

  // ------------------------------------------------------- MY PREFERENCES ----
  P.register("settings-me", async (root) => {
    const u = P.getUser();
    root.innerHTML = `
      <div class="page-head"><div class="page-title">${tr("my_preferences")}</div></div>
      <div class="card" style="max-width:560px"><div class="card-pad">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
          ${P.avatar(u.full_name, u.avatar_color, 56)}
          <div><div style="font-size:18px;font-weight:700">${u.full_name}</div>
            <div style="color:var(--text-muted)">${u.role_name} · ${u.job_title || ""}</div></div></div>
        <div class="kv"><span class="k">${tr("username")}</span><span class="v">@${u.username}</span></div>
        <div class="kv"><span class="k">${tr("email")}</span><span class="v">${u.email || "—"}</span></div>
        <div class="kv"><span class="k">${tr("role")}</span><span class="v">${u.role_name}</span></div>
        <div class="kv"><span class="k">${tr("team")}</span><span class="v">${u.team_name || "—"}</span></div>
        <div class="field" style="margin-top:18px"><label>${tr("language")}</label>
          <select id="me-lang"><option value="en">English</option><option value="hr">Hrvatski</option></select></div>
        <div class="field"><label>${tr("theme")}</label>
          <select id="me-theme"><option value="light">${tr("light")}</option><option value="dark">${tr("dark")}</option></select></div>
      </div></div>`;
    P.$("#me-lang").value = window.LOCALE;
    P.$("#me-theme").value = document.documentElement.getAttribute("data-theme") || "light";
    P.$("#me-lang").onchange = e => { window.setLocale(e.target.value);
      API.put("/api/me/prefs", { locale: e.target.value }).catch(() => {}); location.reload(); };
    P.$("#me-theme").onchange = e => {
      document.documentElement.setAttribute("data-theme", e.target.value);
      localStorage.setItem("ppm_theme", e.target.value);
      API.put("/api/me/prefs", { theme: e.target.value }).catch(() => {}); P.route(); };
  });
})();
