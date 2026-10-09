import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { withVerifiedSsl } from "@/lib/server/database-url";

// One client per server process; dev hot reloads would otherwise open a new pool each time.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaPg({ connectionString: withVerifiedSsl(process.env.DATABASE_URL) }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
