/* Delivery views: projects, project detail, tasks, kanban, gantt, calendar. */
(function () {
  const P = window.PPM, tr = P.tr, C = window.Charts;

  // ---------------------------------------------------------------- PROJECTS -
  P.register("projects", async (root) => {
    const [projects, portfolios, programs, users] = await Promise.all([
      API.get("/api/projects"), API.get("/api/portfolios"),
      API.get("/api/programs").catch(() => []), API.get("/api/users").catch(() => [])]);
    root.innerHTML = `
      <div class="page-head"><div class="page-title">${tr("projects")}</div>
        <div class="page-actions">
          ${P.canWrite() ? `<button class="btn btn-primary" id="new-proj">${P.svg(P.IC.plus, 16)} ${tr("new_project")}</button>` : ""}
        </div></div>
      <div class="filters">
        <select id="f-status"><option value="">${tr("all")} · ${tr("status")}</option>
          ${["planning", "active", "on_hold", "completed", "cancelled"].map(s => `<option value="${s}">${P.statusLabel(s)}</option>`).join("")}</select>
        <select id="f-port"><option value="">${tr("all")} · ${tr("portfolio")}</option>
          ${portfolios.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}</select>
      </div>
      <div class="card"><table class="table"><thead><tr>
        <th>${tr("name")}</th><th>${tr("portfolio")}</th><th>${tr("manager")}</th>
        <th>${tr("status")}</th><th>${tr("priority")}</th><th>${tr("health")}</th>
        <th class="num">${tr("budget")}</th><th style="width:150px">${tr("progress")}</th></tr></thead>
        <tbody id="proj-body"></tbody></table></div>`;

    const render = (list) => {
      P.$("#proj-body").innerHTML = list.map(p => `
        <tr class="row-link" data-id="${p.id}">
          <td><b>${p.name}</b><div style="font-size:11px;color:var(--text-faint)">${p.code || ""}</div></td>
          <td>${p.portfolio || "—"}</td><td>${p.manager || "—"}</td>
          <td>${P.badge(p.status)}</td><td>${P.badge(p.priority, P.prioClass(p.priority))}</td>
          <td><span class="dot-i" style="background:${{ green: "#16a34a", amber: "#d97706", red: "#dc2626" }[p.health]}"></span></td>
          <td class="num">${P.money(p.budget)}</td>
          <td>${P.pbar(Math.round(p.progress))}</td></tr>`).join("")
        || `<tr><td colspan="8"><div class="empty">${tr("no_data")}</div></td></tr>`;
      P.$$("#proj-body .row-link").forEach(r => r.onclick = () => location.hash = "project/" + r.dataset.id);
    };
    const apply = () => {
      let list = projects;
      const st = P.$("#f-status").value, po = P.$("#f-port").value;
      if (st) list = list.filter(p => p.status === st);
      if (po) list = list.filter(p => String(p.portfolio_id) === po);
      render(list);
    };
    P.$("#f-status").onchange = apply; P.$("#f-port").onchange = apply;
    render(projects);

    if (P.$("#new-proj")) P.$("#new-proj").onclick = () => {
      const opt = (arr, extra) => (extra ? `<option value="">${extra}</option>` : "") +
        arr.map(x => `<option value="${x.id}">${x.name || x.full_name}</option>`).join("");
      const m = P.modal(tr("new_project"), `
        <div style="font-size:11.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px">${tr("basics")}</div>
        <div class="grid g-2">
          <div class="field"><label>${tr("name")}</label><input id="np-name"></div>
          <div class="field"><label>${tr("code")} <span style="color:var(--text-faint);font-weight:400">(${tr("optional")})</span></label><input id="np-code" placeholder="PRJ-000"></div>
        </div>
        <div class="field"><label>${tr("description")}</label><input id="np-desc"></div>
        <div class="grid g-2">
          <div class="field"><label>${tr("portfolio")}</label><select id="np-port">${opt(portfolios)}</select></div>
          <div class="field"><label>${tr("program")}</label><select id="np-prog">${opt(programs, tr("none"))}</select></div>
          <div class="field"><label>${tr("manager")}</label><select id="np-mgr">${opt(users, tr("unassigned"))}</select></div>
          <div class="field"><label>${tr("budget")} (€)</label><input id="np-budget" type="number" value="100000"></div>
        </div>
        <div style="font-size:11.5px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin:14px 0 8px">${tr("planning_section")}</div>
        <div class="grid g-2">
          <div class="field"><label>${tr("status")}</label><select id="np-status">
            ${["planning", "active", "on_hold", "completed", "cancelled"].map(s => `<option value="${s}">${P.statusLabel(s)}</option>`).join("")}</select></div>
          <div class="field"><label>${tr("priority")}</label><select id="np-prio">
            ${["low", "medium", "high", "critical"].map(s => `<option value="${s}" ${s === "medium" ? "selected" : ""}>${P.statusLabel(s)}</option>`).join("")}</select></div>
          <div class="field"><label>${tr("health")}</label><select id="np-health">
            ${[["green", tr("on_track")], ["amber", tr("at_risk")], ["red", tr("off_track")]].map(([v, l]) => `<option value="${v}">${l}</option>`).join("")}</select></div>
          <div class="field"><label>${tr("stage_gate")}</label><select id="np-gate">
            ${["G0", "G1", "G2", "G3", "G4"].map(s => `<option value="${s}">${s}</option>`).join("")}</select></div>
          <div class="field"><label>${tr("start_date")}</label><input id="np-start" type="date"></div>
          <div class="field"><label>${tr("end_date")}</label><input id="np-due" type="date"></div>
        </div>`,
        `<button class="btn" data-close>${tr("cancel")}</button><button class="btn btn-primary" id="np-save">${tr("create")}</button>`);
      P.$("#np-save", m.el).onclick = async () => {
        const name = P.$("#np-name", m.el).value.trim();
        if (!name) return P.toast(tr("name") + " ?", "err");
        const v = id => P.$(id, m.el).value;
        try {
          await API.post("/api/projects", { name, code: v("#np-code") || null,
            description: v("#np-desc"), portfolio_id: v("#np-port") || null,
            program_id: v("#np-prog") || null, manager_id: v("#np-mgr") || null,
            status: v("#np-status"), priority: v("#np-prio"), health: v("#np-health"),
            stage_gate: v("#np-gate"), start_date: v("#np-start") || null,
            end_date: v("#np-due") || null, budget: parseFloat(v("#np-budget")) || 0 });
          m.close(); P.toast(tr("new_project_created"), "ok"); P.route();
        } catch (e) { P.toast(e.message || tr("error_occurred"), "err"); }
      };
    };
  });

  // ---------------------------------------------------------- PROJECT DETAIL -
  P.register("project", async (root, id) => {
    const [p, dash] = await Promise.all([
      API.get("/api/projects/" + id), API.get("/api/dashboard/project?id=" + id)]);
    root.innerHTML = `
      <div class="page-head"><div>
        <div class="tb-crumb"><a href="#projects">${tr("projects")}</a> / ${p.code || ""}</div>
        <div class="page-title">${p.name}</div>
        <div class="page-desc">${p.description || ""}</div></div>
        <div class="page-actions">${P.badge(p.status)} ${P.badge(p.priority, P.prioClass(p.priority))}</div></div>
      <div class="grid g-4" style="margin-bottom:16px">
        ${P.statCard(tr("budget"), P.money(p.budget), { icon: "financial" })}
        ${P.statCard(tr("actual_cost"), P.money(p.actual_cost), { icon: "financial",
          iconBg: p.actual_cost > p.budget ? "var(--red-100)" : "var(--green-100)",
          iconColor: p.actual_cost > p.budget ? "var(--red-500)" : "var(--green-500)" })}
        ${P.statCard(tr("progress"), Math.round(p.progress) + "%", { icon: "kpi" })}
        ${P.statCard(tr("stage_gate"), p.stage_gate, { icon: "approvals" })}
      </div>
      <div class="grid g-2" style="margin-bottom:16px">
        ${P.cardChart("projects_by_status", "pd-status", 240, "tasks")}
        <div class="card"><div class="card-head"><h3>${tr("estimate")} vs ${tr("actual")}</h3></div>
          <div class="card-pad"><div id="pd-ea"></div></div></div>
      </div>
      <div class="grid g-3" style="margin-bottom:16px">
        <div class="card"><div class="card-head"><h3>${tr("milestones")}</h3></div>
          <div class="card-pad">${p.milestones.length ? p.milestones.map(m => `
            <div class="kv"><span class="k">${m.name}</span>
            <span>${P.badge(m.status)} <span class="mono" style="font-size:11px;color:var(--text-faint)">${m.due_date || ""}</span></span></div>`).join("")
            : `<div class="empty">${tr("no_data")}</div>`}</div></div>
        <div class="card"><div class="card-head"><h3>${tr("risk")}</h3></div>
          <div class="card-pad">${p.risks.length ? p.risks.slice(0, 5).map(r => `
            <div class="kv"><span class="k">${r.title}</span>
            <span class="badge ${r.severity >= 15 ? "b-red" : r.severity >= 8 ? "b-amber" : "b-grey"}">${r.severity}</span></div>`).join("")
            : `<div class="empty">${tr("no_data")}</div>`}</div></div>
        <div class="card"><div class="card-head"><h3>${tr("team_members")}</h3></div>
          <div class="card-pad">${p.team.length ? p.team.map(u => `
            <div class="kv"><span class="k" style="display:flex;align-items:center;gap:8px">${P.avatar(u.full_name, u.avatar_color, 24)} ${u.full_name}</span>
            <span class="mono" style="font-size:12px">${u.allocation_percent}%</span></div>`).join("")
            : `<div class="empty">${tr("no_data")}</div>`}</div></div>
      </div>
      <div class="card"><div class="card-head"><h3>${tr("stage_gate")}</h3></div>
        <div class="card-pad" style="display:flex;gap:8px;flex-wrap:wrap">
          ${p.stage_gates.map(g => `<span class="badge ${g.status === "passed" ? "b-green" : "b-grey"}">${g.gate} ${g.status === "passed" ? "✓" : ""}</span>`).join("")}
        </div></div>`;

    C.donut(document.getElementById("pd-status"), {
      data: Object.entries(dash.by_status).map(([k, v]) => ({ label: P.statusLabel(k), value: v })),
      centerLabel: tr("tasks"), height: 220,
    });
    C.bar(document.getElementById("pd-ea"), {
      labels: [tr("estimate"), tr("actual")],
      series: [{ name: tr("hours"), data: [dash.estimate_vs_actual.estimate, dash.estimate_vs_actual.actual], color: "#2563eb" }],
      height: 220,
    });
  });

  // ------------------------------------------------------------------- TASKS -
  P.register("tasks", async (root) => {
    const [tasks, users, projects] = await Promise.all([
      API.get("/api/tasks"), API.get("/api/users"), API.get("/api/projects")]);
    root.innerHTML = `
      <div class="page-head"><div class="page-title">${tr("tasks")}</div>
        <div class="page-actions">
          ${P.canWrite() ? `<button class="btn btn-primary" id="new-task">${P.svg(P.IC.plus, 16)} ${tr("new_task")}</button>` : ""}</div></div>
      <div class="filters">
        <select id="tf-status"><option value="">${tr("all")} · ${tr("status")}</option>
          ${["todo", "in_progress", "review", "blocked", "done"].map(s => `<option value="${s}">${P.statusLabel(s)}</option>`).join("")}</select>
        <label style="display:flex;align-items:center;gap:6px;font-size:12.5px"><input type="checkbox" id="tf-mine"> ${tr("assignee")}: ${P.getUser().full_name.split(" ")[0]}</label>
      </div>
      <div class="card"><table class="table"><thead><tr>
        <th>${tr("name")}</th><th>${tr("project")}</th><th>${tr("assignee")}</th>
        <th>${tr("status")}</th><th>${tr("priority")}</th><th>${tr("due")}</th>
        <th class="num">${tr("estimate")}</th></tr></thead><tbody id="task-body"></tbody></table></div>`;

    const render = (list) => {
      P.$("#task-body").innerHTML = list.map(t => `
        <tr class="row-link" data-id="${t.id}"><td><b>${t.title}</b>
          ${t.checklist_total ? `<span style="font-size:11px;color:var(--text-faint)"> ✓ ${t.checklist_done}/${t.checklist_total}</span>` : ""}</td>
          <td>${t.project || "—"}</td>
          <td>${t.assignee ? P.avatar(t.assignee, t.avatar_color, 24) + " " : "—"}</td>
          <td>${P.badge(t.status)}</td><td>${P.badge(t.priority, P.prioClass(t.priority))}</td>
          <td class="mono" style="font-size:12px">${t.due_date || "—"}</td>
          <td class="num">${t.estimate_hours}h</td></tr>`).join("")
        || `<tr><td colspan="7"><div class="empty">${tr("no_data")}</div></td></tr>`;
      P.$$("#task-body .row-link").forEach(r => r.onclick = () => openTask(r.dataset.id));
    };
    const apply = () => {
      let list = tasks; const st = P.$("#tf-status").value;
      if (st) list = list.filter(t => t.status === st);
      if (P.$("#tf-mine").checked) list = list.filter(t => t.assignee_id === P.getUser().id);
      render(list);
    };
    P.$("#tf-status").onchange = apply; P.$("#tf-mine").onchange = apply;
    render(tasks);

    if (P.$("#new-task")) P.$("#new-task").onclick = () => {
      const m = P.modal(tr("new_task"), `
        <div class="field"><label>${tr("name")}</label><input id="nt-title"></div>
        <div class="field"><label>${tr("description")}</label><input id="nt-desc"></div>
        <div class="grid g-2">
          <div class="field"><label>${tr("project")}</label><select id="nt-proj">
            ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}</select></div>
          <div class="field"><label>${tr("assignee")}</label><select id="nt-assignee">
            <option value="">${tr("unassigned")}</option>
            ${users.map(u => `<option value="${u.id}">${u.full_name}</option>`).join("")}</select></div>
          <div class="field"><label>${tr("status")}</label><select id="nt-status">
            ${["todo", "in_progress", "review", "blocked", "done"].map(s => `<option value="${s}">${P.statusLabel(s)}</option>`).join("")}</select></div>
          <div class="field"><label>${tr("priority")}</label><select id="nt-prio">
            ${["low", "medium", "high", "critical"].map(s => `<option value="${s}" ${s === "medium" ? "selected" : ""}>${P.statusLabel(s)}</option>`).join("")}</select></div>
          <div class="field"><label>${tr("estimate")} (h)</label><input id="nt-est" type="number" value="8"></div>
          <div class="field"><label>${tr("start_date")}</label><input id="nt-start" type="date"></div>
          <div class="field"><label>${tr("due")}</label><input id="nt-due" type="date"></div></div>`,
        `<button class="btn" data-close>${tr("cancel")}</button><button class="btn btn-primary" id="nt-save">${tr("create")}</button>`);
      P.$("#nt-save", m.el).onclick = async () => {
        const title = P.$("#nt-title", m.el).value.trim(); if (!title) return;
        const v = id => P.$(id, m.el).value;
        try {
          await API.post("/api/tasks", { title, description: v("#nt-desc"),
            project_id: v("#nt-proj"), assignee_id: v("#nt-assignee") || null,
            status: v("#nt-status"), priority: v("#nt-prio"),
            estimate_hours: parseFloat(v("#nt-est")) || 0,
            start_date: v("#nt-start") || null, due_date: v("#nt-due") || null });
          m.close(); P.toast(tr("saved"), "ok"); P.route();
        } catch (e) { P.toast(e.message || tr("error_occurred"), "err"); }
      };
    };
  });

  async function openTask(id) {
    const t = await API.get("/api/tasks/" + id);
    const canEdit = P.canWrite() && (P.getUser().role_level >= 70 || t.assignee_id === P.getUser().id);
    const m = P.modal(t.title, `
      <div style="display:flex;gap:8px;margin-bottom:14px">${P.badge(t.status)} ${P.badge(t.priority, P.prioClass(t.priority))}
        <span style="margin-left:auto;color:var(--text-muted);font-size:12px">${t.project}</span></div>
      <p style="color:var(--text-muted);margin-bottom:14px">${t.description || ""}</p>
      <div class="grid g-2" style="margin-bottom:14px">
        <div class="kv"><span class="k">${tr("assignee")}</span><span class="v">${t.assignee || "—"}</span></div>
        <div class="kv"><span class="k">${tr("due")}</span><span class="v">${t.due_date || "—"}</span></div>
        <div class="kv"><span class="k">${tr("estimate")}</span><span class="v">${t.estimate_hours}h</span></div>
        <div class="kv"><span class="k">${tr("actual")}</span><span class="v">${t.actual_hours}h</span></div></div>
      ${canEdit ? `<div class="field"><label>${tr("status")}</label><select id="t-status">
        ${["todo", "in_progress", "review", "blocked", "done"].map(s => `<option value="${s}" ${s === t.status ? "selected" : ""}>${P.statusLabel(s)}</option>`).join("")}</select></div>` : ""}
      ${t.checklist.length ? `<h4 style="margin:12px 0 6px;font-size:12px;color:var(--text-muted)">Checklist</h4>
        ${t.checklist.map(c => `<label style="display:flex;gap:8px;padding:4px 0;font-size:13px">
          <input type="checkbox" data-chk="${c.id}" ${c.is_done ? "checked" : ""} ${canEdit ? "" : "disabled"}> ${c.text}</label>`).join("")}` : ""}
      <h4 style="margin:14px 0 6px;font-size:12px;color:var(--text-muted)">${tr("comment")}</h4>
      <div id="t-comments">${t.comments.map(c => `<div style="display:flex;gap:8px;margin-bottom:8px">
        ${P.avatar(c.author, c.avatar_color, 26)}<div><b style="font-size:12px">${c.author}</b>
        <div style="font-size:13px;color:var(--text-muted)">${c.body}</div></div></div>`).join("") || `<div style="color:var(--text-faint);font-size:12px">—</div>`}</div>
      ${canEdit ? `<div style="display:flex;gap:8px;margin-top:8px">
        <input id="t-comment" placeholder="${tr("add_comment")}…" style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">
        <button class="btn btn-primary btn-sm" id="t-send">→</button></div>` : ""}`,
      canEdit ? `<div style="display:flex;gap:8px;align-items:center;flex:1">
        <input id="t-hours" type="number" placeholder="h" style="width:70px;padding:7px;border:1px solid var(--border);border-radius:7px;background:var(--surface);color:var(--text)">
        <button class="btn btn-sm" id="t-logtime">${tr("log_time")}</button></div>
        <button class="btn" data-close>${tr("cancel")}</button>
        <button class="btn btn-primary" id="t-save">${tr("save")}</button>` : `<button class="btn" data-close>${tr("cancel")}</button>`);

    if (canEdit) {
      P.$("#t-save", m.el).onclick = async () => {
        await API.put("/api/tasks/" + id, { status: P.$("#t-status", m.el).value });
        m.close(); P.toast(tr("saved"), "ok"); P.route();
      };
      P.$$("[data-chk]", m.el).forEach(c => c.onchange = () =>
        API.put("/api/checklist/" + c.dataset.chk, { is_done: c.checked }));
      if (P.$("#t-send", m.el)) P.$("#t-send", m.el).onclick = async () => {
        const body = P.$("#t-comment", m.el).value.trim(); if (!body) return;
        await API.post(`/api/tasks/${id}/comments`, { body }); m.close(); openTask(id);
      };
      if (P.$("#t-logtime", m.el)) P.$("#t-logtime", m.el).onclick = async () => {
        const h = parseFloat(P.$("#t-hours", m.el).value); if (!h) return;
        await API.post(`/api/tasks/${id}/time`, { hours: h }); P.toast(tr("saved"), "ok"); m.close(); openTask(id);
      };
    }
  }

  // ------------------------------------------------------------------ KANBAN -
  P.register("kanban", async (root) => {
    const projects = await API.get("/api/projects");
    const cols = [["todo", "#64748b"], ["in_progress", "#2563eb"], ["review", "#d97706"],
                  ["blocked", "#dc2626"], ["done", "#16a34a"]];
    root.innerHTML = `
      <div class="page-head"><div class="page-title">${tr("kanban")}</div>
        <div class="page-actions"><select id="kb-proj" class="filters">
          <option value="">${tr("all")} ${tr("projects")}</option>
          ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}</select></div></div>
      <div id="kb-board"></div>`;
    P.$("#kb-proj").style.padding = "7px 11px";
    P.$("#kb-proj").style.border = "1px solid var(--border)";
    P.$("#kb-proj").style.borderRadius = "8px";

    async function load() {
      const proj = P.$("#kb-proj").value;
      const tasks = await API.get("/api/tasks" + (proj ? "?project_id=" + proj : ""));
      const byStatus = {}; cols.forEach(([s]) => byStatus[s] = []);
      tasks.forEach(t => (byStatus[t.status] || byStatus.todo).push(t));
      P.$("#kb-board").className = "kanban";
      P.$("#kb-board").innerHTML = cols.map(([s, color]) => `
        <div class="kcol" data-status="${s}">
          <div class="kcol-head"><span class="dot-i" style="background:${color}"></span>${P.statusLabel(s)}
            <span class="count">${byStatus[s].length}</span></div>
          <div class="kcol-body" data-body="${s}">
            ${byStatus[s].map(t => kcard(t)).join("")}</div></div>`).join("");
      wireDnD();
    }
    function kcard(t) {
      return `<div class="kcard" draggable="${P.canWrite()}" data-id="${t.id}">
        <div class="kcard-title">${t.title}</div>
        <div class="kcard-meta">${P.badge(t.priority, P.prioClass(t.priority))}
          ${t.checklist_total ? `<span class="badge b-grey">✓ ${t.checklist_done}/${t.checklist_total}</span>` : ""}</div>
        <div class="kcard-foot">${t.assignee ? P.avatar(t.assignee, t.avatar_color, 22) : ""}
          <span style="margin-left:auto">${t.due_date || ""}</span></div></div>`;
    }
    function wireDnD() {
      let dragged = null;
      P.$$(".kcard").forEach(c => {
        c.onclick = () => openTask(c.dataset.id);
        c.ondragstart = e => { dragged = c; c.classList.add("dragging"); e.dataTransfer.effectAllowed = "move"; };
        c.ondragend = () => { c.classList.remove("dragging"); dragged = null; };
      });
      P.$$(".kcol").forEach(col => {
        col.ondragover = e => { e.preventDefault(); col.classList.add("drop"); };
        col.ondragleave = () => col.classList.remove("drop");
        col.ondrop = async e => {
          e.preventDefault(); col.classList.remove("drop");
          if (!dragged) return;
          const status = col.dataset.status, id = dragged.dataset.id;
          P.$(`[data-body="${status}"]`, col.parentElement.parentElement || document).appendChild(dragged);
          col.querySelector(".kcol-body").appendChild(dragged);
          try { await API.put(`/api/tasks/${id}/status`, { status });
            P.toast(tr("saved"), "ok"); load();
          } catch (err) { P.toast(err.message || tr("error_occurred"), "err"); load(); }
        };
      });
    }
    P.$("#kb-proj").onchange = load;
    load();
  });

  // ------------------------------------------------------------------- GANTT -
  P.register("gantt", async (root) => {
    const projects = await API.get("/api/projects");
    root.innerHTML = `
      <div class="page-head"><div class="page-title">${tr("gantt")}</div>
        <div class="page-actions"><select id="gt-proj" style="padding:7px 11px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text)">
          ${projects.map(p => `<option value="${p.id}">${p.name}</option>`).join("")}</select></div></div>
      <div id="gt-wrap"></div>`;
    async function load() {
      const pid = P.$("#gt-proj").value;
      const proj = await API.get("/api/projects/" + pid);
      let tasks = await API.get("/api/tasks?project_id=" + pid);
      tasks = tasks.filter(t => t.start_date && t.due_date);
      const items = tasks.map(t => ({ label: t.title, start: t.start_date, end: t.due_date,
        progress: t.progress, color: "#2563eb" }));
      proj.milestones.forEach(mst => { if (mst.due_date) items.push({ label: mst.name, start: mst.due_date, end: mst.due_date, milestone: true }); });
      renderGantt(P.$("#gt-wrap"), items);
    }
    P.$("#gt-proj").onchange = load; load();
  });

  function renderGantt(wrap, items) {
    if (!items.length) { wrap.innerHTML = `<div class="empty">${tr("no_data")}</div>`; return; }
    const dates = items.flatMap(i => [new Date(i.start), new Date(i.end)]);
    let min = new Date(Math.min(...dates)), max = new Date(Math.max(...dates));
    min.setDate(min.getDate() - 2); max.setDate(max.getDate() + 2);
    const totalDays = Math.max(1, Math.round((max - min) / 864e5));
    const dayW = Math.max(6, Math.min(30, 900 / totalDays));
    const trackW = totalDays * dayW;
    const dayOf = dstr => Math.round((new Date(dstr) - min) / 864e5);
    // month markers
    let months = ""; let cur = new Date(min.getFullYear(), min.getMonth(), 1);
    while (cur <= max) {
      const off = Math.max(0, Math.round((cur - min) / 864e5));
      months += `<div class="gantt-month" style="left:${off * dayW}px">${cur.toLocaleString(window.LOCALE, { month: "short", year: "2-digit" })}</div>`;
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
    }
    wrap.innerHTML = `<div class="gantt"><div style="min-width:${220 + trackW}px">
      <div class="gantt-head"><div class="h-label">${tr("name")}</div>
        <div class="gantt-months" style="width:${trackW}px">${months}</div></div>
      ${items.map(it => {
        const s = dayOf(it.start), e = dayOf(it.end), w = Math.max(1, e - s);
        if (it.milestone) return `<div class="gantt-row"><div class="gantt-label">◆ ${it.label}</div>
          <div class="gantt-track" style="--daywidth:${dayW}px;width:${trackW}px">
          <div class="gantt-milestone" style="left:${s * dayW - 9}px" title="${it.label}"></div></div></div>`;
        return `<div class="gantt-row"><div class="gantt-label">${it.label}</div>
          <div class="gantt-track" style="--daywidth:${dayW}px;width:${trackW}px">
          <div class="gantt-bar" style="left:${s * dayW}px;width:${w * dayW}px"
            title="${it.label}: ${it.start} → ${it.end}">
            <div class="fill" style="width:${it.progress || 0}%"></div>
            <span style="position:relative">${it.progress ? it.progress + "%" : ""}</span></div></div></div>`;
      }).join("")}</div></div>`;
  }

  // ---------------------------------------------------------------- CALENDAR -
  P.register("calendar", async (root) => {
    const tasks = await API.get("/api/tasks");
    let view = new Date(); view.setDate(1);
    function render() {
      const y = view.getFullYear(), mo = view.getMonth();
      const first = new Date(y, mo, 1), startDay = (first.getDay() + 6) % 7; // Mon=0
      const days = new Date(y, mo + 1, 0).getDate();
      const today = new Date();
      const evByDay = {};
      tasks.forEach(t => { if (t.due_date) { const dd = new Date(t.due_date);
        if (dd.getFullYear() === y && dd.getMonth() === mo) (evByDay[dd.getDate()] = evByDay[dd.getDate()] || []).push(t); } });
      const dow = window.LOCALE === "hr" ? ["Pon", "Uto", "Sri", "Čet", "Pet", "Sub", "Ned"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      let cells = "";
      for (let i = 0; i < startDay; i++) cells += `<div class="cal-cell off"></div>`;
      for (let dnum = 1; dnum <= days; dnum++) {
        const isToday = today.getFullYear() === y && today.getMonth() === mo && today.getDate() === dnum;
        const evs = evByDay[dnum] || [];
        cells += `<div class="cal-cell ${isToday ? "today" : ""}"><div class="cal-date">${dnum}</div>
          ${evs.slice(0, 3).map(e => `<div class="cal-ev" data-id="${e.id}" title="${e.title}">${e.title}</div>`).join("")}
          ${evs.length > 3 ? `<div style="font-size:10px;color:var(--text-faint);margin-top:2px">+${evs.length - 3}</div>` : ""}</div>`;
      }
      root.innerHTML = `
        <div class="page-head"><div class="page-title">${tr("calendar")}</div>
          <div class="page-actions">
            <button class="btn btn-sm" id="cal-prev">‹</button>
            <b style="min-width:150px;text-align:center">${first.toLocaleString(window.LOCALE, { month: "long", year: "numeric" })}</b>
            <button class="btn btn-sm" id="cal-next">›</button></div></div>
        <div class="cal"><div class="cal-head">${dow.map(d => `<div>${d}</div>`).join("")}</div>
          <div class="cal-grid">${cells}</div></div>`;
      P.$("#cal-prev").onclick = () => { view.setMonth(view.getMonth() - 1); render(); };
      P.$("#cal-next").onclick = () => { view.setMonth(view.getMonth() + 1); render(); };
      P.$$(".cal-ev").forEach(e => e.onclick = () => openTask(e.dataset.id));
    }
    render();
  });

  window.PPM.openTask = openTask;
})();
