/**
 * Which brain Chichi uses, and a simple "ask once" helper used by file
 * summaries and the morning note.
 *
 *   ANTHROPIC_API_KEY set  -> Claude (ANTHROPIC_MODEL, default claude-opus-5-5)
 *   GEMINI_API_KEY set     -> Gemini (GEMINI_MODEL)
 *   both set               -> Claude first, Gemini as backup if Claude fails
 *   AI_PROVIDER=gemini     -> force Gemini even when both keys exist
 */
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI } from "@google/genai";

export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5-5";
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
export const GEMINI_FALLBACK = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.5-flash-lite";

export type Brain = "claude" | "gemini";

export function brains(): Brain[] {
  const out: Brain[] = [];
  const hasClaude = !!process.env.ANTHROPIC_API_KEY;
  const hasGemini = !!process.env.GEMINI_API_KEY;
  if (process.env.AI_PROVIDER === "gemini") {
    if (hasGemini) out.push("gemini");
    if (hasClaude) out.push("claude");
  } else {
    if (hasClaude) out.push("claude");
    if (hasGemini) out.push("gemini");
  }
  return out;
}

export function brainLabel(): string | null {
  const b = brains()[0];
  if (!b) return null;
  return b === "claude" ? prettyClaude(CLAUDE_MODEL) : `Gemini (${GEMINI_MODEL})`;
}

export function prettyClaude(id: string) {
  const m = id.match(/claude-(opus|sonnet|haiku|fable)-(\d+)-?(\d+)?/);
  if (!m) return id;
  return `Claude ${m[1][0].toUpperCase()}${m[1].slice(1)} ${m[2]}${m[3] ? "." + m[3] : ""}`;
}

let claudeClient: Anthropic | null = null;
export function claude() {
  if (!claudeClient) claudeClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2, timeout: 120_000 });
  return claudeClient;
}

export function gemini() {
  const baseUrl = process.env.GEMINI_BASE_URL; // only for local testing
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, ...(baseUrl ? { httpOptions: { baseUrl } } : {}) });
}

export type FileIn = { mime: string; data: string /* base64 */ };
export type PartIn = { text?: string; file?: FileIn };

function claudeBlocks(parts: PartIn[]): Anthropic.ContentBlockParam[] {
  const out: Anthropic.ContentBlockParam[] = [];
  for (const p of parts) {
    if (p.file) {
      const { mime, data } = p.file;
      if (mime === "application/pdf") out.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
      else if (mime === "text/plain") out.push({ type: "text", text: Buffer.from(data, "base64").toString("utf8").slice(0, 200_000) });
      else if (/^image\/(png|jpeg|webp|gif)$/.test(mime))
        out.push({ type: "image", source: { type: "base64", media_type: mime as "image/png", data } });
    }
    if (p.text) out.push({ type: "text", text: p.text });
  }
  return out;
}

/** One question, one answer. Tries every configured brain in order. */
export async function askOnce(parts: PartIn[], opts: { json?: boolean; maxTokens?: number; temperature?: number } = {}): Promise<string> {
  let last: unknown = new Error("Chichi's brain isn't plugged in yet");
  for (const b of brains()) {
    try {
      if (b === "claude") {
        const res = await claude().messages.create({
          model: CLAUDE_MODEL,
          max_tokens: opts.maxTokens ?? 4096,
          messages: [{ role: "user", content: claudeBlocks(parts) }],
        });
        const text = res.content
          .filter((c): c is Anthropic.TextBlock => c.type === "text")
          .map((c) => c.text)
          .join("\n")
          .trim();
        if (text) return text;
        continue;
      }
      const ai = gemini();
      for (const model of [GEMINI_MODEL, GEMINI_FALLBACK]) {
        try {
          const res = await ai.models.generateContent({
            model,
            contents: [{ role: "user", parts: parts.map((p) => (p.file ? { inlineData: { mimeType: p.file.mime, data: p.file.data } } : { text: p.text ?? "" })) }],
            config: { temperature: opts.temperature ?? 0.5, maxOutputTokens: opts.maxTokens ?? 4096, ...(opts.json ? { responseMimeType: "application/json" } : {}) },
          });
          const text = (res.text ?? "").trim();
          if (text) return text;
        } catch (e) {
          last = e;
          if (!/not.?found|404|no longer available|not supported/i.test(String((e as Error).message))) break;
        }
      }
    } catch (e) {
      last = e;
      console.error(`[llm] ${b}`, (e as Error).message);
    }
  }
  throw last instanceof Error ? last : new Error("Chichi couldn't answer");
}
