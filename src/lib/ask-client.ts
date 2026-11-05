"use client";

export type Source = { title: string; url: string };
export type AskDone = { text: string; actions: string[]; sources: Source[]; left?: number; model?: string };
export type AskHandlers = {
  onStatus?: (text: string) => void;
  onDelta?: (text: string) => void;
  onAction?: (text: string) => void;
  onSources?: (items: Source[]) => void;
};
export type AskImage = { mime: string; data: string };

/** Talk to Chichi and receive her answer as it is being written. */
export async function askChichi(message: string, image: AskImage | null, h: AskHandlers = {}): Promise<AskDone> {
  const r = await fetch("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message, image }),
  });
  if (!r.ok || !r.body) {
    const d = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(d.error || "Couldn't reach Chichi. Try again?");
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let done: AskDone | null = null;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (value) buf += dec.decode(value, { stream: true });
    let i: number;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      let ev: Record<string, unknown>;
      try {
        ev = JSON.parse(line);
      } catch {
        continue;
      }
      if (ev.type === "status") h.onStatus?.(String(ev.text));
      else if (ev.type === "delta") h.onDelta?.(String(ev.text));
      else if (ev.type === "action") h.onAction?.(String(ev.text));
      else if (ev.type === "sources") h.onSources?.(ev.items as Source[]);
      else if (ev.type === "error") throw new Error(String(ev.error));
      else if (ev.type === "done") done = ev as unknown as AskDone;
    }
    if (end) break;
  }
  if (!done) throw new Error("Chichi got cut off. Try again?");
  return done;
}

/** Shrink a photo on the phone before sending (max 1600px, JPEG). */
export async function photoForChichi(file: File): Promise<AskImage & { preview: string; blob: Blob }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, bad) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => bad(new Error("That photo couldn't be opened"));
      i.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const hgt = Math.max(1, Math.round(img.naturalHeight * scale));
    const c = document.createElement("canvas");
    c.width = w;
    c.height = hgt;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("That photo couldn't be opened");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, hgt);
    ctx.drawImage(img, 0, 0, w, hgt);
    const dataUrl = c.toDataURL("image/jpeg", 0.85);
    // Straight from the canvas: fetch() on a data: URL is blocked by our CSP.
    const blob = await new Promise<Blob>((ok, bad) => c.toBlob((b) => (b ? ok(b) : bad(new Error("That photo couldn't be opened"))), "image/jpeg", 0.85));
    return { mime: "image/jpeg", data: dataUrl.split(",")[1], preview: dataUrl, blob };
  } finally {
    URL.revokeObjectURL(url);
  }
}
