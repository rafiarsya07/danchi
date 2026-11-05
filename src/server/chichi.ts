/**
 * Ask Chichi: the conversation brain. Streams the answer as it is written.
 *
 * Claude: her Danchi tools + Anthropic's web search and web fetch (server side).
 * Gemini: her Danchi tools + search_web / read_link, which run a grounded
 *         Google Search (or URL reading) sub-request.
 * If the first brain fails before saying anything, the next one takes over.
 */
import type Anthropic from "@anthropic-ai/sdk";
import type { Content, FunctionDeclaration, Part } from "@google/genai";
import type { Db } from "../db/types";
import { TIMEZONE } from "../lib/format";
import { dynamicPrompt, forViewer, runTool, snapshot, staticPrompt, tidy, TOOLS, type ChatTurn } from "./ai";
import { brains, claude, CLAUDE_MODEL, gemini, GEMINI_FALLBACK, GEMINI_MODEL, prettyClaude } from "./llm";

export type Source = { title: string; url: string };
export type ChichiEvent =
  | { type: "status"; text: string }
  | { type: "delta"; text: string }
  | { type: "action"; text: string }
  | { type: "sources"; items: Source[] };
export type Emit = (e: ChichiEvent) => void;

export type AskOpts = {
  db: Db;
  spaceId: string;
  ownerName: string;
  speaker: { name: string; role: "owner" | "viewer" };
  history: ChatTurn[];
  message: string;
  image?: { mime: string; data: string } | null;
};
export type AskResult = { text: string; actions: string[]; sources: Source[]; model: string };

const MAX_ROUNDS = 6;
const STATUS: Record<string, string> = {
  web_search: "Searching the web",
  search_web: "Searching the web",
  web_fetch: "Reading the page",
  read_link: "Reading the page",
  search_danchi: "Looking through your Danchi",
};

function addSources(list: Source[], more: Source[]) {
  for (const s of more) {
    if (!s.url || list.some((x) => x.url === s.url)) continue;
    list.push({ title: (s.title || s.url).slice(0, 120), url: s.url });
  }
}

export async function askChichi(opts: AskOpts, emit: Emit): Promise<AskResult> {
  const full = await snapshot(opts.db, opts.spaceId);
  const data = opts.speaker.role === "owner" ? full : await forViewer(opts.db, opts.spaceId, full);
  const order = brains();
  if (!order.length) throw new Error("Chichi's brain isn't plugged in yet");
  let last: unknown;
  for (const b of order) {
    let said = false;
    const guard: Emit = (e) => {
      if (e.type === "delta" || e.type === "action") said = true;
      emit(e);
    };
    try {
      return b === "claude" ? await withClaude(opts, data, guard) : await withGemini(opts, data, guard);
    } catch (e) {
      last = e;
      console.error(`[chichi] ${b} failed`, (e as Error).message);
      if (said) throw e;
      emit({ type: "status", text: "Thinking a different way" });
    }
  }
  throw last instanceof Error ? last : new Error("Chichi couldn't answer");
}

/* ============================== Claude ============================== */

function claudeHistory(history: ChatTurn[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];
  for (const h of history) {
    const role = h.role === "model" ? "assistant" : "user";
    const prev = out[out.length - 1];
    if (prev && prev.role === role) prev.content = `${prev.content}\n\n${h.text}`;
    else out.push({ role, content: h.text });
  }
  while (out.length && out[0].role !== "user") out.shift();
  if (out.length && out[out.length - 1].role === "user") out.pop();
  return out;
}

