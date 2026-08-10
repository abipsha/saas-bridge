import { config } from "../config";
import type {
  TerrosAccount,
  TerrosPerson,
  OdooLeadVals,
  VendoAppointmentRequest,
  VendoResultPayload,
  VendoOutcome,
} from "../core/types";

/** Terros rep email → Odoo salesperson (res.users) id. Fill from your roster. */
const REP_MAP: Record<string, number> = {
  // "jane.canvasser@yourco.com": 7,
};

function personName(p?: TerrosPerson): string {
  if (!p) return "";
  if (p.name) return p.name;
  return [p.firstName, p.lastName].filter(Boolean).join(" ").trim();
}

/** Convert epoch-ms to Odoo's naive-UTC datetime string "YYYY-MM-DD HH:MM:SS". */
export function epochMsToOdooDatetime(ms: number): string {
  return new Date(ms).toISOString().replace("T", " ").slice(0, 19);
}

/** Terros Account -> Odoo crm.lead values. */
export function terrosAccountToLead(a: TerrosAccount): OdooLeadVals {
  const customer = a.resident ?? a.homeowner ?? a.resident2;
  const displayName = personName(customer) || a.accountSource || "Unknown prospect";
  const street = a.location?.line1;

  const vals: OdooLeadVals = {
    name: street ? `${displayName} — ${street}` : displayName,
    x_terros_account_id: a.accountId,
  };
  const contact = personName(customer);
  if (contact) vals.contact_name = contact;
  if (customer?.email) vals.email_from = customer.email;
  if (customer?.phone) vals.phone = customer.phone;
  if (a.location?.line1) vals.street = a.location.line1;
  if (a.location?.locality) vals.city = a.location.locality;
  if (a.location?.postal1) vals.zip = a.location.postal1;
  if (typeof a.appointmentDate === "number") {
    vals.x_appointment_datetime = epochMsToOdooDatetime(a.appointmentDate);
  }

  const repEmail = a.owner?.email?.toLowerCase();
  const userId = repEmail ? REP_MAP[repEmail] : undefined;
  vals.user_id = userId ?? config.odoo.fallbackUserId;
  return vals;
}

function splitName(full?: string): { first?: string; last?: string } {
  const s = (full ?? "").trim();
  if (!s) return {};
  const parts = s.split(/\s+/);
  if (parts.length === 1) return { first: parts[0] };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/** Build a Vendo Create-Appointment request from an Odoo lead row. Uses the
 *  confirmed Public API param keys. We set appointment_integration_id to the
 *  Odoo lead id so it round-trips back on the Appointment Result webhook. */
export function leadToVendoAppointment(
  lead: Record<string, unknown>,
  sellerEmail: string,
  scheduleTime: string,
  duration = "30m"
): VendoAppointmentRequest {
  const { first, last } = splitName(
    (lead.contact_name as string) || (lead.name as string) || undefined
  );
  const req: VendoAppointmentRequest = {
    duration,
    schedule_time: scheduleTime,
    seller_email: sellerEmail,
    appointment_integration_id: String(lead.id),
  };
  if (first) req.customer_first_name = first;
  if (last) req.customer_last_name = last;
  if (lead.email_from) req.customer_email = String(lead.email_from);
  if (lead.phone) req.customer_phone = String(lead.phone);
  if (lead.street) req.address1 = String(lead.street);
  if (lead.city) req.city = String(lead.city);
  if (lead.zip) req.postal_code = String(lead.zip);
  return req;
}

/** Normalize a Vendo Appointment Result webhook body into our outcome shape.
 *  Matches back to Odoo via integration_id (the lead id we set at booking). */
export function vendoResultToOutcome(body: VendoResultPayload): VendoOutcome {
  // integration_id is our Odoo lead id ONLY when the bot booked the appointment
  // (we set it to the numeric lead id). Vendo-native appointments send a UUID, so
  // guard the parse — a non-integer must fall through to the appointment_id match.
  const idNum = body.integration_id != null ? Number(body.integration_id) : NaN;
  const odooLeadId = Number.isInteger(idNum) && idNum > 0 ? idNum : undefined;
  const amount = typeof body.quote_price === "number" ? body.quote_price : undefined;

  const names = (body.result ?? []).map((r) => (r.name ?? "").trim().toLowerCase());
  let result: VendoOutcome["result"] = "unknown";
  if (names.some((n) => n === "sold")) {
    result = "won";
  } else if (names.length > 0 && names.every((n) => n.includes("not sold") || n.includes("dead") || n.includes("lost"))) {
    result = "lost";
  } else if (typeof amount === "number" && amount > 0) {
    result = "quoted";
  }

  const quote = body.quote_data?.[0];
  const quoteId = quote?.quote_ids?.[0] ?? quote?.quote_number;
  const installationNotesUrl = (body.proposal_pdf ?? []).find(
    (d) => (d.name ?? "").trim().toLowerCase() === "installation notes"
  )?.url;

  const outcome: VendoOutcome = { result };
  if (odooLeadId !== undefined) outcome.odooLeadId = odooLeadId;
  if (body.appointment_id !== undefined) outcome.appointmentId = String(body.appointment_id);
  if (body.lead_id) outcome.crmId = String(body.lead_id);
  if (amount !== undefined) outcome.amount = amount;
  if (quoteId) outcome.quoteId = String(quoteId);
  if (installationNotesUrl) outcome.installationNotesUrl = installationNotesUrl;
  if (body.note) outcome.note = String(body.note);
  if (body.seller_email) outcome.sellerEmail = String(body.seller_email);
  if (body.contact) outcome.contactName = String(body.contact);
  if (body.customer_email) outcome.email = String(body.customer_email);
  if (body.phonenumber) outcome.phone = String(body.phonenumber);
  return outcome;
}
