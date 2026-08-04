# saas-bridge

A small, custom integration bot that connects **Terros**, **Paradigm Vendo**, and
**Odoo CRM**. It runs on [Render](https://render.com) as an always-on web service
(for inbound webhooks) plus a cron job (for polling Odoo).

Odoo CRM is the source of truth. Terros feeds new canvassing leads in; Vendo
appointment/quote outcomes flow back to Odoo; an optional step reflects closed
deals back to Terros.

```
Terros  ──(Account webhook)──►  ┌──────────────┐
                                │  saas-bridge │ ──►  Odoo CRM (crm.lead)
Vendo   ──(Event Grid)───────►  │  (Render)    │ ──►  Vendo (Create Appointment)
Odoo    ──(cron poll)────────►  └──────────────┘
```

## Architecture

The business logic is provider-agnostic. Only the two entry-points know about
the runtime, so this can move off Render with almost no change.

| Layer | Files | Responsibility |
|---|---|---|
| Entry — web | `src/server.ts`, `src/routes/*` | Fastify HTTP service; receives webhooks |
| Entry — cron | `src/cron/pollOdoo.ts` | Scheduled Odoo → Vendo booking |
| Workflows | `src/workflows/*` | The 4 business flows |
| Clients | `src/clients/*` | Odoo (XML-RPC), Terros, Vendo (REST) |
| Mapping | `src/mappers/leadMapper.ts` | Field mapping between systems |
| Core | `src/core/*`, `src/config.ts` | Types, logging, config, signature verify |

### The workflows

1. **Terros → Odoo** (`terrosToOdoo`) — a Terros Account webhook upserts a
   `crm.lead`, stamped with `x_terros_account_id`. Idempotent.
2. **Odoo → Vendo** (`bookAppointment`, run by the cron poll) — a lead in the
   *Booked* stage without an appointment gets one created in Vendo; the
   appointment id is written back to `x_vendo_appointment_id`.
3. **Vendo → Odoo** (`vendoToOdoo`) — a Vendo Event Grid quote/appointment event
   advances the matching lead's stage and writes `expected_revenue`.
4. **Odoo → Terros** (`odooToTerros`, optional) — on Won/Lost, reflect status
   back to the Terros account. Trigger via an Odoo Automation Rule → `/webhooks/odoo`.

### HTTP endpoints

| Method | Path | Source |
|---|---|---|
| GET | `/health` | Render health check |
| POST | `/webhooks/terros/:token` | Terros account webhook (secret URL token) |
| POST | `/webhooks/vendo` | Paradigm Vendo Appointment Result webhook (custom auth header) |
| POST | `/webhooks/odoo` | Optional Odoo Automation Rule |

### Terros contract (confirmed against docs.terros.com)

- **Auth:** `Authorization: ApiKey <KEY>`, base URL `https://api.terros.com`.
- **Webhook body:** `{ action: "add" | "update" | "remove", entity: "Account", data: <account> }`.
  Terros webhooks are **not signed** — we protect the endpoint with a secret token
  in the URL path (`TERROS_WEBHOOK_TOKEN`).
- **Account → Odoo field mapping:** customer is the `resident` object
  (`firstName`/`lastName`/`name`, `email`, `phone`); address is `location`
  (`line1`→street, `locality`→city, `postal1`→zip); rep is `owner.email`;
  Terros id is `accountId`; appointment time is `appointmentDate` (epoch ms).
  We store the Odoo lead id in Terros' native `externalLeadId` for reflect-back.

### Vendo contract (confirmed in the Vendo admin → Advanced Settings)

- **Create Appointment** (Public API): auth is a **Public Key + Private Key**
  pair; body uses the exact param keys — `duration`, `schedule_time`
  (`2026-08-05T18:22:26.229`), `seller_email`, `appointment_integration_id`
  (we set = the Odoo lead id), `customer_first_name/last_name/email/phone`,
  `address1/city/state/country/postal_code`. The base URL and exact auth-header
  names are the only items not shown in the admin — confirm with Paradigm and
  adjust `src/clients/vendo.ts` if needed.
- **Outcome** uses Vendo's **Webhooks** feature (not Event Grid): a plain POST
  with a custom Authorization Header and the **Appointment Result** trigger. The
  payload carries `integration_id` (= our Odoo lead id), `quote_price`, and a
  `result[]` array whose `name` is `Sold` / `Not Sold` / `Dead` — we map Sold→Won,
  all-not-sold→Lost, priced-no-sale→Quoted, and write `quote_price` to
  `expected_revenue`.

## One-time setup before it works

1. **Odoo — add custom fields** to `crm.lead` (Settings → Technical → Fields, or
   Studio). All are the "Char" type except revenue/datetime:
   - `x_terros_account_id` (Char)
   - `x_vendo_appointment_id` (Char)
   - `x_vendo_quote_id` (Char)
   - `x_appointment_datetime` (Datetime) — when the in-home appointment is booked
   Confirm your pipeline has stages named to match the `ODOO_STAGE_*` env vars
   (New / Booked / Quoted / Won / Lost), and generate an **API key** for the bot
   user (Preferences → Account Security → New API Key).

2. **Terros** — generate an API key at `app.terros.com/integration/apikey`
   (admin required; the create step asks you to re-authenticate). Set a long
   random `TERROS_WEBHOOK_TOKEN`, then add an **Account webhook** at
   `Integrations → Webhooks → Add Webhook`: Entity **Account**, URL
   `https://<your-app>.onrender.com/webhooks/terros/<TERROS_WEBHOOK_TOKEN>`,
   and enable the **Add** and **Update** events. (Client + mapper already match
   the documented contract — no code changes needed.)

3. **Paradigm Vendo** (Advanced Settings, admin — mostly self-serve):
   - **Public API** → copy the **Public Key** and **Private Key** into
     `VENDO_PUBLIC_KEY` / `VENDO_PRIVATE_KEY`.
   - **Webhooks** → set the callback URL to
     `https://<your-app>.onrender.com/webhooks/vendo`, enable the **Appointment
     Result** trigger, and **Add Header** with a name/value matching
     `VENDO_WEBHOOK_AUTH_HEADER` / `VENDO_WEBHOOK_TOKEN`. (You currently have one
     webhook pointing at Make — either repoint it here or use an Event Grid
     subscription to run both in parallel.)
   - **Confirm with Paradigm:** the Public API **base URL** and how the
     Public/Private keys are sent (header names). That's the only unknown; set
     `VENDO_BASE_URL` and adjust `headers()` in `src/clients/vendo.ts`.

4. **Rep mapping** — fill in `REP_MAP` in `src/mappers/leadMapper.ts` (Terros rep
   email → Odoo salesperson id), or rely on `ODOO_FALLBACK_USER_ID`.

## Local development

```bash
cp .env.example .env      # fill in real credentials
npm install
npm run dev               # starts the web service with hot reload
# In another shell, replay a sample Terros webhook:
curl -X POST localhost:3000/webhooks/terros -H 'content-type: application/json' \
  -d '{"id":"T-123","firstName":"Jane","lastName":"Doe","email":"jane@example.com","phone":"555-0100","address":{"street":"123 Main St","city":"Austin","zip":"78701"},"ownerEmail":"rep@yourco.com"}'
```

Run the poller once locally: `npm run cron:poll`.

## Deploy to Render

This repo includes `render.yaml`, a Render Blueprint.

1. Push this folder to a GitHub repo.
2. In Render: **New + → Blueprint**, pick the repo. It creates the web service
   and the cron job.
3. Fill in the secret env vars (the ones marked `sync: false`): the `ODOO_*`,
   `TERROS_*`, and `VENDO_*` credentials.
4. Deploy. Copy the web service URL and register it as the webhook target in
   Terros and the Event Grid endpoint in Vendo.

**Cost:** two `starter` services at ~$7/mo each (web + cron). Do **not** use the
free plan for the web service — it spins down when idle and would drop webhooks.
If you want to trim cost, you can instead run the poll as a second route hit by
an external scheduler and drop the cron service.

## Notes & guardrails

- **Idempotency:** every write to Odoo upserts by external id (then email/phone),
  so duplicate webhook deliveries are safe.
- **Retries:** webhook handlers return non-2xx on failure so Terros/Event Grid
  redeliver; the HTTP client retries once on upstream 5xx.
- **Secrets:** never commit `.env`. On Render they live in the service's
  Environment settings.
- **`.verify/`** contains offline typecheck stubs only and is not needed to run.
