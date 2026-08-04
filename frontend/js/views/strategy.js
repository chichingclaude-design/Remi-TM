/* Strategy view: Capacity planning + PPM (prioritization, health, what-if). */
(function () {
  const P = window.PPM, tr = P.tr, C = window.Charts;

  P.register("capacity", async (root) => {
    const canRun = P.getUser().role_level >= 70;
    const [prio, cap, health, sugg] = await Promise.all([
      API.get("/api/ppm/prioritization"), API.get("/api/ppm/capacity"),
      API.get("/api/ppm/health"), API.get("/api/resources/suggestions")]);
    const ranked = prio.ranked;

    root.innerHTML = `
      <div class="page-head"><div><div class="page-title">${tr("capacity_planning")}</div>
        <div class="page-desc">${tr("prioritization")} · ${tr("demand_capacity")} · ${tr("what_if")}</div></div></div>
      <div class="grid g-3" style="margin-bottom:16px">
        <div class="card"><div class="card-head"><h3>${tr("portfolio_health_score")}</h3></div>
          <div class="card-pad"><div id="cp-gauge"></div></div></div>
        <div class="card" style="grid-column:span 2"><div class="card-head"><h3>${tr("demand_capacity")}</h3></div>
          <div class="card-pad"><div id="cp-cap"></div></div></div>
      </div>
      <div class="grid g-2" style="margin-bottom:16px">
        <div class="card"><div class="card-head"><h3>${tr("prioritization_ranking")}</h3></div>
          <div class="card-pad"><div id="cp-prio"></div></div></div>
        <div class="card"><div class="card-head"><h3>${tr("ai_suggestions")}</h3>
          <span class="sub">${sugg.summary || ""}</span></div>
          <div class="card-pad">${sugg.suggestions.length ? sugg.suggestions.map(s => `
            <div class="kv"><span class="k">${s.from} → ${s.to}</span>
            <span class="v" style="font-weight:400;color:var(--text-muted);font-size:12px">${s.recommendation}</span></div>`).join("")
            : `<div style="color:var(--green-500);font-weight:600">✓ ${tr("healthy")}</div>`}</div></div>
      </div>
      <div class="card" style="margin-bottom:16px"><div class="card-head"><h3>${tr("prioritization_ranking")}</h3></div>
        <table class="table"><thead><tr><th class="num">${tr("rank")}</th><th>${tr("name")}</th>
          <th>${tr("priority")}</th><th class="num">${tr("budget")}</th><th class="num">${tr("risk")}</th>
          <th style="width:120px">${tr("progress")}</th><th class="num">${tr("value_score")}</th></tr></thead>
          <tbody>${ranked.map((p, i) => `<tr><td class="num"><b>${i + 1}</b></td>
            <td><b>${p.name}</b></td><td>${P.badge(p.priority, P.prioClass(p.priority))}</td>
            <td class="num">${P.money(p.budget)}</td>
            <td class="num"><span class="badge ${p.risk >= 15 ? "b-red" : p.risk >= 8 ? "b-amber" : "b-grey"}">${p.risk}</span></td>
            <td>${P.pbar(Math.round(p.progress))}</td>
            <td class="num"><b>${p.score}</b></td></tr>`).join("")}</tbody></table></div>

      <div class="card"><div class="card-head"><h3>${tr("what_if")}</h3></div>
        <div class="card-pad">
          <div class="grid g-3" style="align-items:end;margin-bottom:16px">
            <div class="field"><label>${tr("budget_cap")}</label>
              <input id="sc-cap" type="number" placeholder="e.g. 3000000" ${canRun ? "" : "disabled"}></div>
            <div class="field"><label>${tr("fund_top_n")}</label>
              <input id="sc-top" type="number" placeholder="e.g. 5" ${canRun ? "" : "disabled"}></div>
            <button class="btn btn-primary" id="sc-run" ${canRun ? "" : "disabled"}>${tr("run_scenario")}</button>
          </div>
          ${canRun ? "" : `<div style="color:var(--text-muted);font-size:12.5px;margin-bottom:12px">${tr("read_only_note")}</div>`}
          <div id="sc-result"></div>
        </div></div>`;

    C.gauge(document.getElementById("cp-gauge"), { value: health.score, label: tr("portfolio_health_score"), height: 190 });
    C.bar(document.getElementById("cp-cap"), {
      labels: cap.teams.map(t => t.team),
      series: [{ name: tr("capacity_hrs"), data: cap.teams.map(t => t.capacity), color: "#2563eb" },
               { name: tr("demand"), data: cap.teams.map(t => t.demand), color: "#d97706" }],
      height: 200,
    });
    C.hbar(document.getElementById("cp-prio"), {
      data: ranked.slice(0, 8).map(p => ({ label: p.name, value: p.score })),
      labelW: 150, height: 220, color: "#2563eb",
    });

    if (canRun) P.$("#sc-run").onclick = async () => {
      const budget_cap = parseFloat(P.$("#sc-cap").value) || 0;
      const fund_top = parseInt(P.$("#sc-top").value) || 0;
      const r = await API.post("/api/ppm/scenario", { budget_cap, fund_top });
      P.$("#sc-result").innerHTML = `
        <div class="grid g-3" style="margin-bottom:14px">
          ${P.statCard(tr("projects_funded"), r.count_funded, { icon: "approvals", iconBg: "var(--green-100)", iconColor: "var(--green-500)" })}
          ${P.statCard(tr("unfunded"), r.count_unfunded, { icon: "risk", iconBg: "var(--amber-100)", iconColor: "var(--amber-500)" })}
          ${P.statCard(tr("total_cost"), P.money(r.total_cost), { icon: "financial" })}
        </div>
        <table class="table"><thead><tr><th>${tr("name")}</th><th class="num">${tr("budget")}</th>
          <th class="num">${tr("value_score")}</th><th>${tr("decision")}</th></tr></thead>
          <tbody>${r.funded.map(p => `<tr><td>${p.name}</td><td class="num">${P.money(p.budget)}</td>
            <td class="num">${p.score}</td><td><span class="badge b-green">${tr("funded")}</span></td></tr>`).join("")}
            ${r.unfunded.map(p => `<tr><td>${p.name}</td><td class="num">${P.money(p.budget)}</td>
            <td class="num">${p.score}</td><td><span class="badge b-grey">${tr("unfunded")}</span></td></tr>`).join("")}
          </tbody></table>`;
      P.toast(tr("saved"), "ok");
    };
  });
})();
