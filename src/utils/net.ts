/** Network utilities (v0.46). */

/** True when a host only listens on the local machine (no auth needed). */
export function isLoopbackHost(host: string): boolean {
  return host === "127.0.0.1" || host === "localhost" || host === "::1";
}
