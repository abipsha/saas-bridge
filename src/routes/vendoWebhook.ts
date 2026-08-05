import type { FastifyInstance, FastifyRequest } from "fastify";
import { config } from "../config";
import { logger } from "../core/logger";
import { safeEqual } from "../core/verify";
import { vendoResultToOutcome } from "../mappers/leadMapper";
import { vendoToOdoo } from "../workflows/vendoToOdoo";
import type { VendoResultPayload } from "../core/types";

/**
 * Paradigm Vendo posts here via Advanced Settings → Webhooks (trigger
 * "Appointment Result"). Secure it by adding a custom Authorization Header in
 * Vendo (Add Header) whose name/value match VENDO_WEBHOOK_AUTH_HEADER /
 * VENDO_WEBHOOK_TOKEN. The body is the mapped param object (VendoResultPayload).
 */
export function registerVendoWebhook(app: FastifyInstance): void {
  app.post("/webhooks/vendo", async (request: FastifyRequest, reply) => {
    const expected = config.vendo.webhookToken;
    if (expected) {
      const provided = request.headers[config.vendo.webhookAuthHeader];
      const value = Array.isArray(provided) ? (provided[0] ?? "") : (provided ?? "");
      if (!safeEqual(value, expected)) {
        logger.warn("Vendo webhook rejected: bad or missing auth header");
        return reply.code(401).send({ error: "unauthorized" });
      }
    }

    const body = (request.body ?? {}) as VendoResultPayload;
    try {
      const outcome = vendoResultToOutcome(body);
      const leadId = await vendoToOdoo(outcome);
      return reply.code(200).send({ status: "ok", leadId });
    } catch (err) {
      logger.error("Failed processing Vendo webhook", { err: String(err) });
      return reply.code(500).send({ error: "processing failed" });
    }
  });
}
