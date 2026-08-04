# Enterprise PPM Platform - container image for online hosting.
# Works on Render, Railway, Fly.io, Google Cloud Run, a VPS, etc.
# No third-party Python packages are needed; this only provides a Python runtime.
FROM python:3.12-slim

WORKDIR /app
COPY . /app

# Cloud runtime settings:
#  - PPM_SHARED=0     single always-on instance; no host-election / lock files
#  - PPM_NO_BROWSER=1 never try to open a desktop browser on the server
#  - PPM_DATA_DIR     persistent location for the SQLite database (mount a disk here)
#  - PPM_JOURNAL=WAL  fine on a real disk (only network shares need TRUNCATE)
ENV PPM_SHARED=0 \
    PPM_NO_BROWSER=1 \
    PPM_DATA_DIR=/var/data \
    PPM_JOURNAL=WAL \
    PYTHONUNBUFFERED=1

RUN mkdir -p /var/data

# Most platforms inject $PORT; app.py honors it automatically. 8000 is the default.
EXPOSE 8000

CMD ["python", "app.py"]
