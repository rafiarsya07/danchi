import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type * as schema from "./schema";

/** The Drizzle database, shared by the app (src/db) and the worker (scripts/db). */
export type Db = PostgresJsDatabase<typeof schema>;
