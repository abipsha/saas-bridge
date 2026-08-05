import { config } from "../config";
import { requestJson } from "./http";
import type { VendoAppointmentRequest, VendoAppointmentResponse } from "../core/types";

/**
 * Paradigm Vendo Public API client (Create / Get Appointment).
 *
 * Confirmed from the admin (Advanced Settings → Public API): auth is a
 * Public Key + Private Key pair, and the Create Appointment body uses the
 * param keys in VendoAppointmentRequest.
 *
 * NOT shown in the admin UI: the exact base URL and how the keys are
 * transmitted. We default to sending them as headers; confirm against
 * Paradigm's API doc and tweak `headers()` / `baseUrl` if needed.
 */
export class VendoClient {
  constructor(
    private readonly baseUrl = config.vendo.baseUrl,
    private readonly publicKey = config.vendo.publicKey,
    private readonly privateKey = config.vendo.privateKey
  ) {}

  private headers(): Record<string, string> {
    return {
      "Content-Type": "application/json",
      Accept: "application/json",
      // TODO confirm auth scheme with Paradigm (header names vs basic vs signature).
      "X-Public-Key": this.publicKey,
      "X-Private-Key": this.privateKey,
    };
  }

  async createAppointment(body: VendoAppointmentRequest): Promise<VendoAppointmentResponse> {
    return requestJson<VendoAppointmentResponse>(`${this.baseUrl}/appointments`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(body),
    });
  }

  async getAppointment(appointmentId: string): Promise<Record<string, unknown>> {
    return requestJson<Record<string, unknown>>(
      `${this.baseUrl}/appointments/${encodeURIComponent(appointmentId)}`,
      { headers: this.headers() }
    );
  }
}

export const vendo = new VendoClient();
