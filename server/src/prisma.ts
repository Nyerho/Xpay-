import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const connectionString = (() => {
  const v = process.env.DATABASE_URL;
  if (v) return v;
  if (process.env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required in production");
  }
  return "file:./dev.db";
})();
const adapter = new PrismaBetterSqlite3({ url: connectionString });

export const prisma = new PrismaClient({ adapter });
