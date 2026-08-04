# Access notes

Status after reading the live docs: **Terros is fully mapped** — no email to
their support needed. **Vendo** is the only outstanding item (partner-gated).

---

## Terros — self-serve checklist (no support ticket needed)

You have admin, so you can do all of this in-app:

1. **API key** — `app.terros.com/integration/apikey` → **Add API Key** (name it
   `saas-bridge`). The create step asks you to re-authenticate with your Terros
   password; copy the key once and store it as `TERROS_API_KEY` in Render.
2. **Webhook token** — pick a long random string; set it as `TERROS_WEBHOOK_TOKEN`.
3. **Register the webhook** — `Integrations → Webhooks → Add Webhook`:
   - Entity: **Account**
   - URL: `https://<your-app>.onrender.com/webhooks/terros/<TERROS_WEBHOOK_TOKEN>`
   - Enable **Add** and **Update** (leave Remove off unless you want deletions)

That's everything Terros needs — the code already matches the documented
auth (`Authorization: ApiKey`), webhook envelope (`{action, entity, data}`), and
Account field shape (`resident` / `location` / `owner` / `accountId`).

---

## Vendo — mostly self-serve now (we read the admin)

Almost everything is confirmed from **Advanced Settings** in the Vendo admin:

1. **Public API** → copy **Public Key** + **Private Key** into
   `VENDO_PUBLIC_KEY` / `VENDO_PRIVATE_KEY`. The Create Appointment param keys are
   already coded.
2. **Webhooks** → set the callback URL to
   `https://<your-app>.onrender.com/webhooks/vendo`, enable the **Appointment
   Result** trigger, and **Add Header** matching `VENDO_WEBHOOK_AUTH_HEADER` /
   `VENDO_WEBHOOK_TOKEN`. (You have one webhook on Make today — repoint it, or use
   an Event Grid subscription to run both during a parallel-run cutover.)

### One short question to send Paradigm support

**Subject:** Public API endpoint + auth for our Vendo account

Hi [Paradigm contact], we're calling the Vendo **Public API** (Create/Get
Appointment) for account **[dealer name]** using our Public/Private key pair.
Could you confirm the **base URL** and **exactly how to send the keys**
(header names? HTTP basic? a signature?), plus the **Get Appointment** path and
response shape? Thanks!

### When they reply — where it plugs in

| What they tell you | File to update |
|---|---|
| Public API base URL | `VENDO_BASE_URL` |
| How the Public/Private keys are sent | `headers()` in `src/clients/vendo.ts` |
| Get Appointment path/response | `getAppointment()` in `src/clients/vendo.ts` |
