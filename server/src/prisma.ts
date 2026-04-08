import "dotenv/config";
import { PrismaClient } from "@prisma/client";

if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required in production");
}

export const prisma = new PrismaClient();
