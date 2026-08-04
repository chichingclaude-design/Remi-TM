#!/usr/bin/env bash
# Enterprise PPM Platform - shared-folder launcher (Linux). Plain script, not an .exe.
cd "$(dirname "$0")"
export PPM_JOURNAL=TRUNCATE
if command -v python3 >/dev/null 2>&1; then PY=python3
elif command -v python >/dev/null 2>&1; then PY=python
else echo "Python 3.9+ is required and must be permitted to run."; exit 1
fi
echo "Starting / joining the Enterprise PPM Platform..."
exec "$PY" app.py
