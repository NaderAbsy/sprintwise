import "server-only";

/**
 * What to write to the server log about a failure, without the data involved. Prisma's messages can quote the
 * story text being saved, so for its errors only the name and code are kept; other errors keep a short message.
 */
export function errorSummary(error: unknown): string {
  if (!(error instanceof Error)) return "Something that wasn't an Error was thrown.";
  const code = (error as { code?: unknown }).code;
  const named = typeof code === "string" ? `${error.name} ${code}` : error.name;
  const fromPrisma = error.name.startsWith("PrismaClient") || error.constructor?.name.startsWith("PrismaClient");
  return fromPrisma ? named : `${named}: ${error.message.slice(0, 200)}`;
}
