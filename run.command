#!/usr/bin/env bash
# ============================================================
#  Enterprise PPM Platform - shared-folder launcher (macOS)
#  Double-click in Finder to start or join the shared tool.
#  This is a plain text script, NOT an .exe.
#  (First time only, if macOS blocks it: right-click -> Open.)
# ============================================================
cd "$(dirname "$0")"

# Network-share-safe database journal (WAL is unreliable on shared drives).
export PPM_JOURNAL=TRUNCATE

if command -v python3 >/dev/null 2>&1; then PY=python3
elif command -v python >/dev/null 2>&1; then PY=python
else
  echo "Python 3.9+ is required and must be permitted to run in your environment."
  echo "Ask IT to make Python available, then double-click again."
  read -n 1 -s -r -p "Press any key to close..."
  exit 1
fi

echo "Starting / joining the Enterprise PPM Platform..."
echo "Your browser will open automatically."
"$PY" app.py
