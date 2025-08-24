import { PrismaClient } from "../generated/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export { Prisma, PrismaClient } from "../generated/client";

export type {
  $Enums,
  Account,
  AudioChunk,
  AudioChunkStatus,
  AudioFile,
  AudioFileStatus,
  Credits,
  Session,
  Speaker,
  User,
  Verification,
} from "../generated/client";
