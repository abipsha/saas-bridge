import { defineConfig } from "vitest/config";

// Dummy env so `src/config.ts` loads during tests (it validates required vars
// at import time). Override per-test with vi.stubEnv when a value matters.
export default defineConfig({
  test: {
    env: {
      ODOO_URL: "http://odoo.test",
      ODOO_DB: "testdb",
      ODOO_USERNAME: "bot@test",
      ODOO_API_KEY: "key",
      ODOO_FALLBACK_USER_ID: "9",
      TERROS_API_KEY: "tkey",
      TERROS_WEBHOOK_TOKEN: "shh",
      VENDO_PUBLIC_KEY: "pk",
      VENDO_PRIVATE_KEY: "sk",
      VENDO_WEBHOOK_TOKEN: "vhook",
    },
  },
});
