"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.txt,.doc,.docx,.xls,.xlsx,.ppt,.pptx";

/** Pick a file and upload it privately. Max 15 MB. */
export function FileUpload({ refType, refId }: { refType: string; refId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setMsg(null);
    let ok = 0;
    for (const f of Array.from(files).slice(0, 5)) {
      const fd = new FormData();
      fd.set("file", f);
      fd.set("refType", refType);
      fd.set("refId", refId);
      const r = await fetch("/api/files", { method: "POST", body: fd }).catch(() => null);
      if (r?.ok) ok++;
      else setMsg((await r?.json().catch(() => null))?.error ?? "Upload failed. Try again?");
    }
    setBusy(false);
    if (input.current) input.current.value = "";
    if (ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className={`sticker-sm press flex h-11 cursor-pointer items-center justify-center gap-2 self-start rounded-2xl bg-white px-4 text-sm font-extrabold ${busy ? "opacity-60" : ""}`}>
        📎 {busy ? "Uploading" : "Attach a file"}
        <input ref={input} type="file" multiple accept={ACCEPT} disabled={busy} onChange={(e) => upload(e.target.files)} className="sr-only-safe" />
      </label>
      {msg && (
        <p role="alert" className="text-xs font-extrabold text-coral">
          {msg}
        </p>
      )}
      <p className="text-[11px] font-bold text-ink-soft">PDF, photos or Office files, up to 15 MB. Stored privately on your own server.</p>
    </div>
  );
}
