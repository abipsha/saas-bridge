import Fastify from "fastify";
import { config } from "./config";
import { logger } from "./core/logger";
import { registerTerrosWebhook } from "./routes/terrosWebhook";
import { registerVendoWebhook } from "./routes/vendoWebhook";
import { registerOdooWebhook } from "./routes/odooWebhook";

export function buildServer() {
  const app = Fastify({ logger: false, bodyLimit: 5 * 1024 * 1024 });

  app.get("/health", async () => ({ status: "ok", ts: new Date().toISOString() }));

  registerTerrosWebhook(app);
  registerVendoWebhook(app);
  registerOdooWebhook(app);

  app.setErrorHandler((err, _req, reply) => {
    logger.error("Unhandled route error", { err: err.message });
    reply.code(500).send({ error: "internal error" });
  });

  return app;
}

// Only start listening when run directly (not when imported by tests).
if (require.main === module) {
  const app = buildServer();
  app
    .listen({ port: config.port, host: "0.0.0.0" })
    .then((addr) => logger.info(`saas-bridge web listening at ${addr}`))
    .catch((err) => {
      logger.error("Failed to start server", { err: String(err) });
      process.exit(1);
    });
}
