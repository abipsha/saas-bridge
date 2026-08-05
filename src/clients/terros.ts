import { config } from "../config";
import { requestJson } from "./http";
import type { TerrosAccount } from "../core/types";

/**
 * Terros REST client. Confirmed against docs.terros.com:
 *   Base URL: https://api.terros.com
 *   Auth:     Authorization: ApiKey <KEY>
 *   Endpoints used here: POST /account/update, /account/match, /account/upsert
 */
export class TerrosClient {
  constructor(
    private readonly baseUrl = config.terros.baseUrl,
    private readonly apiKey = config.terros.apiKey
  ) {}

  private headers(): Record<string, string> {
    return {
      Authorization: `ApiKey ${this.apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
  }

  /** Find an account by cascading criteria (accountId → externalLeadId → sourceId → address). */
  async matchAccount(criteria: {
    accountId?: string;
    externalLeadId?: string;
    sourceId?: string;
    address?: string;
  }): Promise<{ account?: TerrosAccount } & Record<string, unknown>> {
    return requestJson(`${this.baseUrl}/account/match`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(criteria),
    });
  }

  /** Update an existing account (identified by accountId). */
  async updateAccount(account: Partial<TerrosAccount> & { accountId: string }): Promise<unknown> {
    return requestJson(`${this.baseUrl}/account/update`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ account }),
    });
  }

  /**
   * Create-or-update by data. requestType: 'add' errors if it exists,
   * 'update' errors if it doesn't, 'upsert' (default) does either.
   */
  async upsertAccount(
    account: Partial<TerrosAccount>,
    requestType: "add" | "update" | "upsert" = "upsert"
  ): Promise<unknown> {
    return requestJson(`${this.baseUrl}/account/upsert`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ account: { ...account, requestType } }),
    });
  }
}

export const terros = new TerrosClient();
