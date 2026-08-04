#!/usr/bin/env python3
"""
One-time helper: download Apache ECharts into frontend/vendor/echarts.min.js.

Run this ONCE on a machine that has internet access:

    python3 get_echarts.py

After that the platform renders every chart with real Apache ECharts, fully
offline. If this file is not present, the app automatically falls back to its
bundled canvas charting engine, so it still runs perfectly without internet.

You can also place echarts.min.js into frontend/vendor/ manually instead of
running this script.
"""
import os
import sys
import urllib.request

VERSION = "5.5.1"
# Several mirrors are tried in order; the first that works wins.
SOURCES = [
    f"https://cdn.jsdelivr.net/npm/echarts@{VERSION}/dist/echarts.min.js",
    f"https://unpkg.com/echarts@{VERSION}/dist/echarts.min.js",
    f"https://cdnjs.cloudflare.com/ajax/libs/echarts/{VERSION}/echarts.min.js",
]

HERE = os.path.dirname(os.path.abspath(__file__))
DEST_DIR = os.path.join(HERE, "frontend", "vendor")
DEST = os.path.join(DEST_DIR, "echarts.min.js")


def main():
    os.makedirs(DEST_DIR, exist_ok=True)
    for url in SOURCES:
        try:
            print(f"Downloading ECharts {VERSION} from:\n  {url}")
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            if len(data) < 100_000:
                print("  ...response too small, trying next mirror.")
                continue
            with open(DEST, "wb") as f:
                f.write(data)
            print(f"\nSaved {len(data):,} bytes to:\n  {DEST}")
            print("\nDone. Restart the app (or just refresh the browser) to use ECharts.")
            return 0
        except Exception as e:
            print(f"  ...failed: {e}")
    print("\nCould not download ECharts from any mirror.")
    print("The app will keep using its built-in offline charting engine.")
    print("If you have the file already, drop it at:")
    print(f"  {DEST}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
