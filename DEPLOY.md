# Deploying CleanConnect (free)

This guide puts CleanConnect online for free, with HTTPS and no domain needed:

| Part | Service | Address you'll get |
|---|---|---|
| Frontend (Angular) | **Vercel** (Hobby) | `https://<your-project>.vercel.app` |
| Backend (FastAPI) | **Render** (free web service) | `https://cleanconnect-api.onrender.com` |
| Database | **Supabase** Postgres (free) | – |
| Photos | **Supabase** Storage (free, public bucket) | – |
| Keep-awake ping | **UptimeRobot** (free) | – |

HTTPS matters: browsers only share location (check-in, the map and the report pin picker) on HTTPS sites.

Locally nothing changes — without the environment variables below, the backend still uses SQLite and the `uploads/` folder.

> Sign in to every service with your GitHub account; it's the quickest. Do the steps **in order**.
> The dashboard labels below were correct when written; if a button is named slightly differently, look for the closest match.

---

## Before you start

The code must be on GitHub (`main` branch) — Render and Vercel deploy from there, and redeploy automatically on every push.

Have these ready:
- Your **Gemini API key** (the `GOOGLE_API_KEY` in your local `.env`, or create one at <https://aistudio.google.com/apikey>).
- A text file to paste values into as you go (don't commit it).

---

## Step 1 — Supabase (database + photo storage)

1. Go to <https://supabase.com> → **Start your project** → sign in with GitHub.
2. **New project**:
   - Name: `cleanconnect`
   - Database password: click **Generate a password**, or type one using **only letters and numbers** (special characters like `@ / # ?` break connection strings). **Save it** in your notes.
   - Region: the one closest to your users (e.g. *South Asia (Mumbai)*).
   - Plan: **Free**. Click **Create new project** and wait a minute or two.
3. **Create the photo bucket**: left sidebar → **Storage** → **New bucket**
   - Name: `uploads` (exactly)
   - **Public bucket: ON** (photos are shown to everyone in the feed)
   - Optional: restrict file size to `5 MB` and MIME types to `image/jpeg, image/png, image/webp`.
   - **Save**.
4. **Copy three values** into your notes:
   - **`SUPABASE_URL`** — **Project Settings** → **Data API** (or **API**) → *Project URL*, like `https://abcdefgh.supabase.co`.
   - **`SUPABASE_SERVICE_KEY`** — **Project Settings** → **API Keys** → *Secret keys* → copy the key that starts with `sb_secret_` (create one if none is listed).
     If your project only shows *Legacy API keys*, use the **`service_role`** key instead — both work.
     This key bypasses all security rules: **only ever put it in Render**, never in the frontend or in Git.
   - **`DATABASE_URL`** — click **Connect** at the top of the project page → **Connection String** → choose **Session pooler** (port **5432**) → copy the URI. It looks like
     `postgresql://postgres.abcdefgh:[YOUR-PASSWORD]@aws-0-ap-south-1.pooler.supabase.com:5432/postgres`
     Replace `[YOUR-PASSWORD]` (including the brackets) with your database password.
     ⚠️ Use the **Session pooler**, not *Direct connection*: the direct address only works over IPv6 and Render only has IPv4.

You don't need to create any tables — the backend creates them on its first start.

---

## Step 2 — Render (backend)

1. Go to <https://render.com> → **Get Started** → sign in with GitHub, and allow Render to see the `Clean-Connect` repository.
2. **New** → **Blueprint** → pick the `Clean-Connect` repository → Render reads `render.yaml` from the repo.
3. Fill in the values it asks for:

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | the Session pooler URI from Step 1 (with your password in it) |
   | `SUPABASE_URL` | from Step 1 |
   | `SUPABASE_SERVICE_KEY` | from Step 1 |
   | `GOOGLE_API_KEY` | your Gemini key |
   | `CORS_ORIGINS` | `*` for now — you'll set the real Vercel address in Step 4 |

   `SECRET_KEY` (for login tokens) is generated automatically, and `SUPABASE_BUCKET` is already set to `uploads`.
4. Click **Apply** / **Deploy Blueprint**. The first build takes a few minutes; follow it under the service's **Logs**.
5. When it says *Live*, copy the service address from the top of the page (e.g. `https://cleanconnect-api.onrender.com` — Render adds a suffix if the name is taken) into your notes as **`API_URL`**.
6. Check it: open `<API_URL>/health` in your browser → you should see `{"status":"ok"}`.

<details>
<summary>If Blueprints aren't offered on your account: create the service by hand</summary>

**New** → **Web Service** → connect the `Clean-Connect` repo, then:

- Language: **Python 3**, Branch: `main`, Root directory: *(leave empty)*
- Build command: `pip install -r requirements.txt`
- Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips "*"`
- Instance type: **Free**
- Environment variables: the five from the table above, plus `SECRET_KEY` (a long random string — e.g. run `python -c "import secrets; print(secrets.token_urlsafe(48))"`), `SUPABASE_BUCKET` = `uploads` and `PYTHON_VERSION` = `3.13.4`
- Advanced → Health check path: `/health`
</details>

---

## Step 3 — Vercel (frontend)

1. Go to <https://vercel.com> → **Sign Up** → **Continue with GitHub** (Hobby plan).
2. **Add New…** → **Project** → **Import** the `Clean-Connect` repository.
3. On the configure screen:
   - **Root Directory**: click **Edit** → choose **`frontend`**.
   - Framework preset: Angular (detected automatically). Build command and output folder come from `frontend/vercel.json` — leave them as they are.
   - **Environment Variables**: add `API_URL` = your Render address from Step 2 (starting with `https://`, no trailing slash).
4. Click **Deploy**. When it finishes, open the address Vercel shows (e.g. `https://clean-connect.vercel.app`) and copy it into your notes as **`FRONTEND_URL`**.

---

## Step 4 — Allow only your frontend to call the API

Render → your `cleanconnect-api` service → **Environment** → set `CORS_ORIGINS` to your `FRONTEND_URL` (e.g. `https://clean-connect.vercel.app` — `https://`, no trailing slash) → **Save changes**. Render redeploys automatically (about a minute).

If you later add another address (e.g. a Vercel preview URL), separate them with commas.

---

## Step 5 — UptimeRobot (keeps the free services awake)

Render's free service sleeps after 15 minutes without traffic (the next visitor then waits about a minute), and Supabase pauses a free project after a week without database activity. A ping every 5 minutes to `/health` — which runs a tiny database query — prevents both. Render's 750 free hours a month cover running one service all month.

1. Go to <https://uptimerobot.com> → sign up for the free plan.
2. **New monitor** → type **HTTP(s)** → URL: `<API_URL>/health` → interval **5 minutes** → **Create monitor**.

---

## Step 6 — Try it

Open your `FRONTEND_URL`:

- **Sign up** and log in.
- **Report an issue** with a couple of photos — tap *Use current location* (allow location), adjust the pin, submit.
- Check the **Feed** and the **Map** show it, and that photos load.
- Ask the **AI Assistant** something — the reply should appear word by word.

That's it — CleanConnect is live. 🎉

---

## Updating the app

Push to `main` and both Render and Vercel redeploy automatically. Your data stays in Supabase, so redeploys never lose reports or photos.

## Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Render build fails while installing Python | Render doesn't offer that exact Python version: set `PYTHON_VERSION` to a current `3.13.x` from Render's docs. |
| `/health` fails, logs mention the database or `could not translate host name` | `DATABASE_URL` is the *Direct connection* string (use **Session pooler**), still contains `[YOUR-PASSWORD]`, or the password has special characters (reset it in Supabase → Project Settings → Database, letters and numbers only). |
| Logs say `password authentication failed` | Wrong password in `DATABASE_URL`, or the user isn't `postgres.<project-ref>` (copy the pooler URI again). |
| Uploads fail with *"Couldn't save the photo"* | Render's logs show Supabase's reply: check the bucket is named `uploads` and is **public**, and that `SUPABASE_SERVICE_KEY` is the **secret**/`service_role` key (not the publishable/anon one). |
| The site loads but nothing else does; browser console shows *CORS* | `CORS_ORIGINS` doesn't exactly match the frontend address (`https://`, no trailing slash). |
| Vercel build fails with *API_URL is not set* | Add `API_URL` in Vercel → Project → Settings → Environment Variables, then **Redeploy**. |
| First request after a while is very slow | Render was asleep — check the UptimeRobot monitor is running. |
| Supabase dashboard says the project is paused | Click **Restore**, and check the UptimeRobot monitor. |
| "Allow location" never appears | Location only works over HTTPS — use the `https://…vercel.app` address. |

## Notes and limits (free tiers)

- **Supabase free**: 500 MB database and 1 GB of photo storage — plenty for 50–100 users (photos are resized to at most 1600 px when uploaded).
- **Render free**: 512 MB RAM, 750 hours a month; the disk is wiped on every deploy, which is why photos live in Supabase.
- **Vercel Hobby** is for personal, non-commercial projects.
- **Map tiles** come from OpenStreetMap's free tile servers, which is fine for a small personal project. For anything bigger, switch the tile URL in `frontend/src/app/shared/map-pins.ts` to a provider's free tier (e.g. MapTiler).
- **Secrets** (`SECRET_KEY`, `SUPABASE_SERVICE_KEY`, `GOOGLE_API_KEY`, the database password) live only in Render's environment settings — never in Git or in the frontend.
