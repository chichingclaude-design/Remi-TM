/* ============================================================================
   Lightweight interactive charting engine (canvas). No external dependencies.
   Supports: line, bar, hbar, donut, heatmap, gauge, scatter/bubble, treemap.
   Every chart has hover tooltips and hover highlighting.
   ========================================================================== */
(function () {
  const PALETTE = ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2",
                   "#dc2626", "#0ea5e9", "#059669", "#db2777", "#64748b"];

  function theme() {
    const cs = getComputedStyle(document.body);
    return {
      text: cs.getPropertyValue("--text").trim() || "#0f172a",
      muted: cs.getPropertyValue("--text-muted").trim() || "#64748b",
      faint: cs.getPropertyValue("--text-faint").trim() || "#94a3b8",
      border: cs.getPropertyValue("--border").trim() || "#e2e8f0",
      surface: cs.getPropertyValue("--surface").trim() || "#fff",
    };
  }

  function fmt(n) {
    if (n === null || n === undefined || isNaN(n)) return "0";
    const a = Math.abs(n);
    if (a >= 1e9) return (n / 1e9).toFixed(1) + "B";
    if (a >= 1e6) return (n / 1e6).toFixed(1) + "M";
    if (a >= 1e3) return (n / 1e3).toFixed(1) + "k";
    return Math.round(n * 100) / 100 + "";
  }

  function setup(container, height) {
    container.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "chart";
    const canvas = document.createElement("canvas");
    const tip = document.createElement("div");
    tip.className = "chart-tip";
    wrap.appendChild(canvas);
    container.appendChild(wrap);
    document.body.appendChild(tip);
    const dpr = window.devicePixelRatio || 1;
    const cssW = container.clientWidth || 400;
    const cssH = height || 240;
    canvas.style.height = cssH + "px";
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    ctx.font = "12px system-ui,sans-serif";
    return { canvas, ctx, tip, W: cssW, H: cssH, th: theme() };
  }

  function showTip(tip, x, y, html) {
    tip.innerHTML = html;
    tip.style.left = (x + 14) + "px";
    tip.style.top = (y - 10) + "px";
    tip.style.opacity = "1";
  }
  function hideTip(tip) { tip.style.opacity = "0"; }

  // ---------------------------------------------------------------- LINE ----
  function line(container, opts) {
    const { labels, series } = opts; // series: [{name, data, color}]
    const s = setup(container, opts.height || 250);
    const { ctx, W, H, th, canvas, tip } = s;
    const padL = 44, padR = 16, padT = 14, padB = 26;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    let max = 0, min = 0;
    series.forEach(se => se.data.forEach(v => { max = Math.max(max, v); min = Math.min(min, v); }));
    max = max * 1.12 || 1; if (min > 0) min = 0;
    const xFor = i => padL + (labels.length <= 1 ? plotW / 2 : (plotW * i) / (labels.length - 1));
    const yFor = v => padT + plotH - ((v - min) / (max - min)) * plotH;

    function draw(hoverIdx) {
      ctx.clearRect(0, 0, W, H);
      // grid + y labels
      ctx.strokeStyle = th.border; ctx.fillStyle = th.faint; ctx.lineWidth = 1;
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (let g = 0; g <= 4; g++) {
        const val = min + (max - min) * (g / 4);
        const y = yFor(val);
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
        ctx.fillText(fmt(val), padL - 6, y);
      }
      // x labels
      ctx.textAlign = "center"; ctx.textBaseline = "top"; ctx.fillStyle = th.faint;
      const step = Math.ceil(labels.length / 8);
      labels.forEach((l, i) => { if (i % step === 0) ctx.fillText(l, xFor(i), H - padB + 6); });
      // series
      series.forEach((se, si) => {
        const color = se.color || PALETTE[si % PALETTE.length];
        ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.beginPath();
        se.data.forEach((v, i) => { const x = xFor(i), y = yFor(v); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
        ctx.stroke();
        // area
        ctx.lineTo(xFor(se.data.length - 1), padT + plotH); ctx.lineTo(xFor(0), padT + plotH);
        ctx.closePath(); ctx.globalAlpha = 0.07; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = 1;
        // points
        se.data.forEach((v, i) => {
          ctx.beginPath(); ctx.arc(xFor(i), yFor(v), hoverIdx === i ? 4.5 : 2.6, 0, 7);
          ctx.fillStyle = color; ctx.fill();
          if (hoverIdx === i) { ctx.strokeStyle = th.surface; ctx.lineWidth = 2; ctx.stroke(); }
        });
      });
      if (hoverIdx != null) {
        const x = xFor(hoverIdx);
        ctx.strokeStyle = th.border; ctx.setLineDash([4, 4]); ctx.beginPath();
        ctx.moveTo(x, padT); ctx.lineTo(x, padT + plotH); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    draw(null);
    canvas.onmousemove = e => {
      const r = canvas.getBoundingClientRect();
      const mx = e.clientX - r.left;
      let idx = Math.round(((mx - padL) / plotW) * (labels.length - 1));
      idx = Math.max(0, Math.min(labels.length - 1, idx));
      draw(idx);
      const rows = series.map((se, si) =>
        `<span style="color:${se.color || PALETTE[si % PALETTE.length]}">●</span> ${se.name}: <b>${fmt(se.data[idx])}</b>`).join("<br>");
      showTip(tip, e.clientX, e.clientY, `<b>${labels[idx]}</b><br>${rows}`);
    };
    canvas.onmouseleave = () => { hideTip(tip); draw(null); };
  }

  // ---------------------------------------------------------------- BAR -----
  function bar(container, opts) {
    const { labels, series } = opts;
    const s = setup(container, opts.height || 250);
    const { ctx, W, H, th, canvas, tip } = s;
    const padL = 44, padR = 14, padT = 14, padB = 40;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    let max = 0;
    labels.forEach((_, i) => series.forEach(se => { max = Math.max(max, se.data[i]); }));
    max = max * 1.15 || 1;
    const groupW = plotW / labels.length;
    const barW = Math.min(38, (groupW * 0.7) / series.length);
    const yFor = v => padT + plotH - (v / max) * plotH;
    const regions = [];

    function draw(hover) {
      ctx.clearRect(0, 0, W, H); regions.length = 0;
      ctx.strokeStyle = th.border; ctx.fillStyle = th.faint;
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (let g = 0; g <= 4; g++) {
        const val = max * g / 4, y = yFor(val);
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
        ctx.fillText(fmt(val), padL - 6, y);
      }
      labels.forEach((lbl, i) => {
        const gx = padL + groupW * i + groupW / 2;
        const total = series.length * barW + (series.length - 1) * 4;
        series.forEach((se, si) => {
          const x = gx - total / 2 + si * (barW + 4);
          const v = se.data[i], y = yFor(v), h = padT + plotH - y;
          const color = se.color || PALETTE[si % PALETTE.length];
          const hl = hover && hover.i === i && hover.si === si;
          ctx.fillStyle = color; ctx.globalAlpha = hl ? 1 : 0.9;
          roundRect(ctx, x, y, barW, h, 3); ctx.fill(); ctx.globalAlpha = 1;
          regions.push({ x, y, w: barW, h, i, si, v, name: se.name, color });
        });
        ctx.save(); ctx.fillStyle = th.muted; ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.font = "11px system-ui"; wrapLabel(ctx, lbl, gx, H - padB + 5, groupW - 4);
        ctx.restore();
      });
    }
    draw(null);
    canvas.onmousemove = e => {
      const r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      const hit = regions.find(rg => mx >= rg.x && mx <= rg.x + rg.w && my >= rg.y && my <= rg.y + rg.h);
      if (hit) { draw({ i: hit.i, si: hit.si }); showTip(tip, e.clientX, e.clientY,
        `<b>${labels[hit.i]}</b><br><span style="color:${hit.color}">●</span> ${hit.name}: <b>${fmt(hit.v)}</b>`); }
      else { hideTip(tip); draw(null); }
    };
    canvas.onmouseleave = () => { hideTip(tip); draw(null); };
  }

  // --------------------------------------------------------------- HBAR -----
  function hbar(container, opts) {
    const rows = opts.data; // [{label, value, color}]
    const s = setup(container, opts.height || (rows.length * 30 + 20));
    const { ctx, W, H, th, canvas, tip } = s;
    const padL = Math.min(150, opts.labelW || 120), padR = 46, padT = 6, padB = 6;
    const plotW = W - padL - padR;
    const max = Math.max(...rows.map(r => Math.abs(r.value)), 1) * 1.05;
    const rowH = (H - padT - padB) / rows.length;
    const regions = [];
    function draw(hi) {
      ctx.clearRect(0, 0, W, H); regions.length = 0;
      rows.forEach((r, i) => {
        const y = padT + rowH * i + rowH * 0.18, bh = rowH * 0.64;
        const w = (Math.abs(r.value) / max) * plotW;
        const color = r.color || PALETTE[i % PALETTE.length];
        ctx.fillStyle = th.muted; ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.font = "12px system-ui";
        ctx.fillText(clip(r.label, 20), padL - 8, y + bh / 2);
        ctx.fillStyle = color; ctx.globalAlpha = hi === i ? 1 : 0.88;
        roundRect(ctx, padL, y, w || 1, bh, 3); ctx.fill(); ctx.globalAlpha = 1;
        ctx.fillStyle = th.muted; ctx.textAlign = "left";
        ctx.fillText(fmt(r.value), padL + w + 6, y + bh / 2);
        regions.push({ x: padL, y, w: plotW, h: bh, i, r });
      });
    }
    draw(null);
    canvas.onmousemove = e => {
      const rect = canvas.getBoundingClientRect(), my = e.clientY - rect.top;
      const hit = regions.find(rg => my >= rg.y && my <= rg.y + rg.h);
      if (hit) { draw(hit.i); showTip(tip, e.clientX, e.clientY, `<b>${hit.r.label}</b>: ${fmt(hit.r.value)}`); }
      else { hideTip(tip); draw(null); }
    };
    canvas.onmouseleave = () => { hideTip(tip); draw(null); };
  }

  // --------------------------------------------------------------- DONUT ----
  function donut(container, opts) {
    const data = opts.data; // [{label, value, color}]
    const s = setup(container, opts.height || 230);
    const { ctx, W, H, th, canvas, tip } = s;
    const cx = W / 2, cy = H / 2, R = Math.min(W, H) / 2 - 12, r = opts.pie ? 0 : R * 0.58;
    const total = data.reduce((a, b) => a + b.value, 0) || 1;
    const regions = [];
    function draw(hi) {
      ctx.clearRect(0, 0, W, H); regions.length = 0;
      let a0 = -Math.PI / 2;
      data.forEach((d, i) => {
        const a1 = a0 + (d.value / total) * Math.PI * 2;
        const color = d.color || PALETTE[i % PALETTE.length];
        const off = hi === i ? 5 : 0;
        const mid = (a0 + a1) / 2;
        const ox = Math.cos(mid) * off, oy = Math.sin(mid) * off;
        ctx.beginPath(); ctx.moveTo(cx + ox, cy + oy);
        ctx.arc(cx + ox, cy + oy, R, a0, a1); ctx.closePath();
        ctx.fillStyle = color; ctx.fill();
        if (r > 0) { ctx.globalCompositeOperation = "destination-out";
          ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
          ctx.globalCompositeOperation = "source-over"; }
        regions.push({ a0, a1, i, d, color }); a0 = a1;
      });
      if (r > 0) {
        ctx.fillStyle = th.text; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.font = "700 22px system-ui"; ctx.fillText(fmt(total), cx, cy - 6);
        ctx.fillStyle = th.faint; ctx.font = "11px system-ui";
        ctx.fillText(opts.centerLabel || "Total", cx, cy + 14);
      }
    }
    draw(null);
    canvas.onmousemove = e => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left - cx, my = e.clientY - rect.top - cy;
      const dist = Math.hypot(mx, my);
      let ang = Math.atan2(my, mx); if (ang < -Math.PI / 2) ang += Math.PI * 2;
      const hit = (dist <= R && dist >= r) ? regions.find(rg => ang >= rg.a0 && ang < rg.a1) : null;
      if (hit) { draw(hit.i); const pct = Math.round(hit.d.value / total * 100);
        showTip(tip, e.clientX, e.clientY, `<span style="color:${hit.color}">●</span> ${hit.d.label}: <b>${fmt(hit.d.value)}</b> (${pct}%)`); }
      else { hideTip(tip); draw(null); }
    };
    canvas.onmouseleave = () => { hideTip(tip); draw(null); };
  }

  // -------------------------------------------------------------- HEATMAP ---
  function heatmap(container, opts) {
    // matrix[row][col], rowLabels, colLabels, low->high color
    const { matrix, rowLabels, colLabels } = opts;
    const s = setup(container, opts.height || 250);
    const { ctx, W, H, th, canvas, tip } = s;
    const padL = 34, padB = 26, padT = 6, padR = 6;
    const rows = matrix.length, cols = matrix[0].length;
    const cw = (W - padL - padR) / cols, ch = (H - padT - padB) / rows;
    let max = 0; matrix.forEach(r => r.forEach(v => max = Math.max(max, v)));
    max = max || 1;
    const regions = [];
    function colorFor(v) {
      const t = v / max;
      // green -> amber -> red risk gradient
      const r = Math.round(22 + t * 200), g = Math.round(163 - t * 130), b = Math.round(74 - t * 40);
      return v === 0 ? th.border : `rgb(${r},${g},${b})`;
    }
    function draw(hr, hc) {
      ctx.clearRect(0, 0, W, H); regions.length = 0;
      for (let ri = 0; ri < rows; ri++) for (let ci = 0; ci < cols; ci++) {
        const x = padL + ci * cw, y = padT + (rows - 1 - ri) * ch;
        ctx.fillStyle = colorFor(matrix[ri][ci]);
        ctx.globalAlpha = (hr === ri && hc === ci) ? 1 : 0.92;
        roundRect(ctx, x + 2, y + 2, cw - 4, ch - 4, 4); ctx.fill(); ctx.globalAlpha = 1;
        if (matrix[ri][ci] > 0) { ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.font = "700 12px system-ui"; ctx.fillText(matrix[ri][ci], x + cw / 2, y + ch / 2); }
        regions.push({ x: x + 2, y: y + 2, w: cw - 4, h: ch - 4, ri, ci });
      }
      ctx.fillStyle = th.faint; ctx.font = "10px system-ui";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      colLabels.forEach((l, ci) => ctx.fillText(l, padL + ci * cw + cw / 2, H - padB + 6));
      ctx.textAlign = "right"; ctx.textBaseline = "middle";
      rowLabels.forEach((l, ri) => ctx.fillText(l, padL - 4, padT + (rows - 1 - ri) * ch + ch / 2));
    }
    draw(-1, -1);
    canvas.onmousemove = e => {
      const rect = canvas.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const hit = regions.find(rg => mx >= rg.x && mx <= rg.x + rg.w && my >= rg.y && my <= rg.y + rg.h);
      if (hit) { draw(hit.ri, hit.ci);
        showTip(tip, e.clientX, e.clientY,
          `${opts.rowTitle || "Impact"} ${hit.ri + 1} × ${opts.colTitle || "Prob."} ${hit.ci + 1}<br><b>${matrix[hit.ri][hit.ci]}</b> items`); }
      else { hideTip(tip); draw(-1, -1); }
    };
    canvas.onmouseleave = () => { hideTip(tip); draw(-1, -1); };
  }

  // --------------------------------------------------------------- GAUGE ----
  function gauge(container, opts) {
    const s = setup(container, opts.height || 160);
    const { ctx, W, H, th } = s;
    const cx = W / 2, cy = H - 12, R = Math.min(W / 2, H) - 14;
    const val = Math.max(0, Math.min(100, opts.value));
    const col = val >= 75 ? "#16a34a" : val >= 45 ? "#d97706" : "#dc2626";
    ctx.lineWidth = 14; ctx.lineCap = "round";
    ctx.strokeStyle = th.border; ctx.beginPath(); ctx.arc(cx, cy, R, Math.PI, 0); ctx.stroke();
    ctx.strokeStyle = col; ctx.beginPath();
    ctx.arc(cx, cy, R, Math.PI, Math.PI + (val / 100) * Math.PI); ctx.stroke();
    ctx.fillStyle = th.text; ctx.textAlign = "center"; ctx.font = "700 30px system-ui";
    ctx.fillText(Math.round(val), cx, cy - 6);
    ctx.fillStyle = th.faint; ctx.font = "11px system-ui";
    ctx.fillText(opts.label || "", cx, cy + 10);
  }

  // -------------------------------------------------------------- SCATTER ---
  function scatter(container, opts) {
    const pts = opts.data; // [{x,y,r,label,color}]
    const s = setup(container, opts.height || 280);
    const { ctx, W, H, th, canvas, tip } = s;
    const padL = 44, padR = 16, padT = 14, padB = 34;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const maxX = Math.max(...pts.map(p => p.x), 1) * 1.1;
    const maxY = Math.max(...pts.map(p => p.y), 1) * 1.1;
    const xFor = v => padL + (v / maxX) * plotW, yFor = v => padT + plotH - (v / maxY) * plotH;
    function draw(hi) {
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = th.border; ctx.fillStyle = th.faint; ctx.textAlign = "right"; ctx.textBaseline = "middle";
      for (let g = 0; g <= 4; g++) { const y = padT + plotH - plotH * g / 4;
        ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
        ctx.fillText(fmt(maxY * g / 4), padL - 6, y); }
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      for (let g = 0; g <= 4; g++) ctx.fillText(fmt(maxX * g / 4), padL + plotW * g / 4, H - padB + 6);
      ctx.fillStyle = th.faint; ctx.fillText(opts.xLabel || "", padL + plotW / 2, H - 12);
      pts.forEach((p, i) => {
        ctx.beginPath(); ctx.arc(xFor(p.x), yFor(p.y), (p.r || 8) * (hi === i ? 1.25 : 1), 0, 7);
        ctx.fillStyle = p.color || PALETTE[0]; ctx.globalAlpha = hi === i ? 0.95 : 0.6; ctx.fill();
        ctx.globalAlpha = 1; ctx.strokeStyle = p.color || PALETTE[0]; ctx.lineWidth = 1.4; ctx.stroke();
      });
    }
    draw(null);
    canvas.onmousemove = e => {
      const rect = canvas.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
      let hi = null, best = 16;
      pts.forEach((p, i) => { const d = Math.hypot(mx - xFor(p.x), my - yFor(p.y));
        if (d < (p.r || 8) + 4 && d < best) { best = d; hi = i; } });
      draw(hi);
      if (hi != null) showTip(tip, e.clientX, e.clientY,
        `<b>${pts[hi].label}</b><br>${opts.xLabel || "x"}: ${fmt(pts[hi].x)} · ${opts.yLabel || "y"}: ${fmt(pts[hi].y)}`);
      else hideTip(tip);
    };
    canvas.onmouseleave = () => { hideTip(tip); draw(null); };
  }

  // -------------------------------------------------------------- TREEMAP ---
  function treemap(container, opts) {
    // items: [{label, value, color}]
    const items = opts.data.slice().sort((a, b) => b.value - a.value);
    const s = setup(container, opts.height || 260);
    const { ctx, W, H, th, canvas, tip } = s;
    const total = items.reduce((a, b) => a + b.value, 0) || 1;
    const rects = squarify(items, 0, 0, W, H, total);
    const regions = [];
    function draw(hi) {
      ctx.clearRect(0, 0, W, H); regions.length = 0;
      rects.forEach((r, i) => {
        const color = r.item.color || PALETTE[i % PALETTE.length];
        ctx.fillStyle = color; ctx.globalAlpha = hi === i ? 1 : 0.85;
        roundRect(ctx, r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3, 5); ctx.fill(); ctx.globalAlpha = 1;
        if (r.w > 54 && r.h > 26) {
          ctx.fillStyle = "#fff"; ctx.textAlign = "left"; ctx.textBaseline = "top";
          ctx.font = "700 12px system-ui"; ctx.fillText(clip(r.item.label, Math.floor(r.w / 8)), r.x + 8, r.y + 8);
          ctx.font = "11px system-ui"; ctx.globalAlpha = 0.85;
          ctx.fillText(fmt(r.item.value), r.x + 8, r.y + 24); ctx.globalAlpha = 1;
        }
        regions.push({ ...r, i });
      });
    }
    draw(null);
    canvas.onmousemove = e => {
      const rect = canvas.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const hit = regions.find(r => mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h);
      if (hit) { draw(hit.i); showTip(tip, e.clientX, e.clientY, `<b>${hit.item.label}</b>: ${fmt(hit.item.value)}`); }
      else { hideTip(tip); draw(null); }
    };
    canvas.onmouseleave = () => { hideTip(tip); draw(null); };
  }

  // squarified-ish treemap slicing
  function squarify(items, x, y, w, h, total) {
    const out = []; let cx = x, cy = y, cw = w, ch = h, remaining = total;
    let list = items.slice();
    while (list.length) {
      const horizontal = cw >= ch;
      const span = horizontal ? ch : cw;
      // take a run whose area fits reasonably; simple: one row at a time
      let run = [], runSum = 0;
      for (const it of list) {
        run.push(it); runSum += it.value;
        const thick = (runSum / remaining) * (horizontal ? cw : ch);
        // stop when aspect gets reasonable
        if (run.length >= 1 && (it.value / runSum) < 0.4 && run.length >= Math.min(2, list.length)) break;
        if (thick > span) break;
      }
      const thick = (runSum / remaining) * (horizontal ? cw : ch);
      let off = 0;
      run.forEach(it => {
        const frac = it.value / runSum;
        if (horizontal) { out.push({ x: cx, y: cy + off, w: thick, h: ch * frac, item: it }); off += ch * frac; }
        else { out.push({ x: cx + off, y: cy, w: cw * frac, h: thick, item: it }); off += cw * frac; }
      });
      if (horizontal) { cx += thick; cw -= thick; } else { cy += thick; ch -= thick; }
      remaining -= runSum; list = list.slice(run.length);
    }
    return out;
  }

  // ------- helpers -------
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2); if (r < 0) r = 0;
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function clip(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s; }
  function wrapLabel(ctx, text, x, y, maxW) {
    const words = String(text).split(" "); let line = "", yy = y;
    words.forEach(w => {
      if (ctx.measureText(line + w).width > maxW && line) { ctx.fillText(line.trim(), x, yy); line = ""; yy += 13; }
      line += w + " ";
    });
    ctx.fillText(line.trim(), x, yy);
  }

  window.Charts = { line, bar, hbar, donut, heatmap, gauge, scatter, treemap, PALETTE, fmt };
})();
