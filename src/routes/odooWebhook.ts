import type { FastifyInstance } from "fastify";
import { logger } from "../core/logger";
import { odooToTerros } from "../workflows/odooToTerros";

/**
 * Optional route for Workflow 4. Wire an Odoo Automation Rule to POST here
 * with { x_terros_account_id, stage } when a lead is Won/Lost.
 */
export function registerOdooWebhook(app: FastifyInstance): void {
  app.post("/webhooks/odoo", async (request, reply) => {
    const body = (request.body ?? {}) as { x_terros_account_id?: string; stage?: string };
    if (!body.x_terros_account_id || !body.stage) {
      return reply.code(202).send({ status: "ignored" });
    }
    try {
      await odooToTerros(body.x_terros_account_id, body.stage);
      return reply.code(200).send({ status: "ok" });
    } catch (err) {
      logger.error("odooToTerros failed", { err: String(err) });
      return reply.code(500).send({ error: "processing failed" });
    }
  });
}
