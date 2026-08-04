# saas-bridge — Run & Deploy Guide

A step-by-step to get the bot from the zip onto GitHub, live on Render, and
wired to Terros + Vendo. Do the steps in order. Total time ~30–45 min.

---

## Step 1 — Get the code onto GitHub

The repo already exists (empty): **https://github.com/abipsha/saas-bridge**.
Pick ONE method to fill it.

### Option A — Terminal (fastest, preserves structure)

Unzip `saas-bridge.zip`, then in a terminal:

```bash
cd ~/Downloads/saas-bridge      # ← change to where you unzipped it
git init
git add .
git commit -m "Initial commit: saas-bridge integration"
git branch -M main
git remote add origin https://github.com/abipsha/saas-bridge.git
git push -u origin main
```

On `git push`, authenticate when prompted:
- Usually a browser window opens → click **Authorize**.
- If it asks for a password and rejects it (GitHub disabled password auth), run
  once: `brew install gh && gh auth login` (choose GitHub.com → HTTPS → login via
  browser), then re-run `git push -u origin main`.

### Option B — GitHub Desktop (no command line)

1. Install **GitHub Desktop** (desktop.github.com) and sign in as `abipsha`.
2. File → **Clone repository** → pick `abipsha/saas-bridge` → clone it to a folder.
3. Unzip `saas-bridge.zip` and **copy its contents** into that cloned folder
   (so `src/`, `package.json`, `render.yaml`, etc. sit at the folder's top level).
4. Back in GitHub Desktop you'll see all the files listed → type a summary →
   **Commit to main** → **Push origin**.

### Verify

Refresh https://github.com/abipsha/saas-bridge — you should see the **`src/`**
folder and `package.json`, `render.yaml`, `README.md` at the top level. If
everything is loose (no `src/` folder), the structure got flattened — redo with
Option A.

---

## Step 2 — (Optional) Run it locally first

Only if you want to test before deploying. Needs Node 20+.

```bash
cd saas-bridge
npm install
npm test                     # runs the unit tests
cp .env.example .env         # then fill in real values
npm run dev                  # starts the web service on http://localhost:3000
```

`curl http://localhost:3000/health` should return `{"status":"ok",...}`.

---

## Step 3 — Deploy to Render

1. Go to **https://render.com** and sign in (or create a free account).
2. **New +** → **Blueprint**.
3. Connect your GitHub and pick **abipsha/saas-bridge**. Render reads
   `render.yaml` and proposes two services: **saas-bridge-web** (the webhook
   server) and **saas-bridge-poll** (the cron job).
4. It will ask you to fill the secret env vars marked "sync: false" — see Step 4
   for the exact values. (You can also add them after, under each service →
   **Environment**.)
5. Click **Apply / Create**. Render builds and deploys (a few minutes).
6. When **saas-bridge-web** is live, copy its URL — it looks like
   **`https://saas-bridge-web.onrender.com`**. This is your `<APP-URL>` below.

> Keep the plan on **Starter** for the web service (not Free) — Free spins down
> when idle and would drop webhooks.

---

## Step 4 — Environment variables (what to paste into Render)

| Variable | Value / where to get it |
|---|---|
| `ODOO_URL` | Your Odoo URL, e.g. `https://yourco.odoo.com` |
| `ODOO_DB` | Your Odoo database name |
| `ODOO_USERNAME` | The bot user's login email |
| `ODOO_API_KEY` | Odoo → Preferences → Account Security → New API Key |
| `ODOO_FALLBACK_USER_ID` | A salesperson's `res.users` id (default `2`) |
| `ODOO_STAGE_*` | Your pipeline stage names (New/Booked/Quoted/Won/Lost) |
| `TERROS_API_KEY` | The **saas-bridge (Odoo integration)** key you created |
| `TERROS_WEBHOOK_TOKEN` | Make up a long random string (e.g. 32+ chars) |
| `VENDO_PUBLIC_KEY` | Vendo → Advanced Settings → Public API → Public Key |
| `VENDO_PRIVATE_KEY` | Vendo → Advanced Settings → Public API → Private Key |
| `VENDO_BASE_URL` | Confirm with Paradigm (default `https://api.paradigmvendo.com`) |
| `VENDO_WEBHOOK_AUTH_HEADER` | `x-webhook-token` (or your choice) |
| `VENDO_WEBHOOK_TOKEN` | Make up a long random string |

Generate a random token quickly: `openssl rand -hex 24`.

---

## Step 5 — Prepare Odoo

In Odoo, add these custom fields to **crm.lead** (Settings → Technical → Fields,
or Studio):

- `x_terros_account_id` (Char)
- `x_vendo_appointment_id` (Char)
- `x_vendo_quote_id` (Char)
- `x_appointment_datetime` (Datetime)

Confirm your CRM pipeline has stages whose names match your `ODOO_STAGE_*` values.

---

## Step 6 — Wire the webhooks (after you have `<APP-URL>`)

### Terros
`app.terros.com` → Integrations → **Webhooks** → **Add Webhook**:
- Entity: **Account**
- URL: `<APP-URL>/webhooks/terros/<TERROS_WEBHOOK_TOKEN>`
- Enable **Add** and **Update**

### Vendo
Vendo admin → Advanced Settings → **Webhooks**:
- Callback URL: `<APP-URL>/webhooks/vendo`
- Trigger: **Appointment Result**
- **Add Header**: name = your `VENDO_WEBHOOK_AUTH_HEADER`, value = your
  `VENDO_WEBHOOK_TOKEN`
- (You currently have one webhook pointing at Make. Either repoint it here, or
  add an Event Grid subscription instead so both run in parallel.)

---

## Step 7 — Test the whole loop

1. In Render, open **saas-bridge-web → Logs**.
2. In Terros, create or update a test account → you should see a
   `terrosToOdoo done` log line and a new lead in Odoo.
3. Run/finish a test appointment in Vendo → you should see `vendoToOdoo done`
   and the Odoo lead's stage + revenue update.

If a webhook 401s in the logs, the URL token / auth header doesn't match the env
var — fix and redeploy. If Vendo Create Appointment 4xxs, the Public API base URL
or auth header needs the value Paradigm confirms (Step 4).

---

## Handy commands

- Redeploy after a code change: push to GitHub `main` → Render auto-deploys.
- Change a secret: Render → service → **Environment** → edit → save (redeploys).
- Watch logs: Render → service → **Logs**.
