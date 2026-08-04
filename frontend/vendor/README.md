# Vendor libraries

## echarts.min.js (optional)

Place **`echarts.min.js`** (Apache ECharts v5) in this folder to render every chart
with real Apache ECharts.

Two ways to get it:

1. Run the downloader once on a machine with internet:
   ```
   python3 get_echarts.py
   ```
2. Or download it yourself from https://echarts.apache.org/en/index.html
   (the `dist/echarts.min.js` build) and drop it here.

If this file is **absent**, the platform automatically uses its bundled, dependency-free
canvas charting engine — so the app still runs 100% offline with no setup. When the
file is present, `charts-echarts.js` detects it and upgrades every chart to ECharts
automatically; no other changes are needed.
