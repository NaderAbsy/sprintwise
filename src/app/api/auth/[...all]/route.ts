import { toNextJsHandler } from "better-auth/next-js";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/server/auth";
import { recordSecurityEvent } from "@/lib/server/security-events";

const handler = toNextJsHandler(auth);

/** Counts refusals for the owner's Insights page: a total per day, never who or what (see security-events.ts). */
async function counted(run: (request: NextRequest) => Promise<Response>, request: NextRequest) {
  const response = await run(request);
  if (response.status === 429) await recordSecurityEvent("auth_limited");
  else if (response.status === 403) await recordSecurityEvent("auth_refused");
  return response;
}

export const GET = (request: NextRequest) => counted(handler.GET, request);
export const POST = (request: NextRequest) => counted(handler.POST, request);
