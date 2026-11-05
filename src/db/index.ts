import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in.");
}

// Reuse one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { danchiSql?: ReturnType<typeof postgres> };
const sql = globalForDb.danchiSql ?? postgres(url, { max: 10 });
if (process.env.NODE_ENV !== "production") globalForDb.danchiSql = sql;

export const db = drizzle(sql, { schema });
export { schema };
