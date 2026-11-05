import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { mailLayout, sendMail } from "@/server/mail";
import { notify } from "@/server/notify";
import { describeDevice } from "@/lib/device";

/**
 * Only these Google accounts can ever get in. Everyone else is turned away
 * before a session exists. Set ALLOWED_EMAILS in .env (comma separated);
 * defaults to the owner + viewer emails.
 */
export function allowedEmails(): string[] {
  const raw = process.env.ALLOWED_EMAILS || [process.env.DANCHI_OWNER_EMAIL, process.env.DANCHI_VIEWER_EMAIL].filter(Boolean).join(",");
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}
export const isAllowed = (email?: string | null) => !!email && allowedEmails().includes(email.trim().toLowerCase());

export const googleConfigured = () => !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  appName: "Danchi",
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  // Main door: Google. Nobody can sign up; Google just unlocks the two existing accounts.
  socialProviders: googleConfigured()
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          disableSignUp: true,
          prompt: "select_account",
        },
      }
    : {},
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google"], allowDifferentEmails: false },
  },
  // Password login is off unless you turn it on for emergencies (ALLOW_PASSWORD_LOGIN=true).
  emailAndPassword: {
    enabled: process.env.ALLOW_PASSWORD_LOGIN === "true",
    disableSignUp: true,
    minPasswordLength: 8,
  },
  databaseHooks: {
    user: {
      create: {
        before: async (u) => (isAllowed(u.email) ? { data: u } : false),
      },
    },
    session: {
      create: {
        // Last line of defence: no session for anyone outside the allowlist.
        before: async (s) => {
          const [u] = await db.select({ email: schema.user.email }).from(schema.user).where(eq(schema.user.id, s.userId)).limit(1);
          return isAllowed(u?.email) ? { data: s } : false;
        },
        // "New sign in" heads up to the person who signed in, so nobody can quietly get in as them.
        after: async (s) => {
          void signInAlert(s).catch((e) => console.error("[signin alert]", e));
        },
      },
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", required: false, defaultValue: "viewer", input: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days when "keep me signed in"
    updateAge: 60 * 60 * 24,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
  },
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  plugins: [
    // "Email me a code" sign in. Only the two existing accounts can use it.
    emailOTP({
      disableSignUp: true,
      otpLength: 6,
      expiresIn: 10 * 60,
      allowedAttempts: 5,
      async sendVerificationOTP({ email, otp, type }) {
        if (type !== "sign-in" || !isAllowed(email)) return;
        await sendMail(
          email,
          `${otp} is your Danchi code 🍑`,
          mailLayout({
            mood: "love",
            title: "Your door code",
            intro: "Type this in Danchi to come in. It works for 10 minutes.",
            blocks: [{ lines: [otp], big: true }],
          }),
          `Your Danchi code: ${otp}\nIt works for 10 minutes. If you didn't ask for it, just ignore this email.`,
        );
      },
    }),
    nextCookies(),
  ],
});

export type Session = typeof auth.$Infer.Session;

async function signInAlert(s: { userId: string; userAgent?: string | null; ipAddress?: string | null }) {
  const [u] = await db.select().from(schema.user).where(eq(schema.user.id, s.userId)).limit(1);
  if (!u) return;
  const [owner] = await db.select({ id: schema.user.id }).from(schema.user).where(eq(schema.user.role, "owner")).limit(1);
  const device = describeDevice(s.userAgent);
  const when = new Date().toLocaleString("en-GB", { timeZone: process.env.APP_TIMEZONE || "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" });
  await notify(db, {
    ownerId: owner?.id ?? u.id,
    kind: "security",
    title: "New sign in to Danchi 🔐",
    body: `${device.label}, ${when}. Not you? Open Settings and sign that device out.`,
    url: "/settings#devices",
    pushUserIds: [u.id],
    inbox: false,
    urgent: true,
    emailTo: u.role === "owner" ? "owner" : "viewer",
    email: {
      subject: "New sign in to your Danchi 🔐",
      text: `Someone (hopefully you!) just signed in to Danchi.\n\nDevice: ${device.label}\nWhen: ${when}\n\nIf this wasn't you, open Danchi, go to Settings, Devices, and sign it out. Then tell Rafi.`,
      html: mailLayout({
        mood: "worried",
        title: "New sign in",
        intro: "Someone (hopefully you!) just signed in to Danchi. If this wasn't you, open Settings, Devices and sign it out.",
        blocks: [{ heading: "Details", emoji: "🔐", lines: [`Device: ${device.label}`, `When: ${when}`] }],
        cta: { label: "Check my devices", path: "/settings#devices" },
      }),
    },
  });
}
