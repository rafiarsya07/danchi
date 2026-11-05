// Shared DB connection for CLI scripts (the app itself uses src/db).
import "dotenv/config";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/db/schema";

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing. Fill in your .env first.");
  process.exit(1);
}

export const sql = postgres(process.env.DATABASE_URL, { max: 1 });
export const db = drizzle(sql, { schema });
export { schema };
