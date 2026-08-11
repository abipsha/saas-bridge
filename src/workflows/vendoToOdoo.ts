import { odoo } from "../clients/odoo";
import { config } from "../config";
import { logger } from "../core/logger";
import type { VendoOutcome } from "../core/types";

/**
 * Workflow 3 — outcome sync (the money step).
 * A Vendo Appointment Result advances the matching Odoo lead's stage and writes
 * the quote total, quote id, installation-notes URL, salesperson and notes.
 * Match order: the Odoo lead id we set as the appointment's integration_id →
 * the stored Vendo appointment id → the CRM id (if it carries a numeric lead id).
 */
export async function vendoToOdoo(outcome: VendoOutcome): Promise<number | null> {
  // Primary match: Vendo's integration_id equals the Odoo lead's "Vendo ID"
  // custom field (x_studio_vendo_id). Falls back to the numeric lead id, the
  // stored Vendo appointment id, then the CRM id.
  let leadId: number | null = null;

  if (outcome.vendoId) {
    leadId = await odoo.findLeadIdByExternal("x_studio_vendo_id", outcome.vendoId);
  }
  if (!leadId && outcome.odooLeadId) {
    leadId = outcome.odooLeadId;
  }
  if (!leadId && outcome.appointmentId) {
    leadId = await odoo.findLeadIdByExternal("x_vendo_appointment_id", outcome.appointmentId);
  }
  if (!leadId && outcome.crmId) {
    const n = Number(outcome.crmId);
    if (Number.isInteger(n) && n > 0) leadId = n;
  }
  if (!leadId) {
    logger.warn("No Odoo lead matches Vendo result", {
      vendoId: outcome.vendoId,
      integrationId: outcome.odooLeadId,
      appointmentId: outcome.appointmentId,
      crmId: outcome.crmId,
    });
    return null;
  }

  // Current values we need for append (description) and fill-if-empty (contact) semantics.
  const current = (
    await odoo.searchRead<{
      id: number;
      contact_name?: string | false;
      email_from?: string | false;
      phone?: string | false;
      description?: string | false;
    }>(
      "crm.lead",
      [["id", "=", leadId]],
      ["contact_name", "email_from", "phone", "description"],
      1
    )
  )[0];
  const isEmpty = (v: unknown): boolean =>
    v === undefined || v === null || v === false || v === "";

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
  if (outcome.quoteId) vals.x_vendo_quote_id = outcome.quoteId;
  if (outcome.installationNotesUrl) vals.x_vendo_installation_notes_url = outcome.installationNotesUrl;

  if (stageName) {
    const stageId = await odoo.stageIdByName(stageName);
    if (stageId) vals.stage_id = stageId;
  }

  // Salesperson = the Vendo rep who ran the appointment (matched by seller email).
  if (outcome.sellerEmail) {
    const userId = await odoo.findUserIdByEmail(outcome.sellerEmail);
    if (userId) vals.user_id = userId;
    else logger.warn("No Odoo user matches Vendo seller email", { sellerEmail: outcome.sellerEmail });
  }

  // Append the appointment note to the lead description (never overwrite).
  if (outcome.note) {
    const existing = typeof current?.description === "string" ? current.description : "";
    vals.description = existing ? `${existing}\n${outcome.note}` : outcome.note;
  }

  // Fill contact fields only when the lead currently has none.
  if (outcome.contactName && isEmpty(current?.contact_name)) vals.contact_name = outcome.contactName;
  if (outcome.email && isEmpty(current?.email_from)) vals.email_from = outcome.email;
  if (outcome.phone && isEmpty(current?.phone)) vals.phone = outcome.phone;

  if (Object.keys(vals).length === 0) {
    logger.debug("Nothing to update for outcome", { outcome });
    return leadId;
  }

  await odoo.write("crm.lead", [leadId], vals);
  logger.info("vendoToOdoo done", {
    leadId,
    result: outcome.result,
    amount: outcome.amount,
    salesperson: vals.user_id,
  });
  return leadId;
}
