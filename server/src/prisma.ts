import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

if (process.env.NODE_ENV === "production" && !process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required in production");
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : undefined,
});

const adapter = new PrismaPg(pool);

export const prisma = new PrismaClient({ adapter });
