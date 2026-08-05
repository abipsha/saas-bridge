import { terros } from "../clients/terros";
import { logger } from "../core/logger";

/**
 * Workflow 4 (optional) — reflect an Odoo outcome back to the Terros account.
 * Trigger from an Odoo Automation Rule (server action → webhook) that POSTs to
 * /webhooks/odoo when a lead reaches Won/Lost.
 *
 * Terros advances an account by workflow stage. Map your Odoo stage names to the
 * matching Terros workflow stage NAMES (Update Account accepts workflowStageName).
 */
const ODOO_STAGE_TO_TERROS_STAGE_NAME: Record<string, string> = {
  // Won: "Sold",
  // Lost: "Not Interested",
};

export async function odooToTerros(terrosAccountId: string, odooStage: string): Promise<void> {
  const workflowStageName = ODOO_STAGE_TO_TERROS_STAGE_NAME[odooStage];
  if (!workflowStageName) {
    logger.debug("No Terros stage mapping for Odoo stage; skipping", { odooStage });
    return;
  }
  await terros.updateAccount({ accountId: terrosAccountId, workflowStageName });
  logger.info("odooToTerros done", { terrosAccountId, workflowStageName });
}
