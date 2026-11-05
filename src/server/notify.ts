/**
 * One place that tells someone something: saves it to the in-app inbox,
 * pushes it to their devices, and emails it when asked. Used by the app and
 * by the worker.
 *
 * Who hears it:
 *   audience "both"   (default) owner + viewer. Her reminders only reach the
 *                     viewer when she allows it (settings.shareReminders).
 *   audience "owner"  just her. Private things (cycle, mood, sign in alerts).
 *   audience "viewer" just Rafi. Safety check ins, love note reactions.
 * Quiet hours make pushes silent, except `urgent` ones (safety).
 */
import { eq } from "drizzle-orm";
import * as schema from "../db/schema";
import type { Db } from "../db/types";
import { sendPush, type PushPayload } from "./push";
import { sendMail } from "./mail";
import { localParts } from "../lib/time";

export type NotifyKind =
  | "reminder"
  | "digest"
  | "nudge"
  | "low"
  | "test"
  | "info"
  | "safety"
  | "love"
  | "mood"
  | "cycle"
  | "security"
  | "paper";

export type NotifyInput = {
  ownerId: string;
  kind: NotifyKind;
  title: string;
  body?: string;
  url?: string;
  audience?: "both" | "owner" | "viewer";
  /** Push to exactly these users instead of the audience. */
  pushUserIds?: string[];
  push?: boolean;
  email?: { subject: string; html: string; text: string } | null;
  /** Who gets the email. Default: the owner (or MAIL_TO). */
  emailTo?: "owner" | "viewer" | "both";
  /** Skip the inbox row (for tests and private things) */
  inbox?: boolean;
  /** Rings even in quiet hours */
  urgent?: boolean;
  /** Ask phones to remove the notification with pushExtra.tag instead of showing one */
  clear?: boolean;
  /** Extra push options: action buttons, quiet/sticky */
  pushExtra?: Pick<PushPayload, "actions" | "reminderId" | "checkinId" | "silent" | "sticky" | "tag">;
};

const SHARED_KINDS = new Set(["reminder", "digest", "nudge", "low", "paper"]);

export function inQuietHours(hour: number, from: number, to: number) {
  if (from < 0 || to < 0 || from === to) return false;
  return from < to ? hour >= from && hour < to : hour >= from || hour < to;
}

async function people(db: Db, ownerId: string) {
  const users = await db.select({ id: schema.user.id, role: schema.user.role, email: schema.user.email }).from(schema.user);
  const owner = users.find((u) => u.id === ownerId);
  const viewers = users.filter((u) => u.role === "viewer");
  return { owner, viewers };
}

export async function notify(db: Db, n: NotifyInput) {
  const [s] = await db.select().from(schema.settings).where(eq(schema.settings.ownerId, n.ownerId)).limit(1);
  const { owner, viewers } = await people(db, n.ownerId);

  let audience = n.audience ?? "both";
  if (audience === "both" && SHARED_KINDS.has(n.kind) && s && !s.shareReminders) audience = "owner";

  if (n.inbox !== false) {
    await db.insert(schema.notification).values({
      ownerId: n.ownerId,
      kind: n.kind,
      title: n.title,
      body: n.body ?? null,
      url: n.url ?? null,
    });
  }

  const quiet = !n.urgent && s ? inQuietHours(localParts(new Date()).hour, s.quietFrom, s.quietTo) : false;

  let pushed = 0;
  if (n.push !== false) {
    const userIds =
      n.pushUserIds ??
      [
        ...(audience !== "viewer" && owner ? [owner.id] : []),
        ...(audience !== "owner" ? viewers.map((v) => v.id) : []),
      ];
    pushed = await sendPush(db, userIds, {
      title: n.title,
      body: n.body,
      url: n.url ?? "/",
      tag: `${n.kind}-${Date.now()}`,
      kind: n.kind,
      ...n.pushExtra,
      ...(quiet ? { silent: true } : {}),
      ...(n.clear ? { clearTag: n.pushExtra?.tag } : {}),
    });
  }

  let mailed = false;
  if (n.email) {
    const to = new Set<string>();
    const who = n.emailTo ?? "owner";
    if (who !== "viewer") {
      const t = process.env.MAIL_TO || owner?.email;
      if (t) to.add(t);
    }
    if (who !== "owner") viewers.forEach((v) => to.add(v.email));
    for (const addr of to) mailed = (await sendMail(addr, n.email.subject, n.email.html, n.email.text)) || mailed;
  }
  return { pushed, mailed };
}