async function withClaude(opts: AskOpts, data: unknown, emit: Emit): Promise<AskResult> {
  const owner = opts.speaker.role === "owner";
  const client = claude();
  const userContent: Anthropic.ContentBlockParam[] = [];
  if (opts.image) userContent.push({ type: "image", source: { type: "base64", media_type: opts.image.mime as "image/jpeg", data: opts.image.data } });
  userContent.push({ type: "text", text: opts.message });
  const messages: Anthropic.MessageParam[] = [...claudeHistory(opts.history), { role: "user", content: userContent }];

  const mine: Anthropic.ToolUnion[] = owner
    ? TOOLS.map((t) => ({ name: t.name!, description: t.description ?? "", input_schema: t.parametersJsonSchema as Anthropic.Tool.InputSchema }))
    : [];
  let useFetch = true;
  const tools = (): Anthropic.ToolUnion[] => [
    ...mine,
    { type: "web_search_20250305", name: "web_search", max_uses: 5, user_location: { type: "approximate", country: "MY", timezone: TIMEZONE } },
    ...(useFetch ? [{ type: "web_fetch_20250910", name: "web_fetch", max_uses: 3 } as Anthropic.ToolUnion] : []),
  ];
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: staticPrompt(opts.ownerName, opts.speaker), cache_control: { type: "ephemeral" } },
    { type: "text", text: dynamicPrompt(data) },
  ];
  const effort = process.env.ANTHROPIC_EFFORT as "low" | "medium" | "high" | undefined;

  let text = "";
  const actions: string[] = [];
  const sources: Source[] = [];
  const found: Source[] = [];
  const say = (d: string) => {
    if (!d) return;
    text += d;
    emit({ type: "delta", text: d });
  };

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (text && !text.endsWith("\n")) say("\n\n");
    let msg: Anthropic.Message;
    try {
      const stream = client.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: 6000,
        system,
        tools: tools(),
        messages,
        ...(effort ? { output_config: { effort } } : {}),
      });
      stream.on("text", (d) => say(d));
      stream.on("streamEvent", (ev) => {
        if (ev.type === "content_block_start" && (ev.content_block.type === "server_tool_use" || ev.content_block.type === "tool_use")) {
          emit({ type: "status", text: STATUS[ev.content_block.name] ?? "Working on it" });
        }
      });
      msg = await stream.finalMessage();
    } catch (e) {
      const m = String((e as Error).message);
      if (useFetch && /web_fetch/i.test(m) && !text) {
        useFetch = false;
        round--;
        continue;
      }
      throw e;
    }

    for (const block of msg.content) {
      if (block.type === "text" && block.citations) {
        addSources(
          sources,
          block.citations.flatMap((c) => ("url" in c && c.url ? [{ title: ("title" in c && c.title) || c.url, url: c.url }] : [])),
        );
      }
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        addSources(found, block.content.map((r) => ({ title: r.title, url: r.url })));
      }
    }

    if (msg.stop_reason === "pause_turn") {
      messages.push({ role: "assistant", content: msg.content });
      continue;
    }
    if (msg.stop_reason !== "tool_use") break;

    messages.push({ role: "assistant", content: msg.content });
    const results: Anthropic.ToolResultBlockParam[] = [];
    for (const block of msg.content) {
      if (block.type !== "tool_use") continue;
      if (!owner) {
        results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify({ error: "not allowed" }), is_error: true });
        continue;
      }
      const { result, label } = await runTool(opts.db, opts.spaceId, (data as { currency: string }).currency, block.name, (block.input ?? {}) as Record<string, unknown>);
      if (label) {
        actions.push(label);
        emit({ type: "action", text: label });
      }
      results.push({ type: "tool_result", tool_use_id: block.id, content: JSON.stringify(result).slice(0, 30000) });
    }
    messages.push({ role: "user", content: results });
  }

  if (!sources.length && found.length) addSources(sources, found.slice(0, 3));
  if (sources.length) emit({ type: "sources", items: sources.slice(0, 6) });
  const final = tidy(text) || (actions.length ? "Done! ✨" : "Hmm, I got a bit tongue tied. Try again? 🍑");
  return { text: final, actions, sources: sources.slice(0, 6), model: prettyClaude(CLAUDE_MODEL) };
}

/* ============================== Gemini ============================== */

const WEB_TOOLS: FunctionDeclaration[] = [
  {
    name: "search_web",
    description:
      "Search Google for anything you are not completely sure about or that may have changed: news, prices, opening hours, weather, schedules, products, places, people, facts. Returns an answer with sources.",
    parametersJsonSchema: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
  },
  {
    name: "read_link",
    description: "Open a web link (URL) she shares and read what it says.",
    parametersJsonSchema: { type: "object", properties: { url: { type: "string" } }, required: ["url"] },
  },
];

