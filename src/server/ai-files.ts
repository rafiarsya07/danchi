/**
 * Chichi reads her files: summarize lecture slides / PDFs, and turn them into
 * flashcards or practice questions. Claude or Gemini reads PDFs and images directly.
 */
import { askOnce, type PartIn } from "./llm";
import { readStored } from "./files";

export const READABLE = new Set(["application/pdf", "image/png", "image/jpeg", "image/webp", "text/plain"]);

const clean = (t: string) =>
  t
    .replace(/(\d)\s*[—–]\s*(\d)/g, "$1 to $2")
    .replace(/[—–·]/g, ",")
    .replace(/^\s*[-*]\s+/gm, "• ")
    .trim();

async function ask(parts: { text?: string; inlineData?: { mimeType: string; data: string } }[], json = false) {
  const p: PartIn[] = parts.map((x) => (x.inlineData ? { file: { mime: x.inlineData.mimeType, data: x.inlineData.data } } : { text: x.text }));
  return askOnce(p, { json, maxTokens: 4096, temperature: 0.4 });
}

async function filePart(storedName: string, mime: string) {
  const buf = await readStored(storedName);
  if (buf.length > 18 * 1024 * 1024) throw new Error("That file is too big for Chichi to read");
  return { inlineData: { mimeType: mime, data: buf.toString("base64") } };
}

export async function summarizeFile(f: { storedName: string; mime: string; name: string }) {
  const text = await ask([
    await filePart(f.storedName, f.mime),
    {
      text: `You are Chichi, a cute but smart study buddy. Summarize "${f.name}" for a university student revising for exams.
Write in English. Structure:
1. "In one sentence:" the big idea.
2. "Key points:" 5 to 10 short bullet points (use "• ").
3. "Words to remember:" key terms with a short meaning each.
4. "Might come out in the exam:" 3 likely questions.
Never use the characters "—", "–" or "·". Keep it clear and friendly.`,
    },
  ]);
  return clean(text);
}

export async function questionsFromFile(f: { storedName: string; mime: string; name: string }, kind: "flashcards" | "practice") {
  const raw = await ask(
    [
      await filePart(f.storedName, f.mime),
      {
        text:
          kind === "flashcards"
            ? `Make 12 to 20 flashcards from "${f.name}" for exam revision. Return ONLY a JSON array, no other text: [{"front": "short question or term", "back": "short answer"}]. English. Never use "—", "–" or "·".`
            : `Make 8 to 12 practice exam questions from "${f.name}", mixing short answer and calculation or explain style when it fits. Return ONLY a JSON array, no other text: [{"front": "the question", "back": "a model answer with the key steps"}]. English. Never use "—", "–" or "·".`,
      },
    ],
    true,
  );
  let list: { front?: string; back?: string }[] = [];
  try {
    list = JSON.parse(raw);
  } catch {
    const m = raw.match(/\[[\s\S]*\]/);
    if (m) list = JSON.parse(m[0]);
  }
  return list
    .filter((c) => c.front && c.back)
    .slice(0, 40)
    .map((c) => ({ front: clean(String(c.front)).slice(0, 500), back: clean(String(c.back)).slice(0, 1500) }));
}
