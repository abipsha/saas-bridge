/**
 * Cron entry (Render Cron Job, every 5 min).
 * Finds Odoo leads that are Booked but not yet pushed to Vendo, and creates
 * the Vendo appointment for each. Idempotent — a lead that already has
 * x_vendo_appointment_id is skipped.
 *
 * Assumes an appointment datetime on the lead in the custom field
 * `x_appointment_datetime` (Odoo returns UTC "YYYY-MM-DD HH:MM:SS"). Adjust the
 * field name if you store it elsewhere (e.g. a calendar.event).
 */
import { odoo, OdooClient } from "../clients/odoo";
import { bookAppointment } from "../workflows/bookAppointment";
import { config } from "../config";
import { logger } from "../core/logger";

interface LeadRow {
  id: number;
  name?: string;
  contact_name?: string;
  email_from?: string | false;
  phone?: string | false;
  street?: string | false;
  city?: string | false;
  zip?: string | false;
  user_id?: [number, string] | false;
  x_vendo_appointment_id?: string | false;
  x_appointment_datetime?: string | false;
}

function odooDatetimeToIso(dt: string): string {
  // Odoo stores/returns naive UTC datetimes.
  return new Date(`${dt.replace(" ", "T")}Z`).toISOString();
}

async function userEmail(client: OdooClient, userId: number): Promise<string | null> {
  const rows = await client.searchRead<{ login?: string; email?: string }>(
    "res.users",
    [["id", "=", userId]],
    ["login", "email"],
    1
  );
  return rows[0]?.email || rows[0]?.login || null;
}

export async function run(): Promise<{ booked: number; skipped: number }> {
  const bookedStageId = await odoo.stageIdByName(config.odoo.stages.booked);
  if (!bookedStageId) {
    logger.error("Booked stage not found; aborting poll", { stage: config.odoo.stages.booked });
    return { booked: 0, skipped: 0 };
  }

  const leads = await odoo.searchRead<LeadRow>(
    "crm.lead",
    [
      ["stage_id", "=", bookedStageId],
      ["x_vendo_appointment_id", "=", false],
    ],
    [
      "id",
      "name",
      "contact_name",
      "email_from",
      "phone",
      "street",
      "city",
      "zip",
      "user_id",
      "x_appointment_datetime",
    ],
    100
  );

  logger.info("Poll found booked leads without Vendo appointment", { count: leads.length });

  let booked = 0;
  let skipped = 0;
  for (const lead of leads) {
    const when = lead.x_appointment_datetime;
    const uid = lead.user_id ? lead.user_id[0] : undefined;
    if (!when || !uid) {
      logger.warn("Lead missing appointment time or salesperson; skipping", { leadId: lead.id });
      skipped++;
      continue;
    }
    const email = await userEmail(odoo, uid);
    if (!email) {
      logger.warn("Could not resolve salesperson email; skipping", { leadId: lead.id, uid });
      skipped++;
      continue;
    }
    try {
      await bookAppointment(
        {
          id: lead.id,
          contact_name: lead.contact_name || undefined,
          name: lead.name || undefined,
          email_from: lead.email_from || undefined,
          phone: lead.phone || undefined,
          street: lead.street || undefined,
          city: lead.city || undefined,
          zip: lead.zip || undefined,
          x_vendo_appointment_id: lead.x_vendo_appointment_id || undefined,
        },
        email,
        odooDatetimeToIso(when)
      );
      booked++;
    } catch (err) {
      logger.error("Failed to book appointment", { leadId: lead.id, err: String(err) });
      skipped++;
    }
  }
  return { booked, skipped };
}

if (require.main === module) {
  run()
    .then((r) => {
      logger.info("Poll complete", r);
      process.exit(0);
    })
    .catch((err) => {
      logger.error("Poll failed", { err: String(err) });
      process.exit(1);
    });
}
