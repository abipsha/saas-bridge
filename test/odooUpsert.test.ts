import { describe, it, expect, vi, beforeEach } from "vitest";
import { OdooClient } from "../src/clients/odoo";
import type { OdooLeadVals } from "../src/core/types";

/**
 * Exercises the upsert/dedup decision logic without touching the network by
 * stubbing the lookup + write/create methods. (Constructing OdooClient just
 * builds XML-RPC client objects; it does not connect.)
 */
describe("OdooClient.upsertLeadByTerrosId", () => {
  let client: OdooClient;
  const vals: OdooLeadVals = {
    name: "Jane Doe — 123 Main St",
    x_terros_account_id: "T-1",
    email_from: "jane@example.com",
    phone: "555-0100",
  };

  beforeEach(() => {
    client = new OdooClient("http://odoo.test", "db", "u", "k");
  });

  it("updates the existing lead when the Terros id already exists", async () => {
    vi.spyOn(client, "findLeadIdByExternal").mockResolvedValue(5);
    const byContact = vi.spyOn(client, "findLeadIdByContact");
    const write = vi.spyOn(client, "write").mockResolvedValue(true);
    const create = vi.spyOn(client, "create").mockResolvedValue(999);

    const id = await client.upsertLeadByTerrosId(vals);

    expect(id).toBe(5);
    expect(byContact).not.toHaveBeenCalled();
    expect(write).toHaveBeenCalledWith("crm.lead", [5], expect.objectContaining({ x_terros_account_id: "T-1" }));
    expect(create).not.toHaveBeenCalled();
  });

  it("falls back to email/phone match before creating", async () => {
    vi.spyOn(client, "findLeadIdByExternal").mockResolvedValue(null);
    vi.spyOn(client, "findLeadIdByContact").mockResolvedValue(8);
    const write = vi.spyOn(client, "write").mockResolvedValue(true);
    const create = vi.spyOn(client, "create").mockResolvedValue(999);

    const id = await client.upsertLeadByTerrosId(vals);

    expect(id).toBe(8);
    expect(write).toHaveBeenCalledWith("crm.lead", [8], expect.anything());
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a new lead when nothing matches", async () => {
    vi.spyOn(client, "findLeadIdByExternal").mockResolvedValue(null);
    vi.spyOn(client, "findLeadIdByContact").mockResolvedValue(null);
    const write = vi.spyOn(client, "write").mockResolvedValue(true);
    const create = vi.spyOn(client, "create").mockResolvedValue(42);

    const id = await client.upsertLeadByTerrosId(vals);

    expect(id).toBe(42);
    expect(create).toHaveBeenCalledWith("crm.lead", expect.objectContaining({ x_terros_account_id: "T-1" }));
    expect(write).not.toHaveBeenCalled();
  });
});
