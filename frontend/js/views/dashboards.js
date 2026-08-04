/* Dashboard views. */
(function () {
  const P = window.PPM, tr = P.tr, C = window.Charts;
  const gridColor = () => getComputedStyle(document.body).getPropertyValue("--border").trim();

  // -------------------------------------------------------------- EXECUTIVE --
  P.register("executive", async (root) => {
    const d = await API.get("/api/dashboard/executive");
    const c = d.cards;
    root.innerHTML = `
      <div class="page-head"><div><div class="page-title">${tr("executive_dashboard")}</div>
        <div class="page-desc">${tr("app_tag")} · ${P.getUser().full_name}</div></div></div>
      <div class="grid g-4" style="margin-bottom:16px">
        ${P.statCard(tr("portfolio_value"), P.money(c.portfolio_value), { icon: "financial" })}
        ${P.statCard(tr("active_projects"), c.active_projects + " / " + c.total_projects, { icon: "projects", iconBg: "var(--green-100)", iconColor: "var(--green-500)" })}
        ${P.statCard(tr("avg_progress"), c.avg_progress + "%", { icon: "kpi", iconBg: "var(--amber-100)", iconColor: "var(--amber-500)" })}
        ${P.statCard(tr("open_risks"), c.open_risks, { icon: "risk", iconBg: "var(--red-100)", iconColor: "var(--red-500)" })}
      </div>
      <div class="grid g-3" style="margin-bottom:16px">
        <div class="card"><div class="card-head"><h3>${tr("health_score")}</h3></div>
          <div class="card-pad"><div id="ch-gauge"></div>
          <div style="text-align:center;color:var(--text-muted);font-size:12px">${tr("sla_breaches")}: <b>${c.sla_breaches}</b></div></div></div>
        ${P.cardChart("projects_by_status", "ch-status", 200)}
        ${P.cardChart("projects_by_health", "ch-health", 200)}
      </div>
      <div class="grid g-2" style="margin-bottom:16px">
        ${P.cardChart("budget_vs_actual", "ch-budget", 300)}
        ${P.cardChart("progress_trend", "ch-trend", 300)}
      </div>
      ${P.cardChart("kpi_overview", "ch-kpi", 260)}`;

    C.gauge(document.getElementById("ch-gauge"), { value: c.health_score, label: tr("health_score") });
    C.donut(document.getElementById("ch-status"), {
      data: Object.entries(d.by_status).map(([k, v]) => ({ label: P.statusLabel(k), value: v })),
      centerLabel: tr("projects"),
    });
    C.donut(document.getElementById("ch-health"), {
      data: [["green", "#16a34a"], ["amber", "#d97706"], ["red", "#dc2626"]]
        .filter(([k]) => d.by_health[k]).map(([k, col]) => ({ label: P.statusLabel(k), value: d.by_health[k] || 0, color: col })),
      centerLabel: tr("health"),
    });
    C.bar(document.getElementById("ch-budget"), {
      labels: d.budget_by_project.map(p => p.name),
      series: [{ name: tr("budget"), data: d.budget_by_project.map(p => p.budget), color: "#2563eb" },
               { name: tr("actual"), data: d.budget_by_project.map(p => p.actual), color: "#16a34a" }],
      height: 280,
    });
    C.line(document.getElementById("ch-trend"), {
      labels: d.progress_trend.map(p => p.period),
      series: [{ name: tr("avg_progress"), data: d.progress_trend.map(p => p.value), color: "#2563eb" }],
      height: 280,
    });
    C.hbar(document.getElementById("ch-kpi"), {
      data: d.kpis.slice(0, 8).map(k => ({ label: k.name, value: Math.round((k.current / (k.target || 1)) * 100) })),
      labelW: 140, height: 240,
    });
  });

  // -------------------------------------------------------------- PORTFOLIO --
  P.register("portfolio", async (root) => {
    const d = await API.get("/api/dashboard/portfolio");
    root.innerHTML = `
      <div class="page-head"><div class="page-title">${tr("portfolio_dashboard")}</div></div>
      <div class="grid g-2" style="margin-bottom:16px">
        ${P.cardChart("portfolio_breakdown", "ch-tree", 300)}
        ${P.cardChart("value_vs_risk", "ch-bubble", 300, "prioritization")}
      </div>
      <div class="card"><div class="card-head"><h3>${tr("portfolio")}</h3></div>
        <table class="table"><thead><tr><th>${tr("name")}</th><th class="num">${tr("projects")}</th>
        <th class="num">${tr("budget")}</th><th class="num">${tr("actual")}</th><th style="width:160px">${tr("progress")}</th></tr></thead>
        <tbody>${d.portfolios.map(p => `<tr><td><b>${p.name}</b></td>
          <td class="num">${p.projects}</td><td class="num">${P.money(p.budget)}</td>
          <td class="num">${P.money(p.actual)}</td>
          <td>${P.pbar(Math.round(p.progress))}</td></tr>`).join("")}</tbody></table></div>`;

    C.treemap(document.getElementById("ch-tree"), {
      data: d.treemap.flatMap((po, i) => po.children.map(ch => ({
        label: ch.name, value: ch.value,
        color: ch.health === "red" ? "#dc2626" : ch.health === "amber" ? "#d97706" : C.PALETTE[i % C.PALETTE.length],
      }))), height: 280,
    });
    const prio = { low: 6, medium: 9, high: 13, critical: 18 };
    C.scatter(document.getElementById("ch-bubble"), {
      data: d.bubble.map(b => ({ x: b.risk, y: b.budget / 1000, r: prio[b.priority] || 8, label: b.name,
        color: b.health === "red" ? "#dc2626" : b.health === "amber" ? "#d97706" : "#2563eb" })),
      xLabel: tr("risk"), yLabel: tr("budget") + " (k)", height: 280,
    });
  });

  // --------------------------------------------------------------- RESOURCE --
  P.register("resources", async (root) => {
    const d = await API.get("/api/dashboard/resource");
    const sug = await API.get("/api/resources/suggestions").catch(() => ({ suggestions: [], summary: "" }));
    root.innerHTML = `
      <div class="page-head"><div class="page-title">${tr("resource_dashboard")}</div>
        <div class="page-actions"><span class="page-desc">${sug.summary || ""}</span></div></div>
      <div class="grid g-4" style="margin-bottom:16px">
        ${P.statCard(tr("over_capacity"), d.buckets.over, { icon: "risk", iconBg: "var(--red-100)", iconColor: "var(--red-500)" })}
        ${P.statCard(tr("high"), d.buckets.high, { icon: "resources", iconBg: "var(--amber-100)", iconColor: "var(--amber-500)" })}
        ${P.statCard(tr("healthy"), d.buckets.healthy, { icon: "approvals", iconBg: "var(--green-100)", iconColor: "var(--green-500)" })}
        ${P.statCard(tr("under_utilized"), d.buckets.under, { icon: "resources" })}
      </div>
      <div class="grid g-2" style="margin-bottom:16px">
        ${P.cardChart("utilization_by_person", "ch-util", 320)}
        ${P.cardChart("team_allocation", "ch-team", 320)}
      </div>
      <div class="grid g-2">
        <div class="card"><div class="card-head"><h3>${tr("ai_suggestions")}</h3><span class="sub">heuristic</span></div>
          <div class="card-pad">${sug.suggestions.length ? sug.suggestions.map(s => `
            <div class="kv"><span class="k">${s.from} (${s.from_util}%) → ${s.to} (${s.to_util}%)</span>
            <span class="v" style="font-weight:500;color:var(--text-muted);font-size:12px">${s.recommendation}</span></div>`).join("")
            : `<div class="empty">${tr("healthy")}</div>`}</div></div>
        <div class="card"><div class="card-head"><h3>${tr("skills_matrix")}</h3></div>
          <div id="skills-wrap" style="overflow:auto;max-height:300px"></div></div>
      </div>`;

    const rows = d.utilization.slice(0, 12);
    C.hbar(document.getElementById("ch-util"), {
      data: rows.map(u => ({ label: u.full_name, value: Math.round(u.utilization),
        color: u.utilization > 100 ? "#dc2626" : u.utilization >= 80 ? "#d97706" : "#16a34a" })),
      labelW: 130, height: 300,
    });
    C.bar(document.getElementById("ch-team"), {
      labels: d.team_allocation.map(t => t.team),
      series: [{ name: tr("allocated"), data: d.team_allocation.map(t => Math.round(t.avg_alloc)), color: "#2563eb" }],
      height: 300,
    });
    // skills matrix
    const sk = await API.get("/api/resources/skills");
    const colorFor = lvl => lvl === 0 ? "var(--surface-2)" : `rgba(37,99,235,${0.2 + lvl * 0.16})`;
    document.getElementById("skills-wrap").innerHTML = `<table class="table" style="font-size:12px">
      <thead><tr><th>${tr("user")}</th>${sk.skills.map(s => `<th style="writing-mode:vertical-rl;transform:rotate(180deg);height:70px">${s}</th>`).join("")}</tr></thead>
      <tbody>${sk.rows.map(r => `<tr><td style="white-space:nowrap">${r.user}</td>
        ${r.levels.map(l => `<td style="text-align:center;background:${colorFor(l.level)};font-weight:700;color:${l.level > 2 ? "#fff" : "var(--text-muted)"}">${l.level || ""}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  });

  // -------------------------------------------------------------- FINANCIAL --
  P.register("financial", async (root) => {
    const d = await API.get("/api/dashboard/financial");
    root.innerHTML = `
      <div class="page-head"><div class="page-title">${tr("financial_dashboard")}</div></div>
      <div class="grid g-3" style="margin-bottom:16px">
        ${P.statCard(tr("total_budget"), P.money(d.total_budget), { icon: "financial" })}
        ${P.statCard(tr("actual_cost"), P.money(d.total_actual), { icon: "financial", iconBg: "var(--amber-100)", iconColor: "var(--amber-500)" })}
        ${P.statCard(tr("variance"), P.money(d.variance), { icon: "kpi",
          iconBg: d.variance >= 0 ? "var(--green-100)" : "var(--red-100)",
          iconColor: d.variance >= 0 ? "var(--green-500)" : "var(--red-500)",
          delta: d.variance >= 0 ? "▲ surplus" : "▼ overrun", deltaClass: d.variance >= 0 ? "up" : "down" })}
      </div>
      <div class="grid g-2" style="margin-bottom:16px">
        ${P.cardChart("cost_by_portfolio", "ch-fin", 300)}
        ${P.cardChart("cost_trend", "ch-costtrend", 300)}
      </div>
      ${P.cardChart("budget_overruns", "ch-over", 240)}`;

    C.bar(document.getElementById("ch-fin"), {
      labels: d.by_portfolio.map(p => p.name),
      series: [{ name: tr("budget"), data: d.by_portfolio.map(p => p.budget), color: "#2563eb" },
               { name: tr("actual"), data: d.by_portfolio.map(p => p.actual), color: "#d97706" }],
      height: 280,
    });
    C.line(document.getElementById("ch-costtrend"), {
      labels: d.cost_trend.map(p => p.period),
      series: [{ name: tr("actual_cost"), data: d.cost_trend.map(p => p.value), color: "#16a34a" }],
      height: 280,
    });
    if (d.overruns.length) C.hbar(document.getElementById("ch-over"), {
      data: d.overruns.map(o => ({ label: o.name, value: o.over, color: "#dc2626" })), labelW: 150, height: 220,
    });
    else document.getElementById("ch-over").innerHTML = `<div class="empty">${tr("no_data")}</div>`;
  });

  // ------------------------------------------------------------------ RISK ---
  P.register("risk", async (root) => {
    const d = await API.get("/api/dashboard/risk");
    root.innerHTML = `
      <div class="page-head"><div class="page-title">${tr("risk_dashboard")}</div>
        <div class="page-actions"><span class="badge b-red">${d.total} ${tr("risk")}</span></div></div>
      <div class="grid g-2" style="margin-bottom:16px">
        ${P.cardChart("risk_heatmap", "ch-heat", 300)}
        ${P.cardChart("risk_by_status", "ch-rstatus", 300)}
      </div>
      <div class="card"><div class="card-head"><h3>${tr("top_risks")}</h3></div>
        <table class="table"><thead><tr><th>${tr("name")}</th><th>${tr("project")}</th>
        <th>${tr("status")}</th><th class="num">${tr("severity")}</th></tr></thead>
        <tbody>${d.top.map(r => `<tr><td>${r.title}</td><td>${r.project}</td>
          <td>${P.badge(r.status)}</td><td class="num"><span class="badge ${r.severity >= 15 ? "b-red" : r.severity >= 8 ? "b-amber" : "b-grey"}">${r.severity}</span></td></tr>`).join("")}</tbody></table></div>`;

    C.heatmap(document.getElementById("ch-heat"), {
      matrix: d.heatmap, rowLabels: ["1", "2", "3", "4", "5"], colLabels: ["1", "2", "3", "4", "5"],
      rowTitle: tr("severity"), colTitle: "Prob.", height: 280,
    });
    C.donut(document.getElementById("ch-rstatus"), {
      data: Object.entries(d.by_status).map(([k, v]) => ({ label: P.statusLabel(k), value: v,
        color: k === "open" ? "#dc2626" : k === "mitigating" ? "#d97706" : "#16a34a" })),
      centerLabel: tr("risk"), height: 280,
    });
  });

  // ------------------------------------------------------------------- OKR ---
  P.register("okr", async (root) => {
    const d = await API.get("/api/dashboard/okr");
    const canEdit = P.getUser().role_level >= 70;
    root.innerHTML = `
      <div class="page-head"><div class="page-title">${tr("okr_dashboard")}</div></div>
      <div class="grid g-3" style="margin-bottom:16px">
        ${["company", "department", "individual"].map(lvl => P.statCard(tr(lvl),
          (d.avg_by_level[lvl] || 0) + "%", { icon: "okr" })).join("")}
      </div>
      <div class="grid g-2">
        ${P.cardChart("objectives_progress", "ch-okr", 260)}
        <div class="card"><div class="card-head"><h3>${tr("status")}</h3></div>
          <div class="card-pad"><div id="ch-okrstatus"></div></div></div>
      </div>
      <div style="margin-top:16px">${d.objectives.map(o => `
        <div class="card" style="margin-bottom:12px"><div class="card-pad">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
            ${P.badge(o.level, "b-grey")}<b style="font-size:14px">${o.title}</b>
            <div style="margin-left:auto">${P.badge(o.status)}</div></div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="flex:1">${P.pbar(o.progress)}</div><b class="mono">${o.progress}%</b>
            <span style="color:var(--text-muted);font-size:12px">${o.owner || ""}</span></div>
          ${o.key_results.map(kr => `<div class="kv"><span class="k">${kr.title}</span>
            <span style="display:flex;align-items:center;gap:10px">
              <span class="mono" style="font-size:12px">${kr.current} / ${kr.target} ${kr.unit}</span>
              <span style="width:90px">${P.pbar(kr.progress)}</span>
              ${canEdit ? `<button class="btn btn-sm" data-kr="${kr.id}" data-cur="${kr.current}">${tr("edit")}</button>` : ""}</span></div>`).join("")}
        </div></div>`).join("")}</div>`;

    C.hbar(document.getElementById("ch-okr"), {
      data: d.objectives.map(o => ({ label: o.title, value: o.progress,
        color: o.progress >= 70 ? "#16a34a" : o.progress >= 40 ? "#d97706" : "#dc2626" })),
      labelW: 160, height: 240,
    });
    C.donut(document.getElementById("ch-okrstatus"), {
      data: Object.entries(d.status_counts).map(([k, v]) => ({ label: P.statusLabel(k), value: v,
        color: k === "on_track" ? "#16a34a" : k === "at_risk" ? "#d97706" : k === "done" ? "#2563eb" : "#dc2626" })),
      centerLabel: "OKR", height: 220,
    });
    P.$$("[data-kr]").forEach(b => b.onclick = () => {
      const m = P.modal(tr("key_results"), `<div class="field"><label>${tr("current")}</label>
        <input id="kr-val" type="number" value="${b.dataset.cur}"></div>`,
        `<button class="btn" data-close>${tr("cancel")}</button><button class="btn btn-primary" id="kr-save">${tr("save")}</button>`);
      P.$("#kr-save", m.el).onclick = async () => {
        await API.put(`/api/key_results/${b.dataset.kr}`, { current: parseFloat(P.$("#kr-val", m.el).value) });
        m.close(); P.toast(tr("saved"), "ok"); P.route();
      };
    });
  });

  // ------------------------------------------------------------------- KPI ---
  P.register("kpi", async (root) => {
    const d = await API.get("/api/dashboard/kpi");
    const persp = { financial: tr("financial_p"), customer: tr("customer"), internal: tr("internal"), learning: tr("learning") };
    root.innerHTML = `
      <div class="page-head"><div class="page-title">${tr("kpi_dashboard")}</div>
        <div class="page-desc">${tr("balanced_scorecard")}</div></div>
      <div class="grid g-4" style="margin-bottom:16px">
        ${Object.keys(persp).map(k => P.statCard(persp[k], (d.scorecard[k] || 0) + "%",
          { icon: "kpi", iconBg: (d.scorecard[k] || 0) >= 80 ? "var(--green-100)" : "var(--amber-100)",
            iconColor: (d.scorecard[k] || 0) >= 80 ? "var(--green-500)" : "var(--amber-500)" })).join("")}
      </div>
      <div class="grid g-2" style="margin-bottom:16px">
        ${P.cardChart("balanced_scorecard", "ch-bsc", 260)}
        ${P.cardChart("kpi_overview", "ch-attain", 260)}
      </div>
      <div class="card"><div class="card-head"><h3>KPI</h3></div>
        <table class="table"><thead><tr><th>${tr("name")}</th><th>${tr("period")}</th>
        <th class="num">${tr("current")}</th><th class="num">${tr("target")}</th>
        <th style="width:120px">${tr("attainment")}</th></tr></thead>
        <tbody>${d.kpis.map(k => `<tr class="row-link" data-kpi="${k.id}"><td><b>${k.name}</b>
          <div style="font-size:11px;color:var(--text-faint)">${persp[k.perspective] || k.perspective}</div></td>
          <td>${k.period}</td><td class="num">${k.current} ${k.unit}</td>
          <td class="num">${k.target} ${k.unit}</td>
          <td>${P.pbar(k.attainment)}</td></tr>`).join("")}</tbody></table></div>`;

    const psK = Object.keys(persp);
    C.bar(document.getElementById("ch-bsc"), {
      labels: psK.map(k => persp[k]),
      series: [{ name: tr("attainment"), data: psK.map(k => d.scorecard[k] || 0), color: "#2563eb" }],
      height: 240,
    });
    C.hbar(document.getElementById("ch-attain"), {
      data: d.kpis.map(k => ({ label: k.name, value: k.attainment,
        color: k.attainment >= 90 ? "#16a34a" : k.attainment >= 60 ? "#d97706" : "#dc2626" })),
      labelW: 150, height: 240,
    });
    P.$$("[data-kpi]").forEach(r => r.onclick = async () => {
      const h = await API.get(`/api/kpis/${r.dataset.kpi}/history`);
      const m = P.modal("KPI", `<div id="kpi-hist" style="min-height:220px"></div>`, "");
      C.line(P.$("#kpi-hist", m.el), { labels: h.map(x => x.recorded_at.slice(5)),
        series: [{ name: tr("current"), data: h.map(x => x.value), color: "#2563eb" }], height: 220 });
    });
  });
})();
