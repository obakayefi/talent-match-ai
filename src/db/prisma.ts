import { PrismaClient } from "@/generated/prisma";
import { environment } from "@/config/env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: environment.DATABASE_URL });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
