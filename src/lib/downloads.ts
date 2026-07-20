import JSZip from "jszip";
import { db } from "@/lib/localdb/client";
import { getSignedUrl } from "@/lib/storage";

export type DownloadableFile = {
  id: string;
  storage_path: string;
  original_file_name: string;
};

function triggerBrowserDownload(url: string, fileName: string) {
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

async function recordDownload(fileId: string, developmentId: string) {
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return;
  await db
    .from("file_downloads")
    .insert({ file_id: fileId, development_id: developmentId, user_id: user.id });
}

export function safeFileName(name: string) {
  return name.replace(/[\\/:*?"<>|]/g, "-").trim();
}

export async function downloadFile(file: DownloadableFile, developmentId: string) {
  const url = await getSignedUrl("materials", file.storage_path, 60);
  if (!url) throw new Error("Não foi possível gerar o link do arquivo.");
  await recordDownload(file.id, developmentId);
  triggerBrowserDownload(url, file.original_file_name);
}

/** Baixa vários arquivos como um único ZIP. Retorna quantos entraram no pacote. */
export async function downloadFilesAsZip(
  files: DownloadableFile[],
  developmentId: string,
  zipName: string,
) {
  const zip = new JSZip();
  let added = 0;
  for (const f of files) {
    const url = await getSignedUrl("materials", f.storage_path, 300);
    if (!url) continue;
    zip.file(f.original_file_name, await (await fetch(url)).blob());
    await recordDownload(f.id, developmentId);
    added++;
  }
  if (added === 0) throw new Error("Nenhum arquivo pôde ser baixado.");
  const content = await zip.generateAsync({ type: "blob" });
  const url = URL.createObjectURL(content);
  triggerBrowserDownload(url, safeFileName(zipName));
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return added;
}

/** Baixa um arquivo direto ou vários em ZIP, conforme a quantidade. */
export async function downloadGroup(
  files: DownloadableFile[],
  developmentId: string,
  zipName: string,
) {
  if (files.length === 1) {
    await downloadFile(files[0], developmentId);
    return 1;
  }
  return downloadFilesAsZip(files, developmentId, zipName);
}
