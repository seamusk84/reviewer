
# Ireland Estate Reviews — Starter (Pages Router)

This version uses the classic **pages/** router to avoid any issues with uploading the **app/** directory via GitHub web UI.

## Deploy
1. Create a repo on GitHub; upload these files (unzip first).
2. On Vercel, **New Project** → select the repo → **Deploy** (defaults are fine).

## Use
- Visit your deployed URL.
- Click **Upload CSV** to load `county,town,estate` data.

## API
- POST `/api/suggestions` logs suggestions to the server console (see Vercel → Functions → Logs).