async function geminiGrounded(kind: "search" | "link", input: string): Promise<{ result: Record<string, unknown>; sources: Source[] }> {
  const ai = gemini();
  const prompt =
    kind === "search"
      ? `Search the web and answer accurately with specific facts, numbers and dates. Today is ${new Date().toLocaleDateString("en-GB", { timeZone: TIMEZONE, dateStyle: "full" })}, the person is in Malaysia. Question: ${input}`
      : `Read this page and report its main content in detail (key facts, steps, prices, dates): ${input}`;
  for (const model of [GEMINI_MODEL, GEMINI_FALLBACK]) {
    try {
      const res = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { temperature: 0.2, maxOutputTokens: 2048, tools: [kind === "search" ? { googleSearch: {} } : { urlContext: {} }] },
      });
      const chunks = res.candidates?.[0]?.groundingMetadata?.groundingChunks ?? [];
      const sources = chunks.flatMap((c) => (c.web?.uri ? [{ title: c.web.title ?? c.web.uri, url: c.web.uri }] : []));
      if (kind === "link" && /^https?:\/\//.test(input)) sources.unshift({ title: input, url: input });
      return { result: { answer: (res.text ?? "").slice(0, 8000), sources: sources.map((s) => s.title) }, sources };
    } catch (e) {
      if (!/not.?found|404|no longer available|not supported/i.test(String((e as Error).message))) {
        return { result: { error: (e as Error).message.slice(0, 200) }, sources: [] };
      }
    }
  }
  return { result: { error: "search unavailable" }, sources: [] };
}

async function withGemini(opts: AskOpts, data: unknown, emit: Emit): Promise<AskResult> {
  const owner = opts.speaker.role === "owner";
  const ai = gemini();
  const history: Content[] = opts.history.map((h) => ({ role: h.role, parts: [{ text: h.text }] }));
  while (history.length && history[0].role !== "user") history.shift();
  const first: Part[] = [];
  if (opts.image) first.push({ inlineData: { mimeType: opts.image.mime, data: opts.image.data } });
  first.push({ text: opts.message });
  const contents: Content[] = [...history, { role: "user", parts: first }];
  const config = {
    systemInstruction: `${staticPrompt(opts.ownerName, opts.speaker)}\n\nUse search_web whenever you are not fully sure of a fact.\n\n${dynamicPrompt(data)}`,
    temperature: 0.7,
    maxOutputTokens: 6000,
    tools: [{ functionDeclarations: [...(owner ? TOOLS : []), ...WEB_TOOLS] }],
  };

  let model = GEMINI_MODEL;
  let text = "";
  const actions: string[] = [];
  const sources: Source[] = [];
  const say = (d: string) => {
    if (!d) return;
    text += d;
    emit({ type: "delta", text: d });
  };

  for (let round = 0; round < MAX_ROUNDS; round++) {
    if (text && !text.endsWith("\n")) say("\n\n");
    let stream: AsyncGenerator<import("@google/genai").GenerateContentResponse>;
    try {
      stream = await ai.models.generateContentStream({ model, contents, config });
    } catch (e) {
      if (model !== GEMINI_FALLBACK && /not.?found|404|no longer available|not supported/i.test(String((e as Error).message))) {
        model = GEMINI_FALLBACK;
        stream = await ai.models.generateContentStream({ model, contents, config });
      } else throw e;
    }
    const parts: Part[] = [];
    for await (const chunk of stream) {
      for (const p of chunk.candidates?.[0]?.content?.parts ?? []) {
        parts.push(p);
        if (p.text && !p.thought) say(p.text);
      }
    }
    const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!);
    if (!calls.length) break;
    contents.push({ role: "model", parts });
    const responses: Part[] = [];
    for (const c of calls.slice(0, 6)) {
      const name = c.name ?? "";
      emit({ type: "status", text: STATUS[name] ?? "Working on it" });
      const args = (c.args ?? {}) as Record<string, unknown>;
      let result: Record<string, unknown>;
      if (name === "search_web" || name === "read_link") {
        const g = await geminiGrounded(name === "search_web" ? "search" : "link", String(args.query ?? args.url ?? "").slice(0, 500));
        addSources(sources, g.sources);
        result = g.result;
      } else if (owner) {
        const r = await runTool(opts.db, opts.spaceId, (data as { currency: string }).currency, name, args);
        result = r.result;
        if (r.label) {
          actions.push(r.label);
          emit({ type: "action", text: r.label });
        }
      } else result = { error: "not allowed" };
      responses.push({ functionResponse: { id: c.id, name, response: result } });
    }
    contents.push({ role: "user", parts: responses });
  }

  if (sources.length) emit({ type: "sources", items: sources.slice(0, 6) });
  const final = tidy(text) || (actions.length ? "Done! ✨" : "Hmm, I got a bit tongue tied. Try again? 🍑");
  return { text: final, actions, sources: sources.slice(0, 6), model: `Gemini (${model})` };
}
