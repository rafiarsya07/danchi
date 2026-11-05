/** Their real names, from the database (each of them can change it in Settings). */
import * as schema from "../db/schema";
import type { Db } from "../db/types";

export async function getNames(db: Db): Promise<{ owner: string; viewer: string }> {
  const users = await db.select({ name: schema.user.name, role: schema.user.role }).from(schema.user);
  return {
    owner: users.find((u) => u.role === "owner")?.name || process.env.DANCHI_OWNER_NAME || "Adis",
    viewer: users.find((u) => u.role === "viewer")?.name || process.env.DANCHI_VIEWER_NAME || "Rafi",
  };
}
