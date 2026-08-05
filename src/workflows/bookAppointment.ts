import { odoo } from "../clients/odoo";
import { vendo } from "../clients/vendo";
import { leadToVendoAppointment } from "../mappers/leadMapper";
import { config } from "../config";
import { logger } from "../core/logger";

interface BookableLead {
  id: number;
  contact_name?: string;
  name?: string;
  email_from?: string;
  phone?: string;
  street?: string;
  city?: string;
  zip?: string;
  x_vendo_appointment_id?: string | false;
}

/**
 * Workflow 2 — appointment creation.
 * Given a booked Odoo lead, create the appointment in Vendo and stamp the
 * returned appointment id back onto the lead (so it is never booked twice).
 */
export async function bookAppointment(
  lead: BookableLead,
  sellerEmail: string,
  scheduleTime: string,
  duration = "30m"
): Promise<string | null> {
  if (lead.x_vendo_appointment_id) {
    logger.debug("Lead already has a Vendo appointment; skipping", { leadId: lead.id });
    return String(lead.x_vendo_appointment_id);
  }

  const req = leadToVendoAppointment(
    lead as unknown as Record<string, unknown>,
    sellerEmail,
    scheduleTime,
    duration
  );
  const res = await vendo.createAppointment(req);
  const appointmentId = res.appointment_id !== undefined ? String(res.appointment_id) : "";

  const vals: Record<string, unknown> = {};
  if (appointmentId) vals.x_vendo_appointment_id = appointmentId;
  const bookedStage = await odoo.stageIdByName(config.odoo.stages.booked);
  if (bookedStage) vals.stage_id = bookedStage;

  await odoo.write("crm.lead", [lead.id], vals);
  logger.info("bookAppointment done", { leadId: lead.id, appointmentId });
  return appointmentId || null;
}
