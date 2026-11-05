import "server-only";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Private uploads live on the mini PC's disk, outside the public folder, with
 * random names. They are only ever served by /api/files/[id] after a session
 * and privacy check.
 */
export const MAX_FILE_BYTES = 15 * 1024 * 1024;

export const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "application/vnd.ms-powerpoint": "ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
};

export const uploadDir = () => path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR || path.join(/* turbopackIgnore: true */ process.cwd(), "data", "uploads"));

/** Checks the first bytes too, so a renamed .exe can't pretend to be a PDF. */
export function sniffOk(mime: string, buf: Buffer) {
  const head = buf.subarray(0, 12);
  if (mime === "application/pdf") return head.subarray(0, 4).toString() === "%PDF";
  if (mime === "image/png") return head[0] === 0x89 && head.subarray(1, 4).toString() === "PNG";
  if (mime === "image/jpeg") return head[0] === 0xff && head[1] === 0xd8;
  if (mime === "image/webp") return head.subarray(0, 4).toString() === "RIFF" && head.subarray(8, 12).toString() === "WEBP";
  if (mime.includes("openxmlformats")) return head[0] === 0x50 && head[1] === 0x4b; // zip
  if (mime === "application/msword" || mime === "application/vnd.ms-excel" || mime === "application/vnd.ms-powerpoint") return head[0] === 0xd0 && head[1] === 0xcf;
  if (mime === "text/plain") return !buf.subarray(0, 2048).includes(0);
  return true; // heic: trust the browser
}

export async function storeFile(buf: Buffer, mime: string) {
  const dir = uploadDir();
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const stored = `${randomBytes(18).toString("hex")}.${ALLOWED[mime] ?? "bin"}`;
  await writeFile(path.join(/* turbopackIgnore: true */ dir, stored), buf, { mode: 0o600 });
  return stored;
}

export async function readStored(stored: string) {
  if (!/^[a-f0-9]{36}\.[a-z]{2,4}$/.test(stored)) throw new Error("bad name");
  return readFile(path.join(/* turbopackIgnore: true */ uploadDir(), stored));
}

export async function removeStored(stored: string) {
  if (!/^[a-f0-9]{36}\.[a-z]{2,4}$/.test(stored)) return;
  await unlink(path.join(/* turbopackIgnore: true */ uploadDir(), stored)).catch(() => {});
}
