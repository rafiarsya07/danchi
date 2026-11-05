import { CuteIcon } from "@/components/cute-icon";
import { ActButton } from "@/components/action-form";
import { FileUpload } from "@/components/file-upload";
import { Icon } from "@/components/icon";
import { deleteFile } from "@/app/(app)/papers-actions";
import { getFiles } from "@/lib/data3";
import { FileAI } from "@/components/file-ai";
import { aiConfigured } from "@/server/ai";
import { READABLE } from "@/server/ai-files";

function size(n: number) {
  return n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
}
const ICON = (mime: string) =>
  mime.startsWith("image/") ? "image" : mime === "application/pdf" ? "pdf" : mime.includes("sheet") || mime.includes("excel") ? "sheet" : mime.includes("presentation") || mime.includes("powerpoint") ? "slides" : "notes";

/** Files attached to something, plus the upload button for the owner. */
export async function Attachments({ spaceId, refType, refId, canEdit }: { spaceId: string; refType: string; refId: string; canEdit: boolean }) {
  const files = await getFiles(spaceId, refType, refId);
  const ai = aiConfigured();
  return (
    <div className="flex flex-col gap-2">
      {files.map((f) => (
        <div key={f.id} className="flex flex-col gap-1.5 rounded-2xl border-2 border-ink bg-white px-3 py-2">
        <div className="flex items-center gap-2">
          <CuteIcon name={ICON(f.mime)} size={30} />
          <a href={`/api/files/${f.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-extrabold underline">
            {f.name}
          </a>
          <span className="shrink-0 text-xs font-bold text-ink-soft">{size(f.size)}</span>
          <a href={`/api/files/${f.id}?download`} aria-label={`Download ${f.name}`} className="flex size-8 shrink-0 items-center justify-center rounded-lg border-2 border-ink bg-sky-soft text-sm">
            ⬇
          </a>
          {canEdit && (
            <ActButton action={deleteFile.bind(null, f.id)} confirmText={`Delete ${f.name}?`} label="Delete file" className="flex size-8 shrink-0 items-center justify-center text-ink-soft">
              <Icon name="trash" size={15} />
            </ActButton>
          )}
        </div>
        {canEdit && ai && READABLE.has(f.mime) && <FileAI fileId={f.id} />}
        </div>
      ))}
      {files.length === 0 && !canEdit && <p className="text-sm font-bold text-ink-soft">No files.</p>}
      {canEdit && <FileUpload refType={refType} refId={refId} />}
    </div>
  );
}
