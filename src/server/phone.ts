/**
 * Real phone calls and SMS for SOS, through Twilio (a web app can't dial by
 * itself). Needs in .env:
 *   TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (+1..., a Twilio number)
 * Without them SOS still works (push + email + live page), it just can't ring
 * normal phone numbers.
 */

export function phoneReady() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

/**
 * Turn local numbers into international ones.
 * 01x... (Malaysia mobile) -> +601x..., 08... (Indonesia mobile) -> +628...
 */
export function toIntl(raw: string): string | null {
  const s = raw.trim().replace(/[^\d+]/g, "");
  if (!s) return null;
  let out: string;
  if (s.startsWith("+")) out = s;
  else if (s.startsWith("00")) out = "+" + s.slice(2);
  else if (s.startsWith("60") || s.startsWith("62")) out = "+" + s;
  else if (s.startsWith("01")) out = "+60" + s.slice(1);
  else if (s.startsWith("08")) out = "+62" + s.slice(1);
  else if (s.startsWith("0")) out = "+" + (process.env.SOS_DEFAULT_CC || "60") + s.slice(1);
  else out = "+" + s;
  return /^\+\d{8,15}$/.test(out) ? out : null;
}

/** Show a number without giving all of it away: +60 17*****768 */
export function maskPhone(n: string) {
  const d = n.replace(/[^\d+]/g, "");
  if (d.length < 7) return d;
  return d.slice(0, 5) + "*".repeat(Math.max(2, d.length - 8)) + d.slice(-3);
}

const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);

async function twilio(path: string, form: Record<string, string>) {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const base = process.env.TWILIO_BASE_URL || "https://api.twilio.com";
  const res = await fetch(`${base}/2010-04-01/Accounts/${sid}/${path}`, {
    method: "POST",
    headers: {
      authorization: "Basic " + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64"),
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(form),
    signal: AbortSignal.timeout(15_000),
  });
  const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string; code?: number };
  if (!res.ok) throw new Error(data.message || `Twilio ${res.status}`);
  return data;
}

/** Ring a phone and say the message out loud, 3 times. */
export async function callWithMessage(to: string, message: string) {
  const twiml = `<Response><Pause length="1"/><Say language="en-US" loop="3">${esc(message)}</Say></Response>`;
  const d = await twilio("Calls.json", { To: to, From: process.env.TWILIO_FROM!, Twiml: twiml, Timeout: "40" });
  return d.sid ?? "";
}

export async function sendSms(to: string, body: string) {
  const d = await twilio("Messages.json", { To: to, From: process.env.TWILIO_FROM!, Body: body.slice(0, 600) });
  return d.sid ?? "";
}
