import { odoo } from "../clients/odoo";
import { config } from "../config";
import { logger } from "../core/logger";
import type { VendoOutcome } from "../core/types";

/**
 * Workflow 3 — outcome sync (the money step).
 * A Vendo Appointment Result advances the matching Odoo lead's stage and writes
 * the quote total. Matches by the Odoo lead id we set as the appointment's
 * integration_id; falls back to the stored Vendo appointment id.
 */
export async function vendoToOdoo(outcome: VendoOutcome): Promise<number | null> {
  let leadId: number | null = outcome.odooLeadId ?? null;

  if (!leadId && outcome.appointmentId) {
    leadId = await odoo.findLeadIdByExternal("x_vendo_appointment_id", outcome.appointmentId);
  }
  if (!leadId) {
    logger.warn("No Odoo lead matches Vendo result", {
      integrationId: outcome.odooLeadId,
      appointmentId: outcome.appointmentId,
    });
    return null;
  }

  const stageName =
    outcome.result === "won"
      ? config.odoo.stages.won
      : outcome.result === "lost"
        ? config.odoo.stages.lost
        : outcome.result === "quoted"
          ? config.odoo.stages.quoted
          : undefined;

  const vals: Record<string, unknown> = {};
  if (typeof outcome.amount === "number") vals.expected_revenue = outcome.amount;
  if (outcome.appointmentId) vals.x_vendo_appointment_id = outcome.appointmentId;
  if (stageName) {
    const stageId = await odoo.stageIdByName(stageName);
    if (stageId) vals.stage_id = stageId;
  }

  if (Object.keys(vals).length === 0) {
    logger.debug("Nothing to update for outcome", { outcome });
    return leadId;
  }

  await odoo.write("crm.lead", [leadId], vals);
  logger.info("vendoToOdoo done", { leadId, result: outcome.result, amount: outcome.amount });
  return leadId;
}
