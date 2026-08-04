# Deploying online (browser-based, nothing installed on user machines)

This guide puts the platform on the internet so your team just opens a **URL** in any
browser (Chrome, Edge, Safari, Firefox). Nothing is installed on anyone's computer, and
no Python runs on user machines — it all runs on the host you deploy to.

## First, an important clarification about Google Drive

Google Drive **cannot host or run a web app**. It stores files, but it cannot execute
server code or serve an application at a URL (Google removed web-page hosting from Drive
in 2016). A multi-user tool with logins and a shared database needs a live server and
database running somewhere, which Drive does not provide.

What you *can* keep in Google Drive is the **link** to the running tool (for example in
a shared Doc or a bookmark), and any exported reports or backups. The application itself
must run on a host. The options below are all quick and inexpensive.

## What "hosting" gives you

- One always-on server in the cloud — this also solves the "no machine can stay on"
  problem, because the cloud host is always on.
- A single shared database that is created once and preserved. Backups still work from
  Administration → Settings.
- HTTPS (a padlock and a secure `https://…` address) provided automatically by the host.
- All existing functionality unchanged — it is the same application.

---

## Deploying to Render (step by step)

Render keeps a persistent disk attached to your service, so the built-in database is
preserved across restarts and updates. This is comfortably enough for ~15 users.

### What it costs

You need a **paid Starter instance ($7/month)** because the persistent disk (which keeps
your data) is not available on the free tier — the free tier has no disk and also sleeps
after 15 minutes of inactivity, so it would lose data. The 1 GB disk adds about
**$0.25/month**. The workspace itself (Hobby) is free. So budget roughly **$7–8/month
total** for the whole team's tool. No credit card is needed to explore, only to run the
paid instance.

### Step 1 — Put the project files where Render can read them (a Git repo)

Render deploys from a Git repository. You do not need to know Git — GitHub's website can
do it by drag-and-drop:

1. Create a free account at https://github.com.
2. Click **New repository**, give it a name (e.g. `ppm-platform`), keep it **Private**,
   and click **Create repository**.
3. On the new repo page click **uploading an existing file**.
4. Unzip `ppm-platform.zip` on your computer, then drag **all the files and folders from
   inside it** into the browser upload area. Click **Commit changes**.

(That's the only "technical" step, and it's just drag-and-drop in a browser.)

### Step 2 — Create the service on Render

1. Create a free account at https://render.com and, when asked, connect your GitHub
   account.
2. Click **New +** → **Blueprint**.
3. Select the `ppm-platform` repository. Render finds the included `render.yaml` and shows
   a service named **ppm-platform** with a 1 GB disk in the **Frankfurt** region.
4. It will prompt for the one secret value, **PPM_ADMIN_PASSWORD** — type a strong
   password (≥12 characters with an uppercase letter, a lowercase letter, a number and a
   special character). This becomes the `director` sign-in password.
5. Click **Apply / Deploy**. The first build takes a few minutes.
6. When it finishes, Render shows a URL like `https://ppm-platform.onrender.com` (with a
   secure padlock). **That URL is your tool** — share it with your 15 users; they just
   open it in any browser.

> Prefer clicking over the Blueprint file? Instead of step 2 you can do **New +** → **Web
> Service** → connect the repo → choose **Docker** → add a **Disk** mounted at
> `/var/data` (1 GB) → add the environment variable `PPM_ADMIN_PASSWORD` → set
> `PPM_DATA_DIR=/var/data` and `PPM_SHARED=0` → **Create Web Service**. Same result.

### Step 3 — Lock it down (see the security checklist below)

Sign in as `director`, deactivate the sample accounts, and create your real users.

### Updating later

To ship a new version, upload the changed files to the same GitHub repo (same drag-and-
drop). Render redeploys automatically; the database on the disk is untouched.

### A couple of Render notes

- Keep the service at **1 instance** (the default when a disk is attached). A single
  instance is exactly what the built-in database wants, so do not enable autoscaling.
- You can add your own custom domain later (e.g. `ppm.yourcompany.com`) under the
  service's **Settings → Custom Domains**, and put that link in Google Drive or a bookmark.

---

## Alternative hosts (same Docker image)

Railway (https://railway.app) and Fly.io (https://fly.io) work the same way using the
included `Dockerfile` — create a service from the repo, add a volume mounted at
`/var/data`, set `PPM_ADMIN_PASSWORD`, and deploy.

---

## Google Cloud Run (only if you specifically want Google-native)

Cloud Run's local disk is temporary, so the built-in SQLite file would reset on restart.
You would need either a Cloud Run **volume mount** backed by a persistent disk (set
`PPM_DATA_DIR` to that path), or a managed **Postgres** database (Cloud SQL), which needs
a small code addition — tell me and I will add it. For your case, Render is simpler and
cheaper, so it is the recommended path.

---

## Security checklist (do this right after the first deploy)

The platform ships with sample accounts so features can be explored. On a public URL you
must lock these down:

1. Sign in as `director` with the password you set in `PPM_ADMIN_PASSWORD`.
2. Go to **Administration → Users** and **deactivate** the sample accounts
   (`manager`, `specialist`, `clerk`, and the `spec…` demo users). Deactivated accounts
   cannot sign in.
3. Create real accounts for your 15 users (each gets a strong password; the form
   enforces the policy and can generate one).
4. Optionally delete the sample projects/tasks once you are ready to use real data.

HTTPS is handled by the host, so logins and data are encrypted in transit. Sessions
expire after 12 hours.

---

## Environment variables (reference)

| Variable             | Use                                                              |
|----------------------|------------------------------------------------------------------|
| `PORT`               | Set automatically by most hosts; the app listens on it.          |
| `PPM_ADMIN_PASSWORD` | Sets the `director` password on first launch. Set this.          |
| `PPM_DATA_DIR`       | Where the database/backups live. Point at a persistent disk.     |
| `PPM_SHARED`         | `0` for a single cloud instance (disables local host-election).  |
| `PPM_NO_BROWSER`     | `1` on a server (don't try to open a desktop browser).           |
| `PPM_JOURNAL`        | `WAL` on a real disk; `TRUNCATE` only if the DB is on a network share. |

All of these are already set sensibly in the `Dockerfile` and `render.yaml`; in most
cases you only need to provide `PPM_ADMIN_PASSWORD`.

---

## Keeping the code in Google Drive

If you would like the source to also live in Google Drive for safekeeping, that is fine —
store the project zip there. Just remember Drive is storage only; the *running* tool is
the deployed URL from one of the options above.
