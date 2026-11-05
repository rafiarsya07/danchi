/**
 * Email through any SMTP server (Gmail app password, Resend, Brevo...).
 * Nothing is sent when SMTP_HOST is empty.
 */
import nodemailer, { type Transporter } from "nodemailer";

let transport: Transporter | null | undefined;

export function mailConfigured(): boolean {
  return !!process.env.SMTP_HOST && !!process.env.MAIL_FROM;
}

function getTransport(): Transporter | null {
  if (transport !== undefined) return transport;
  if (!mailConfigured()) return (transport = null);
  const port = Number(process.env.SMTP_PORT || 465);
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

export async function sendMail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const t = getTransport();
  if (!t) return false;
  try {
    await t.sendMail({ from: process.env.MAIL_FROM, to, subject, html, text });
    return true;
  } catch (e) {
    console.error("[mail] failed", (e as Error).message);
    return false;
  }
}

export function appUrl(path = "/"): string {
  const base = (process.env.APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "");
  return base + path;
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export type MailBlock = { heading?: string; emoji?: string; lines: string[]; big?: boolean };

/** A small, cute, email-client-safe layout (tables + inline styles only). */
export function mailLayout(opts: {
  mood: "remind" | "wave" | "cheer" | "worried" | "happy" | "love";
  title: string;
  intro?: string;
  blocks?: MailBlock[];
  cta?: { label: string; path: string };
}): string {
  const mascot = appUrl(`/mascot/${opts.mood}.png`);
  const blocks = (opts.blocks ?? [])
    .filter((b) => b.lines.length)
    .map(
      (b) => `
      <tr><td style="padding:6px 0 0">
        ${b.heading ? `<div style="font:800 15px/1.3 Nunito,Arial,sans-serif;color:#2E2240;margin:10px 0 6px">${b.emoji ?? ""} ${esc(b.heading)}</div>` : ""}
        ${b.lines
          .map(
            (l) =>
              `<div style="font:${b.big ? "800 34px/1.2 Fredoka,Nunito,Arial,sans-serif;text-align:center;letter-spacing:6px" : "700 15px/1.4 Nunito,Arial,sans-serif"};color:#2E2240;background:#ffffff;border:2px solid #2E2240;border-radius:14px;padding:9px 12px;margin:0 0 6px">${esc(l)}</div>`,
          )
          .join("")}
      </td></tr>`,
    )
    .join("");
  const cta = opts.cta
    ? `<tr><td align="center" style="padding:18px 0 4px">
        <a href="${appUrl(opts.cta.path)}" style="display:inline-block;background:#FFD95A;color:#2E2240;border:2.5px solid #2E2240;border-radius:16px;padding:12px 22px;font:800 16px Nunito,Arial,sans-serif;text-decoration:none;box-shadow:0 4px 0 #2E2240">${esc(opts.cta.label)}</a>
      </td></tr>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#FFF8F0;padding:24px 12px">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:460px;background:#FFE1CF;border:2.5px solid #2E2240;border-radius:26px;padding:20px" cellpadding="0" cellspacing="0">
      <tr><td align="center"><img src="${mascot}" width="96" height="96" alt="Chichi" style="display:block"></td></tr>
      <tr><td align="center" style="font:700 24px/1.25 Fredoka,Nunito,Arial,sans-serif;color:#2E2240;padding:6px 0 2px">${esc(opts.title)}</td></tr>
      ${opts.intro ? `<tr><td align="center" style="font:700 15px/1.45 Nunito,Arial,sans-serif;color:#5C4E70;padding:2px 6px 8px">${esc(opts.intro)}</td></tr>` : ""}
      ${blocks}
      ${cta}
    </table>
    <div style="font:700 12px Nunito,Arial,sans-serif;color:#5C4E70;padding-top:14px">Sent with love by Chichi from Danchi 🌼🍑</div>
  </td></tr></table>
</body></html>`;
}
