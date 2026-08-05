import { describe, it, expect } from "vitest";
import {
  terrosAccountToLead,
  leadToVendoAppointment,
  vendoResultToOutcome,
  epochMsToOdooDatetime,
} from "../src/mappers/leadMapper";
import type { TerrosAccount } from "../src/core/types";

describe("terrosAccountToLead", () => {
  it("maps resident/location/owner from a real Terros account", () => {
    const acct: TerrosAccount = {
      accountId: "Account.T-1",
      resident: { firstName: "Jane", lastName: "Doe", email: "jane@example.com", phone: "555-0100" },
      location: { line1: "123 Main St", locality: "Austin", countrySubd: "TX", postal1: "78701" },
      owner: { email: "rep@yourco.com" },
      appointmentDate: Date.UTC(2026, 6, 12, 15, 30, 0),
    };
    const lead = terrosAccountToLead(acct);
    expect(lead.name).toBe("Jane Doe — 123 Main St");
    expect(lead.contact_name).toBe("Jane Doe");
    expect(lead.email_from).toBe("jane@example.com");
    expect(lead.phone).toBe("555-0100");
    expect(lead.street).toBe("123 Main St");
    expect(lead.city).toBe("Austin");
    expect(lead.zip).toBe("78701");
    expect(lead.x_terros_account_id).toBe("Account.T-1");
    expect(lead.x_appointment_datetime).toBe("2026-07-12 15:30:00");
  });

  it("uses the fallback salesperson id when the owner isn't mapped", () => {
    const lead = terrosAccountToLead({ accountId: "Account.T-2", resident: { name: "Acme Co" } });
    expect(lead.user_id).toBe(9); // ODOO_FALLBACK_USER_ID from vitest.config
  });

  it("falls back to accountSource for the name when there's no resident", () => {
    const lead = terrosAccountToLead({ accountId: "Account.T-3", accountSource: "Statra" });
    expect(lead.name).toBe("Statra");
    expect(lead.street).toBeUndefined();
  });

  it("degrades to 'Unknown prospect' when nothing identifies the account", () => {
    const lead = terrosAccountToLead({ accountId: "Account.T-4" });
    expect(lead.name).toBe("Unknown prospect");
    expect(lead.x_terros_account_id).toBe("Account.T-4");
  });
});

describe("epochMsToOdooDatetime", () => {
  it("formats epoch-ms as naive UTC 'YYYY-MM-DD HH:MM:SS'", () => {
    expect(epochMsToOdooDatetime(Date.UTC(2026, 0, 5, 9, 8, 7))).toBe("2026-01-05 09:08:07");
  });
});

describe("leadToVendoAppointment", () => {
  it("maps an Odoo lead to the confirmed Vendo param keys", () => {
    const req = leadToVendoAppointment(
      { id: 42, contact_name: "Jane Doe", email_from: "jane@x.com", phone: "555", street: "1 Main", city: "Austin", zip: "78701" },
      "rep@yourco.com",
      "2026-08-05T18:22:26.229",
      "60m"
    );
    expect(req.appointment_integration_id).toBe("42");
    expect(req.seller_email).toBe("rep@yourco.com");
    expect(req.schedule_time).toBe("2026-08-05T18:22:26.229");
    expect(req.duration).toBe("60m");
    expect(req.customer_first_name).toBe("Jane");
    expect(req.customer_last_name).toBe("Doe");
    expect(req.address1).toBe("1 Main");
    expect(req.postal_code).toBe("78701");
  });
});

describe("vendoResultToOutcome", () => {
  it("marks Sold as won, reads quote_price, and matches back the Odoo lead id", () => {
    const o = vendoResultToOutcome({
      integration_id: "42",
      appointment_id: 133,
      quote_price: 80697,
      result: [{ name: "Sold", catalog: "Windows" }],
    });
    expect(o.result).toBe("won");
    expect(o.odooLeadId).toBe(42);
    expect(o.appointmentId).toBe("133");
    expect(o.amount).toBe(80697);
  });

  it("marks all Not Sold / Dead as lost", () => {
    const o = vendoResultToOutcome({
      integration_id: "7",
      result: [{ name: "Not Sold" }, { name: "Dead" }],
    });
    expect(o.result).toBe("lost");
    expect(o.odooLeadId).toBe(7);
  });

  it("treats a priced result with no sale as quoted", () => {
    const o = vendoResultToOutcome({ integration_id: "9", quote_price: 5000, result: [] });
    expect(o.result).toBe("quoted");
    expect(o.amount).toBe(5000);
  });

  it("returns unknown when there's no result and no price", () => {
    const o = vendoResultToOutcome({ integration_id: "9" });
    expect(o.result).toBe("unknown");
  });
});
