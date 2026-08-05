import type { FastifyInstance, FastifyRequest } from "fastify";
import { config } from "../config";
import { logger } from "../core/logger";
import { safeEqual } from "../core/verify";
import { terrosToOdoo } from "../workflows/terrosToOdoo";
import type { TerrosWebhookEnvelope } from "../core/types";

/**
 * Terros posts `{ action, entity, data }` to a registered webhook URL.
 * Terros does not sign bodies, so we protect the endpoint with a secret token
 * embedded in the path: register the URL as
 *   https://<app>.onrender.com/webhooks/terros/<TERROS_WEBHOOK_TOKEN>
 */
export function registerTerrosWebhook(app: FastifyInstance): void {
  app.post(
    "/webhooks/terros/:token",
    async (request: FastifyRequest<{ Params: { token: string } }>, reply) => {
      const token = request.params.token ?? "";
      if (!config.terros.webhookToken || !safeEqual(token, config.terros.webhookToken)) {
        logger.warn("Terros webhook rejected: bad or missing URL token");
        return reply.code(401).send({ error: "unauthorized" });
      }

      const body = request.body as TerrosWebhookEnvelope | TerrosWebhookEnvelope[];
      const events = Array.isArray(body) ? body : [body];

      const leadIds: Array<number | null> = [];
      for (const evt of events) {
        if (!evt || evt.entity !== "Account") {
          logger.debug("Ignoring non-Account webhook", { entity: evt?.entity });
          continue;
        }
        if (evt.action === "remove") {
          // We keep Odoo leads for history; log and skip. (Handle here if you
          // prefer to mark them Lost.)
          logger.info("Terros account removed; leaving Odoo lead as-is", {
            id: evt.data?.accountId ?? evt.data?.id,
          });
          continue;
        }
        leadIds.push(await terrosToOdoo(evt.data));
      }
      return reply.code(200).send({ status: "ok", leadIds });
    }
  );
}
