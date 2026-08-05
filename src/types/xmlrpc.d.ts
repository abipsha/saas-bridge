/** Minimal ambient types for the `xmlrpc` package (ships no types of its own). */
declare module "xmlrpc" {
  export interface Client {
    methodCall(
      method: string,
      params: unknown[],
      callback: (error: unknown, value: unknown) => void
    ): void;
  }
  export interface ClientOptions {
    url: string;
    headers?: Record<string, string>;
  }
  export function createClient(options: ClientOptions): Client;
  export function createSecureClient(options: ClientOptions): Client;
  const _default: {
    createClient: typeof createClient;
    createSecureClient: typeof createSecureClient;
  };
  export default _default;
}
