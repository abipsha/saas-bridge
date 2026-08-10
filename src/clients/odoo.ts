import xmlrpc from "xmlrpc";
import type { Client } from "xmlrpc";
import { config } from "../config";
import { logger } from "../core/logger";
import type { OdooLeadVals } from "../core/types";

type Domain = unknown[];

/**
 * Thin XML-RPC wrapper around Odoo's external API plus the CRM helpers this
 * bot needs. Auth is lazy: the first call authenticates and caches the uid.
 */
export class OdooClient {
  private uid: number | null = null;
  private readonly common: Client;
  private readonly object: Client;
  private readonly stageCache = new Map<string, number>();

  constructor(
    private readonly url = config.odoo.url,
    private readonly db = config.odoo.db,
    private readonly username = config.odoo.username,
    private readonly apiKey = config.odoo.apiKey
  ) {
    const make = url.startsWith("https")
      ? xmlrpc.createSecureClient
      : xmlrpc.createClient;
    this.common = make({ url: `${url}/xmlrpc/2/common` });
    this.object = make({ url: `${url}/xmlrpc/2/object` });
  }

  private call<T>(client: Client, method: string, params: unknown[]): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      client.methodCall(method, params, (err, value) => {
        if (err) reject(err);
        else resolve(value as T);
      });
    });
  }

  async authenticate(): Promise<number> {
    if (this.uid) return this.uid;
    const uid = await this.call<number | false>(this.common, "authenticate", [
      this.db,
      this.username,
      this.apiKey,
      {},
    ]);
    if (!uid) throw new Error("Odoo authentication failed — check ODOO_* credentials");
    this.uid = uid;
    logger.debug("Odoo authenticated", { uid });
    return uid;
  }

  private async execute<T>(
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown> = {}
  ): Promise<T> {
    const uid = await this.authenticate();
    return this.call<T>(this.object, "execute_kw", [
      this.db,
      uid,
      this.apiKey,
      model,
      method,
      args,
      kwargs,
    ]);
  }

  searchRead<T = Record<string, unknown>>(
    model: string,
    domain: Domain,
    fields: string[],
    limit = 80
  ): Promise<T[]> {
    return this.execute<T[]>(model, "search_read", [domain], { fields, limit });
  }

  create(model: string, vals: Record<string, unknown>): Promise<number> {
    return this.execute<number>(model, "create", [vals]);
  }

  write(model: string, ids: number[], vals: Record<string, unknown>): Promise<boolean> {
    return this.execute<boolean>(model, "write", [ids, vals]);
  }

  /** Resolve a crm.stage id by its name (cached). */
  async stageIdByName(name: string): Promise<number | undefined> {
    if (this.stageCache.has(name)) return this.stageCache.get(name);
    const rows = await this.searchRead<{ id: number }>(
      "crm.stage",
      [["name", "=", name]],
      ["id"],
      1
    );
    const id = rows[0]?.id;
    if (id) this.stageCache.set(name, id);
    else logger.warn("Odoo stage not found", { name });
    return id;
  }

  /** Resolve a res.users id by login/email — used to set the Salesperson. */
  async findUserIdByEmail(email?: string): Promise<number | null> {
    if (!email) return null;
    const rows = await this.searchRead<{ id: number }>(
      "res.users",
      ["|", ["login", "=ilike", email], ["email", "=ilike", email]],
      ["id"],
      1
    );
    return rows[0]?.id ?? null;
  }

  /** Find a lead id by one of our external-id custom fields. */
  async findLeadIdByExternal(field: string, value: string): Promise<number | null> {
    const rows = await this.searchRead<{ id: number }>(
      "crm.lead",
      [[field, "=", value]],
      ["id"],
      1
    );
    return rows[0]?.id ?? null;
  }

  /** Secondary match by email or phone to avoid creating a duplicate person. */
  async findLeadIdByContact(email?: string, phone?: string): Promise<number | null> {
    const or: Domain = [];
    if (email) or.push(["email_from", "=ilike", email]);
    if (phone) or.push(["phone", "=", phone]);
    if (or.length === 0) return null;
    const domain: Domain = or.length === 2 ? ["|", ...or] : or;
    const rows = await this.searchRead<{ id: number }>("crm.lead", domain, ["id"], 1);
    return rows[0]?.id ?? null;
  }

  /**
   * Idempotent upsert: match on x_terros_account_id first, then email/phone,
   * else create. Returns the lead id. Safe to call repeatedly (dedup-proof).
   */
  async upsertLeadByTerrosId(vals: OdooLeadVals): Promise<number> {
    let id: number | null = null;
    if (vals.x_terros_account_id) {
      id = await this.findLeadIdByExternal("x_terros_account_id", vals.x_terros_account_id);
    }
    if (!id) id = await this.findLeadIdByContact(vals.email_from, vals.phone);

    const record = vals as unknown as Record<string, unknown>;
    if (id) {
      await this.write("crm.lead", [id], record);
      logger.info("Odoo lead updated", { leadId: id, terros: vals.x_terros_account_id });
      return id;
    }
    const newId = await this.create("crm.lead", record);
    logger.info("Odoo lead created", { leadId: newId, terros: vals.x_terros_account_id });
    return newId;
  }
}

export const odoo = new OdooClient();
