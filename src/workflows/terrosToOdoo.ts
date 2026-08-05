import { odoo } from "../clients/odoo";
import { terrosAccountToLead } from "../mappers/leadMapper";
import { config } from "../config";
import { logger } from "../core/logger";
import type { TerrosAccount } from "../core/types";

/**
 * Workflow 1 — lead intake.
 * A Terros Account (add/update) becomes/updates an Odoo crm.lead.
 * Idempotent: repeated webhooks for the same account update one lead.
 */
export async function terrosToOdoo(account: TerrosAccount): Promise<number | null> {
  if (!account.accountId) {
    logger.warn("Terros account has no accountId; skipping", { account });
    return null;
  }
  const vals = terrosAccountToLead(account);

  // New leads start in the "New" stage; existing leads keep their stage.
  const existing = await odoo.findLeadIdByExternal("x_terros_account_id", account.accountId);
  if (!existing) {
    const stageId = await odoo.stageIdByName(config.odoo.stages.new);
    if (stageId) vals.stage_id = stageId;
  }

  const leadId = await odoo.upsertLeadByTerrosId(vals);
  logger.info("terrosToOdoo done", { terrosId: account.accountId, leadId });
  return leadId;
}
