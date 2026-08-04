/* Governance views: Workflow engine, RACI, SLA, Approvals, Audit trail. */
(function () {
  const P = window.PPM, tr = P.tr, C = window.Charts;
  function fmtAction(json) {
    if (!json) return "—";
    try { const o = typeof json === "string" ? JSON.parse(json) : json;
      return o.type || o.action || Object.keys(o).map(k => `${k}=${o[k]}`).join(", ");
    } catch (e) { return String(json).slice(0, 40); }
  }

  // ------------------------------------------------------------- WORKFLOW ----
  P.register("workflow", async (root) => {
    const [wfs, autos] = await Promise.all([
      API.get("/api/workflows"), API.get("/api/automations")]);
    root.innerHTML = `
      <div class="page-head"><div><div class="page-title">${tr("workflow_engine")}</div>
        <div class="page-desc">${tr("active_workflows")} · ${tr("automation_rules")}</div></div></div>
      ${wfs.map(w => `
        <div class="card" style="margin-bottom:16px"><div class="card-head">
          <h3>${w.name}</h3><span class="sub">${w.entity_type || ""}</span></div>
          <div class="card-pad">
            <div class="wf-flow">${w.states.sort((a, b) => a.order_index - b.order_index).map((s, i) => `
              <div class="wf-state" style="border-color:${s.color || "var(--border)"}">
                <span class="wf-dot" style="background:${s.color || "var(--blue-500)"}"></span>${s.name}</div>
              ${i < w.states.length - 1 ? `<span class="wf-arrow">→</span>` : ""}`).join("")}</div>
            <table class="table" style="margin-top:14px"><thead><tr>
              <th>${tr("from_state")}</th><th>${tr("to_state")}</th><th>${tr("trigger")}</th></tr></thead>
              <tbody>${w.transitions.map(t => `<tr><td>${t.from_state || "—"}</td>
                <td>${t.to_state || "—"}</td><td><span class="badge b-grey">${t.name || t.trigger || "manual"}</span></td></tr>`).join("")
                || `<tr><td colspan="3"><div class="empty">${tr("no_data")}</div></td></tr>`}</tbody></table>
          </div></div>`).join("")}
      <div class="card"><div class="card-head"><h3>${tr("automations")}</h3></div>
        <table class="table"><thead><tr><th>${tr("name")}</th><th>${tr("trigger")}</th>
          <th>${tr("action")}</th><th>${tr("status")}</th></tr></thead>
          <tbody>${autos.map(a => `<tr><td><b>${a.name}</b></td>
            <td><span class="mono" style="font-size:12px">${a.trigger_type || "—"}</span></td>
            <td><span class="mono" style="font-size:11.5px;color:var(--text-muted)">${fmtAction(a.action_json)}</span></td>
            <td>${P.badge(a.is_active ? "active" : "on_hold")}</td></tr>`).join("")
            || `<tr><td colspan="4"><div class="empty">${tr("no_data")}</div></td></tr>`}</tbody></table></div>`;
  });

  // ----------------------------------------------------------------- RACI ----
  P.register("raci", async (root) => {
    const matrices = await API.get("/api/raci");
    root.innerHTML = `
      <div class="page-head"><div><div class="page-title">${tr("raci_matrix")}</div>
        <div class="page-desc">${tr("responsible")} · ${tr("accountable")} · ${tr("consulted")} · ${tr("informed")}</div></div>
        <div class="page-actions"><select id="rc-sel" class="filters">
          ${matrices.map(m => `<option value="${m.id}">${m.name}${m.project ? " — " + m.project : ""}</option>`).join("")}</select></div></div>
      <div id="rc-body"></div>`;
    P.$("#rc-sel").style.padding = "7px 11px";
    P.$("#rc-sel").style.border = "1px solid var(--border)";
    P.$("#rc-sel").style.borderRadius = "8px";

    async function load() {
      const id = P.$("#rc-sel").value;
      const m = await API.get("/api/raci/" + id);
      const members = m.members;
      const cell = (act, uid) => {
        const a = act.assignments.find(x => x.user_id === uid);
        return a ? `<span class="raci-cell r-${a.letter}">${a.letter}</span>` : "";
      };
      P.$("#rc-body").innerHTML = `
        <div class="card" style="margin-bottom:16px"><div style="overflow:auto"><table class="raci">
          <thead><tr><th>${tr("activity")}</th>
            ${members.map(u => `<th title="${u.name}">${P.avatar(u.name, u.color, 30)}</th>`).join("")}</tr></thead>
          <tbody>${m.activities.map(act => `<tr><td>${act.name}</td>
            ${members.map(u => `<td>${cell(act, u.id)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>
          <div class="legend">
            <span class="lg"><span class="raci-cell r-R" style="width:22px;height:22px">R</span>${tr("responsible")}</span>
            <span class="lg"><span class="raci-cell r-A" style="width:22px;height:22px">A</span>${tr("accountable")}</span>
            <span class="lg"><span class="raci-cell r-C" style="width:22px;height:22px">C</span>${tr("consulted")}</span>
            <span class="lg"><span class="raci-cell r-I" style="width:22px;height:22px">I</span>${tr("informed")}</span>
          </div></div>
        <div class="card"><div class="card-head"><h3>${tr("validation")}</h3></div>
          <div class="card-pad">${m.warnings.length ? m.warnings.map(w => `
            <div class="kv"><span class="k" style="color:var(--red-500)">⚠ ${w.activity}</span>
            <span class="v" style="font-weight:400;color:var(--text-muted)">${w.issue}</span></div>`).join("")
            : `<div style="display:flex;align-items:center;gap:8px;color:var(--green-500);font-weight:600">
                 ✓ ${tr("raci_valid")}</div>`}</div></div>`;
    }
    P.$("#rc-sel").onchange = load; load();
  });

  // ------------------------------------------------------------------ SLA ----
  P.register("sla", async (root) => {
    const [policies, tickets] = await Promise.all([
      API.get("/api/sla/policies"), API.get("/api/sla/tickets")]);
    const isBreach = t => !!(t.breached_response || t.breached_resolution);
    const breached = tickets.filter(isBreach).length;
    root.innerHTML = `
      <div class="page-head"><div class="page-title">${tr("sla_management")}</div></div>
      <div class="grid g-4" style="margin-bottom:16px">
        ${P.statCard(tr("policy") + "s", policies.length, { icon: "sla" })}
        ${P.statCard(tr("tickets"), tickets.length, { icon: "tasks", iconBg: "var(--blue-100)", iconColor: "var(--blue-600)" })}
        ${P.statCard(tr("breached_count"), breached, { icon: "risk", iconBg: "var(--red-100)", iconColor: "var(--red-500)" })}
        ${P.statCard(tr("on_time"), tickets.length - breached, { icon: "approvals", iconBg: "var(--green-100)", iconColor: "var(--green-500)" })}
      </div>
      <div class="card" style="margin-bottom:16px"><div class="card-head"><h3>${tr("policy")}</h3></div>
        <table class="table"><thead><tr><th>${tr("name")}</th><th>${tr("priority")}</th>
          <th class="num">${tr("response_time")}</th><th class="num">${tr("resolution_time")}</th></tr></thead>
          <tbody>${policies.map(p => `<tr><td><b>${p.name}</b></td>
            <td>${P.badge(p.priority || "medium", P.prioClass(p.priority))}</td>
            <td class="num">${p.response_minutes} ${tr("minutes")}</td>
            <td class="num">${p.resolution_minutes} ${tr("minutes")}</td></tr>`).join("")}</tbody></table></div>
      <div class="card"><div class="card-head"><h3>${tr("tickets")}</h3></div>
        <table class="table"><thead><tr><th>${tr("name")}</th><th>${tr("policy")}</th>
          <th>${tr("project")}</th><th>${tr("assignee")}</th><th>${tr("status")}</th>
          <th>${tr("resolution")}</th></tr></thead>
          <tbody>${tickets.map(t => `<tr><td><b>${t.title || t.subject || ("#" + t.id)}</b></td>
            <td>${t.policy || "—"}</td><td>${t.project || "—"}</td><td>${t.assignee || "—"}</td>
            <td>${P.badge(t.status || "open")}</td>
            <td>${isBreach(t) ? `<span class="badge b-red">${tr("breached")}</span>` : `<span class="badge b-green">${tr("within_sla")}</span>`}</td>
          </tr>`).join("")}</tbody></table></div>`;
  });

  // ------------------------------------------------------------- APPROVALS ---
  P.register("approvals", async (root) => {
    const canDecide = P.getUser().role_level >= 70;
    async function load() {
      const list = await API.get("/api/approvals");
      const pending = list.filter(a => (a.status || "pending") === "pending");
      const decided = list.filter(a => (a.status || "pending") !== "pending");
      root.innerHTML = `
        <div class="page-head"><div class="page-title">${tr("approvals")}</div></div>
        <div class="card" style="margin-bottom:16px"><div class="card-head"><h3>${tr("pending_approvals")}</h3>
          <span class="nav-badge">${pending.length}</span></div>
          <table class="table"><thead><tr><th>${tr("request")}</th><th>${tr("requester")}</th>
            <th>${tr("approver")}</th><th>${tr("entity")}</th>${canDecide ? `<th>${tr("decision")}</th>` : ""}</tr></thead>
            <tbody>${pending.length ? pending.map(a => `<tr data-id="${a.id}">
              <td><b>${a.title || a.subject || ("#" + a.id)}</b>
                <div style="font-size:11.5px;color:var(--text-muted)">${a.description || ""}</div></td>
              <td>${a.requester || "—"}</td><td>${a.approver || "—"}</td>
              <td><span class="badge b-grey">${a.entity_type || "—"}</span></td>
              ${canDecide ? `<td><div style="display:flex;gap:6px">
                <button class="btn btn-sm btn-primary" data-approve="${a.id}">${tr("approve")}</button>
                <button class="btn btn-sm" data-reject="${a.id}">${tr("reject")}</button></div></td>` : ""}
            </tr>`).join("") : `<tr><td colspan="${canDecide ? 5 : 4}"><div class="empty">${tr("no_approvals")}</div></td></tr>`}
          </tbody></table></div>
        <div class="card"><div class="card-head"><h3>${tr("approval_history")}</h3></div>
          <table class="table"><thead><tr><th>${tr("request")}</th><th>${tr("requester")}</th>
            <th>${tr("status")}</th><th>${tr("time")}</th></tr></thead>
            <tbody>${decided.map(a => `<tr><td>${a.title || a.subject || ("#" + a.id)}</td>
              <td>${a.requester || "—"}</td><td>${P.badge(a.status)}</td>
              <td class="mono" style="font-size:12px">${(a.decided_at || "").replace("T", " ")}</td></tr>`).join("")
              || `<tr><td colspan="4"><div class="empty">${tr("no_data")}</div></td></tr>`}</tbody></table></div>`;

      if (canDecide) {
        const decide = async (id, status) => {
          try { await API.put("/api/approvals/" + id, { status });
            P.toast(tr("saved"), "ok"); load();
          } catch (e) { P.toast(e.message || tr("error_occurred"), "err"); }
        };
        P.$$("[data-approve]").forEach(b => b.onclick = () => decide(b.dataset.approve, "approved"));
        P.$$("[data-reject]").forEach(b => b.onclick = () => decide(b.dataset.reject, "rejected"));
      }
    }
    load();
  });

  // ---------------------------------------------------------------- AUDIT ----
  P.register("audit", async (root) => {
    const logs = await API.get("/api/audit");
    root.innerHTML = `
      <div class="page-head"><div><div class="page-title">${tr("audit_trail")}</div>
        <div class="page-desc">${logs.length} ${tr("action").toLowerCase()}s</div></div></div>
      <div class="card"><table class="table"><thead><tr>
        <th>${tr("timestamp")}</th><th>${tr("user")}</th><th>${tr("action")}</th>
        <th>${tr("entity")}</th><th>${tr("target_id")}</th><th>${tr("details")}</th><th>${tr("ip_address")}</th></tr></thead>
        <tbody>${logs.length ? logs.map(l => `<tr>
          <td class="mono" style="font-size:12px;white-space:nowrap">${(l.created_at || "").replace("T", " ")}</td>
          <td>${l.user || "—"}</td><td><span class="badge b-blue">${l.action}</span></td>
          <td>${l.entity_type || "—"}</td><td class="mono" style="font-size:12px">${l.entity_id ?? "—"}</td>
          <td style="color:var(--text-muted);font-size:12px">${l.details || ""}</td>
          <td class="mono" style="font-size:11.5px;color:var(--text-faint)">${l.ip_address || l.ip || "—"}</td></tr>`).join("")
          : `<tr><td colspan="7"><div class="empty">${tr("no_activity")}</div></td></tr>`}</tbody></table></div>`;
  });
})();
