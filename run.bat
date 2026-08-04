@echo off
REM ============================================================
REM  Enterprise PPM Platform - shared-folder launcher (Windows)
REM  Double-click this file to start or join the shared tool.
REM  This is a plain text script, NOT an .exe.
REM ============================================================
cd /d "%~dp0"

REM Network-share-safe database journal (WAL is not reliable on shared drives).
set PPM_JOURNAL=TRUNCATE

REM Find an approved Python (installed by your IT). No .exe is bundled.
where python >nul 2>nul
if %errorlevel%==0 (
  set PY=python
) else (
  where py >nul 2>nul
  if %errorlevel%==0 (
    set PY=py
  ) else (
    echo Python 3.9+ is required and must be permitted to run in your environment.
    echo Ask IT to make Python available, then double-click this file again.
    pause
    exit /b 1
  )
)

echo Starting / joining the Enterprise PPM Platform...
echo Your browser will open automatically.
%PY% app.py
pause
