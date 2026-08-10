/** Provider-agnostic domain types used across clients, mappers and workflows. */

/* ------------------------------------------------------------------ *
 * Terros — shapes taken from the real API (docs.terros.com).
 * An "Account" is a prospect. The customer/homeowner is `resident`,
 * the address is `location`, and the canvasser/rep is `owner`.
 * ------------------------------------------------------------------ */

export interface TerrosPerson {
  name?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  phone2?: string;
  businessName?: string;
}

export interface TerrosLocation {
  line1?: string; // street
  line2?: string;
  locality?: string; // city
  countrySubd?: string; // state / province (e.g. "CA")
  postal1?: string; // zip
  postal2?: string; // zip+4
  unitNbr?: string;
  oneLine?: string; // full formatted address
}

export interface TerrosUser {
  clientUserId?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
}

export interface TerrosAccount {
  accountId?: string;
  externalLeadId?: string; // we store the Odoo lead id here
  sourceId?: string;
  accountSource?: string;
  sourceStatus?: string;
  resident?: TerrosPerson;
  resident2?: TerrosPerson;
  homeowner?: TerrosPerson;
  location?: TerrosLocation;
  ownerId?: string;
  owner?: TerrosUser;
  closerId?: string;
  closer?: TerrosUser;
  appointmentDate?: number; // epoch milliseconds
  workflowStageId?: string;
  workflowStageName?: string;
  workflowActionId?: string;
  customFields?: Record<string, unknown>;
}

/** Envelope Terros POSTs to a registered webhook URL. */
export interface TerrosWebhookEnvelope {
  action: "add" | "update" | "remove";
  entity: string; // "Account"
  data: TerrosAccount & { id?: string }; // remove events carry only { id }
}

/* ------------------------------------------------------------------ *
 * Odoo
 * ------------------------------------------------------------------ */

/** Values we write to an Odoo crm.lead. Keys match Odoo field names. */
export interface OdooLeadVals {
  name: string;
  contact_name?: string;
  email_from?: string;
  phone?: string;
  street?: string;
  city?: string;
  zip?: string;
  user_id?: number;
  x_terros_account_id?: string;
  x_appointment_datetime?: string; // Odoo UTC datetime "YYYY-MM-DD HH:MM:SS"
  x_vendo_appointment_id?: string;
  x_vendo_quote_id?: string;
  x_vendo_installation_notes_url?: string;
  expected_revenue?: number;
  stage_id?: number;
}

/* ------------------------------------------------------------------ *
 * Paradigm Vendo — confirmed from the admin (Advanced Settings →
 * Public API + Webhooks). Create Appointment uses these exact param
 * keys; the Appointment Result webhook delivers the outcome payload.
 * ------------------------------------------------------------------ */

/** Body for Vendo's Create Appointment (Public API). Keys are the documented
 *  param keys shown in the Public API "Preview". */
export interface VendoAppointmentRequest {
  duration: string; // e.g. "30m"
  schedule_time: string; // ISO local, e.g. "2026-08-05T18:22:26.229"
  seller_email: string;
  appointment_integration_id: string; // our Odoo lead id (round-trips back on the result)
  customer_first_name?: string;
  customer_last_name?: string;
  customer_email?: string;
  customer_phone?: string;
  customer_integration_id?: string;
  address1?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  address_integration_id?: string;
}

export interface VendoAppointmentResponse {
  appointment_id?: number | string;
  [k: string]: unknown;
}

/** One product-line disposition inside the Appointment Result `result` array. */
export interface VendoResultLine {
  id?: string;
  name?: string; // "Sold" | "Not Sold" | "Dead" | ...
  catalog?: string; // "Windows" | "Doors" | ...
  reason_id?: string;
  reason_name?: string;
}

/** One document entry inside the Appointment Result `proposal_pdf` array. */
export interface VendoDocument {
  url?: string;
  name?: string; // "Installation Notes" | "Inspection Report" | "Contract1" | ...
}

/** One quote entry inside the Appointment Result `quote_data` array. */
export interface VendoQuoteData {
  quote_ids?: string[];
  quote_number?: string;
  [k: string]: unknown;
}

/**
 * The Appointment Result webhook body. Field names confirmed against the live
 * Vendo webhook (Advanced Settings → Webhooks → Preview).
 */
export interface VendoResultPayload {
  integration_id?: string; // Appointment "Integration ID" — our Odoo lead id IF we booked it (else a Vendo UUID)
  lead_id?: string; // Appointment "CRM ID"
  appointment_id?: number | string; // Appointment "ID"
  quote_price?: number;
  result?: VendoResultLine[]; // Appointment "Opportunity Results"
  proposal_url?: string;
  proposal_pdf?: VendoDocument[]; // Appointment "Documents"
  inspection_url?: string;
  contact?: string; // Customer "Full Name"
  customer_email?: string; // Customer "Email"
  phonenumber?: string;
  seller_email?: string; // Appointment "Seller Email" — used to set the Odoo salesperson
  notes?: string; // Appointment "Result Reason" (NOT the appointment notes)
  note?: string; // Appointment "Notes"
  quote_data?: VendoQuoteData[]; // Appointment "Quotes"
  [k: string]: unknown;
}

/** Normalized outcome we hand to the Odoo workflow. */
export interface VendoOutcome {
  odooLeadId?: number; // parsed from integration_id when numeric
  appointmentId?: string;
  crmId?: string; // Vendo "CRM ID" (lead_id) — alternate match key
  result: "quoted" | "won" | "lost" | "unknown";
  amount?: number;
  quoteId?: string;
  installationNotesUrl?: string;
  note?: string;
  sellerEmail?: string;
  contactName?: string;
  email?: string;
  phone?: string;
}
