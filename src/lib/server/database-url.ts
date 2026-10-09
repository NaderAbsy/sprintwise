/**
 * pg treats sslmode=require (and prefer, verify-ca) as verify-full today, but warns on every cold
 * start that its next major version will weaken them to libpq's meaning (encrypted, server not
 * checked). Asking for verify-full outright keeps today's check, silences the warning, and survives
 * that upgrade. Neon's certificates are publicly trusted, so verify-full needs no extra setup.
 */
export function withVerifiedSsl(url: string | undefined): string | undefined {
  return url?.replace(/([?&]sslmode=)(?:require|prefer|verify-ca)(?=&|$)/i, "$1verify-full");
}
