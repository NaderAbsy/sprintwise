import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Whether a cron route may run. Vercel Cron sends CRON_SECRET; on Vercel every
 * other caller is refused, and so is every call until CRON_SECRET is set.
 * Locally and in tests the routes run without one.
 */
export function cronAllowed(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return !process.env.VERCEL_ENV;
  // Compared in constant time.
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
