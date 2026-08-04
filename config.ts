/**
 * Central configuration. Reads from environment variables (a `.env` file
 * locally, or Render's Environment settings in production).
 */
function req(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") throw new Error(`Missing required env var: ${name}`);
  return v.trim();
}

function opt(name: string, fallback: string): string {
  const v = process.env[name];
  return v && v.trim() !== "" ? v.trim() : fallback;
}

export const config = {
  odoo: {
    url: req("ODOO_URL").replace(/\/+$/, ""),
    db: req("ODOO_DB"),
    username: req("ODOO_USERNAME"),
    apiKey: req("ODOO_API_KEY"),
    fallbackUserId: Number(opt("ODOO_FALLBACK_USER_ID", "1")),
    stages: {
      new: opt("ODOO_STAGE_NEW", "New"),
      booked: opt("ODOO_STAGE_BOOKED", "Booked"),
      quoted: opt("ODOO_STAGE_QUOTED", "Quoted"),
      won: opt("ODOO_STAGE_WON", "Won"),
      lost: opt("ODOO_STAGE_LOST", "Lost"),
    },
  },
  terros: {
    baseUrl: opt("TERROS_BASE_URL", "https://api.terros.com").replace(/\/+$/, ""),
    apiKey: req("TERROS_API_KEY"),
    // Terros webhooks are NOT HMAC-signed — security is the unguessable URL.
    // We embed this secret token as a path segment and verify it on each call.
    webhookToken: opt("TERROS_WEBHOOK_TOKEN", ""),
  },
  vendo: {
    // Public API (Create Appointment). Base URL + exact auth header names are
    // the one thing not shown in the admin UI — confirm against Paradigm's API
    // doc and adjust src/clients/vendo.ts if they differ.
    baseUrl: opt("VENDO_BASE_URL", "https://api.paradigmvendo.com").replace(/\/+$/, ""),
    publicKey: req("VENDO_PUBLIC_KEY"),
    privateKey: req("VENDO_PRIVATE_KEY"),
    // Inbound Appointment Result webhook: we add a custom Authorization Header
    // in Vendo (Advanced Settings → Webhooks → Add Header) and verify it here.
    webhookAuthHeader: opt("VENDO_WEBHOOK_AUTH_HEADER", "x-webhook-token").toLowerCase(),
    webhookToken: opt("VENDO_WEBHOOK_TOKEN", ""),
  },
  port: Number(opt("PORT", "3000")),
  logLevel: opt("LOG_LEVEL", "info"),
};

export type Config = typeof config;
