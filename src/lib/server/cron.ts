import "server-only";
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { isLocalServer } from "@/lib/server/local-server";

/**
 * Whether a cron route may run. Vercel Cron sends CRON_SECRET; on Vercel every
 * other caller is refused, and so is every call until CRON_SECRET is set. The
 * same goes for any server that isn't local: only a localhost development or
 * test server runs the routes without a secret.
 */
export function cronAllowed(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return !process.env.VERCEL_ENV && isLocalServer();
  // Compared in constant time.
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
