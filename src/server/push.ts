/**
 * Web Push (works on Android Chrome out of the box, and on iPhone once the
 * app is added to the Home Screen). Keys: `npm run vapid`.
 */
import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import * as schema from "../db/schema";
import type { Db } from "../db/types";

let configured: boolean | null = null;

export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  return (configured = true);
}

export type PushPayload = {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
  kind?: string;
  /** Buttons on the notification (Android shows up to 2) */
  actions?: { action: string; title: string }[];
  reminderId?: string;
  /** Safety timer id, for the "I'm safe" button */
  checkinId?: string;
  /** Quiet update (no sound/vibration), e.g. the pinned status */
  silent?: boolean;
  sticky?: boolean;
  /** Remove the notification with this tag instead of showing anything */
  clearTag?: string;
};

/** Sends to every saved device of the given users. Dead subscriptions are removed. */
export async function sendPush(db: Db, userIds: string[], payload: PushPayload): Promise<number> {
  if (!pushConfigured() || userIds.length === 0) return 0;
  const subs = await db.select().from(schema.pushSubscription).where(inArray(schema.pushSubscription.userId, userIds));
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          {
            TTL: payload.silent ? 60 * 30 : 60 * 60 * 6,
            urgency: payload.silent ? "low" : "high",
            topic: payload.tag?.slice(0, 32).replace(/[^A-Za-z0-9_-]/g, "") || undefined,
          },
        );
        sent++;
        await db.update(schema.pushSubscription).set({ lastOkAt: new Date() }).where(eq(schema.pushSubscription.id, s.id));
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await db.delete(schema.pushSubscription).where(eq(schema.pushSubscription.id, s.id));
        } else {
          console.error("[push] failed", code ?? "", (e as Error).message);
        }
      }
    }),
  );
  return sent;
}
