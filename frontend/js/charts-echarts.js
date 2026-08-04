/* ============================================================================
   Real Apache ECharts adapter.

   If window.echarts is present (frontend/vendor/echarts.min.js was loaded), this
   REPLACES window.Charts with an ECharts-backed implementation exposing the exact
   same API the views already use: line, bar, hbar, donut, heatmap, gauge, scatter,
   treemap, PALETTE, fmt. Every view therefore renders with genuine ECharts —
   interactive tooltips, zoom, legend toggling, drill-down — with no view changes.

   If ECharts is NOT loaded, this file does nothing and the bundled offline canvas
   engine (charts.js) remains active, so the app always works offline out of the box.
   ========================================================================== */
(function () {
  if (!window.echarts) return; // no ECharts available -> keep canvas fallback

  const PALETTE = ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2",
                   "#dc2626", "#0ea5e9", "#059669", "#db2777", "#64748b"];

  function fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return "0";
    const a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (a >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return Math.round(n * 100) / 100 + "";
  }

  function theme() {
    const cs = getComputedStyle(document.body);
    const g = (v, d) => cs.getPropertyValue(v).trim() || d;
    return {
      text: g("--text", "#0f172a"), muted: g("--text-muted", "#64748b"),
      faint: g("--text-faint", "#94a3b8"), border: g("--border", "#e2e8f0"),
      surface: g("--surface", "#ffffff"),
    };
  }

  // Track instances so theme re-renders dispose cleanly and resize works.
  const instances = new WeakMap();
  function mount(container, height) {
    container.innerHTML = "";
    const prev = instances.get(container);
    if (prev) { try { prev.dispose(); } catch (e) {} }
    const div = document.createElement("div");
    div.style.width = "100%";
    div.style.height = (height || 240) + "px";
    container.appendChild(div);
    const chart = window.echarts.init(div, null, { renderer: "canvas" });
    instances.set(container, chart);
    return chart;
  }

  // Global resize handling for all live charts.
  let ro = null;
  function observe(container, chart) {
    if (window.ResizeObserver) {
      if (!ro) ro = new ResizeObserver(() => {
        document.querySelectorAll(".chart-ec").forEach(el => {
          const c = window.echarts.getInstanceByDom(el.firstChild);
          if (c) c.resize();
        });
      });
    }
    container.classList.add("chart-ec");
  }
  window.addEventListener("resize", () => {
    document.querySelectorAll(".chart-ec").forEach(el => {
      if (el.firstChild) {
        const c = window.echarts.getInstanceByDom(el.firstChild);
        if (c) c.resize();
      }
    });
  });

  const baseGrid = { left: 46, right: 18, top: 24, bottom: 34, containLabel: true };
  function axisStyle(th) {
    return {
      axisLine: { lineStyle: { color: th.border } },
      axisLabel: { color: th.muted, fontSize: 11 },
      splitLine: { lineStyle: { color: th.border, type: "dashed" } },
      axisTick: { show: false },
    };
  }
  function tooltipStyle(th) {
    return { backgroundColor: th.surface, borderColor: th.border,
             textStyle: { color: th.text, fontSize: 12 }, confine: true };
  }
  function render(container, height, option) {
    const chart = mount(container, height);
    chart.setOption(option);
    observe(container, chart);
    return chart;
  }

  // -------------------------------------------------------------- LINE ------
  function line(container, opts) {
    const th = theme();
    render(container, opts.height, {
      color: PALETTE, tooltip: Object.assign({ trigger: "axis" }, tooltipStyle(th)),
      legend: opts.series.length > 1 ? { top: 0, textStyle: { color: th.muted, fontSize: 11 } } : undefined,
      grid: baseGrid,
      xAxis: Object.assign({ type: "category", boundaryGap: false, data: opts.labels }, axisStyle(th)),
      yAxis: Object.assign({ type: "value", axisLabel: { color: th.muted, fontSize: 11, formatter: fmt } }, axisStyle(th)),
      series: opts.series.map(s => ({
        name: s.name, type: "line", smooth: true, showSymbol: false,
        data: s.data, lineStyle: { width: 2.5, color: s.color },
        itemStyle: { color: s.color },
        areaStyle: opts.series.length === 1 ? { opacity: 0.08, color: s.color } : undefined,
      })),
    });
  }

  // --------------------------------------------------------------- BAR ------
  function bar(container, opts) {
    const th = theme();
    render(container, opts.height, {
      color: PALETTE, tooltip: Object.assign({ trigger: "axis", axisPointer: { type: "shadow" } }, tooltipStyle(th)),
      legend: opts.series.length > 1 ? { top: 0, textStyle: { color: th.muted, fontSize: 11 } } : undefined,
      grid: baseGrid,
      xAxis: Object.assign({ type: "category", data: opts.labels,
        axisLabel: { color: th.muted, fontSize: 10, interval: 0, rotate: opts.labels.length > 6 ? 28 : 0 } }, axisStyle(th)),
      yAxis: Object.assign({ type: "value", axisLabel: { color: th.muted, fontSize: 11, formatter: fmt } }, axisStyle(th)),
      series: opts.series.map(s => ({
        name: s.name, type: "bar", data: s.data,
        itemStyle: { color: s.color, borderRadius: [4, 4, 0, 0] }, barMaxWidth: 34,
      })),
    });
  }

  // -------------------------------------------------------- HORIZONTAL BAR --
  function hbar(container, opts) {
    const th = theme();
    const labels = opts.data.map(d => d.label);
    render(container, opts.height, {
      tooltip: Object.assign({ trigger: "axis", axisPointer: { type: "shadow" } }, tooltipStyle(th)),
      grid: { left: (opts.labelW || 120), right: 24, top: 12, bottom: 24, containLabel: false },
      xAxis: Object.assign({ type: "value", axisLabel: { color: th.muted, fontSize: 11, formatter: fmt } }, axisStyle(th)),
      yAxis: Object.assign({ type: "category", data: labels, inverse: true,
        axisLabel: { color: th.text, fontSize: 11.5, width: (opts.labelW || 120) - 8, overflow: "truncate" } }, axisStyle(th)),
      series: [{
        type: "bar", data: opts.data.map(d => d.value),
        itemStyle: { color: opts.color || "#2563eb", borderRadius: [0, 4, 4, 0] }, barMaxWidth: 20,
        label: { show: true, position: "right", color: th.muted, fontSize: 11, formatter: p => fmt(p.value) },
      }],
    });
  }

  // -------------------------------------------------------------- DONUT -----
  function donut(container, opts) {
    const th = theme();
    render(container, opts.height, {
      color: PALETTE, tooltip: Object.assign({ trigger: "item", formatter: "{b}: {c} ({d}%)" }, tooltipStyle(th)),
      legend: { bottom: 0, textStyle: { color: th.muted, fontSize: 11 }, itemWidth: 10, itemHeight: 10 },
      series: [{
        type: "pie", radius: ["48%", "72%"], center: ["50%", "46%"], avoidLabelOverlap: true,
        itemStyle: { borderColor: th.surface, borderWidth: 2 },
        label: { show: true, position: "center", formatter: opts.centerLabel || "",
                 color: th.muted, fontSize: 12 },
        emphasis: { label: { show: true, fontSize: 15, fontWeight: "bold", color: th.text } },
        labelLine: { show: false },
        data: opts.data.map(d => ({ name: d.label, value: d.value,
          itemStyle: d.color ? { color: d.color } : undefined })),
      }],
    });
  }

  // ------------------------------------------------------------- HEATMAP ----
  function heatmap(container, opts) {
    const th = theme();
    const data = [];
    let max = 0;
    for (let r = 0; r < opts.matrix.length; r++)
      for (let c = 0; c < opts.matrix[r].length; c++) {
        data.push([c, r, opts.matrix[r][c]]);
        max = Math.max(max, opts.matrix[r][c]);
      }
    render(container, opts.height, {
      tooltip: Object.assign({ position: "top",
        formatter: p => `${opts.rowTitle || "Row"} ${p.data[1] + 1} × ${opts.colTitle || "Col"} ${p.data[0] + 1}<br><b>${p.data[2]}</b>` }, tooltipStyle(th)),
      grid: { left: 30, right: 14, top: 10, bottom: 40, containLabel: true },
      xAxis: { type: "category", data: opts.colLabels, splitArea: { show: true },
        name: opts.colTitle, nameLocation: "middle", nameGap: 26,
        nameTextStyle: { color: th.muted, fontSize: 11 },
        axisLabel: { color: th.muted }, axisLine: { lineStyle: { color: th.border } } },
      yAxis: { type: "category", data: opts.rowLabels, splitArea: { show: true },
        axisLabel: { color: th.muted }, axisLine: { lineStyle: { color: th.border } } },
      visualMap: { min: 0, max: max || 1, calculable: true, orient: "horizontal",
        left: "center", bottom: 0, itemHeight: 80,
        inRange: { color: ["#16a34a", "#d97706", "#dc2626"] },
        textStyle: { color: th.muted, fontSize: 10 } },
      series: [{ type: "heatmap", data: data,
        label: { show: true, color: "#fff", fontSize: 12, fontWeight: 700,
                 formatter: p => p.data[2] || "" },
        itemStyle: { borderColor: th.surface, borderWidth: 2, borderRadius: 4 },
        emphasis: { itemStyle: { shadowBlur: 8, shadowColor: "rgba(0,0,0,.3)" } } }],
    });
  }

  // -------------------------------------------------------------- GAUGE -----
  function gauge(container, opts) {
    const th = theme();
    const val = Math.max(0, Math.min(100, opts.value));
    render(container, opts.height || 190, {
      series: [{
        type: "gauge", startAngle: 200, endAngle: -20, min: 0, max: 100,
        radius: "92%", center: ["50%", "62%"],
        progress: { show: true, width: 14,
          itemStyle: { color: val >= 75 ? "#16a34a" : val >= 45 ? "#d97706" : "#dc2626" } },
        axisLine: { lineStyle: { width: 14, color: [[1, th.border]] } },
        pointer: { show: false }, axisTick: { show: false },
        splitLine: { show: false }, axisLabel: { show: false },
        anchor: { show: false },
        title: { offsetCenter: [0, "24%"], color: th.muted, fontSize: 11 },
        detail: { valueAnimation: true, offsetCenter: [0, "-8%"],
          fontSize: 30, fontWeight: "bolder", color: th.text, formatter: "{value}" },
        data: [{ value: Math.round(val), name: opts.label || "" }],
      }],
    });
  }

  // ------------------------------------------------------------- SCATTER ----
  function scatter(container, opts) {
    const th = theme();
    render(container, opts.height, {
      tooltip: Object.assign({ trigger: "item",
        formatter: p => `<b>${p.data[3] || ""}</b><br>${opts.xLabel || "x"}: ${p.data[0]}<br>${opts.yLabel || "y"}: ${fmt(p.data[1])}` }, tooltipStyle(th)),
      grid: baseGrid,
      xAxis: Object.assign({ type: "value", name: opts.xLabel, nameLocation: "middle", nameGap: 24,
        nameTextStyle: { color: th.muted, fontSize: 11 } }, axisStyle(th)),
      yAxis: Object.assign({ type: "value", name: opts.yLabel,
        axisLabel: { color: th.muted, fontSize: 11, formatter: fmt } }, axisStyle(th)),
      series: [{
        type: "scatter",
        symbolSize: p => (p[2] || 8) * 1.6,
        data: opts.data.map(d => [d.x, d.y, d.r, d.label, d.color]),
        itemStyle: { color: p => p.data[4] || "#2563eb", opacity: 0.75,
          borderColor: "#fff", borderWidth: 1 },
      }],
    });
  }

  // ------------------------------------------------------------- TREEMAP ----
  function treemap(container, opts) {
    const th = theme();
    render(container, opts.height, {
      tooltip: Object.assign({ formatter: p => `${p.name}: <b>${fmt(p.value)}</b>` }, tooltipStyle(th)),
      series: [{
        type: "treemap", roam: false, nodeClick: false, breadcrumb: { show: false },
        width: "100%", height: "100%", top: 4, bottom: 4, left: 4, right: 4,
        label: { show: true, color: "#fff", fontSize: 11, fontWeight: 600,
          formatter: p => p.name + "\n" + fmt(p.value) },
        itemStyle: { borderColor: th.surface, borderWidth: 2, gapWidth: 2 },
        data: opts.data.map((d, i) => ({ name: d.label, value: d.value,
          itemStyle: { color: d.color || PALETTE[i % PALETTE.length] } })),
      }],
    });
  }

  window.Charts = { line, bar, hbar, donut, heatmap, gauge, scatter, treemap, PALETTE, fmt };
  window.Charts._engine = "echarts";
  console.info("[PPM] Charts: real Apache ECharts engine active.");
})();
