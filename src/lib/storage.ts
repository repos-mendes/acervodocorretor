import { storageGetUrl, storagePut, storageRemove } from "@/lib/localdb/client";

/** Resolve a URL de um arquivo armazenado localmente (seed ou upload em IndexedDB). */
export async function getSignedUrl(bucket: string, path: string, _expiresIn = 600): Promise<string | null> {
  if (!path) return null;
  return storageGetUrl(bucket, path);
}

export async function uploadFile(bucket: string, path: string, file: File, _upsert = false) {
  return storagePut(bucket, path, file);
}

export async function removeFile(bucket: string, path: string) {
  return storageRemove(bucket, path);
}
