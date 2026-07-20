import type { Database } from "@/lib/localdb/types";

export type CommercialStatus = Database["public"]["Enums"]["commercial_status"];
export type PublicationStatus = Database["public"]["Enums"]["publication_status"];
export type AnnouncementPriority = Database["public"]["Enums"]["announcement_priority"];
export type AppRole = Database["public"]["Enums"]["app_role"];
export type UserStatus = Database["public"]["Enums"]["user_status"];

export const commercialStatusLabel: Record<CommercialStatus, string> = {
  lancamento: "Lançamento",
  em_construcao: "Em construção",
  pronto_para_morar: "Pronto para morar",
  ultimas_unidades: "Últimas unidades",
  em_breve: "Em breve",
  indisponivel: "Temporariamente indisponível",
};

export const publicationStatusLabel: Record<PublicationStatus, string> = {
  published: "Publicado",
  draft: "Rascunho",
  archived: "Arquivado",
};

export const priorityLabel: Record<AnnouncementPriority, string> = {
  informativo: "Informativo",
  importante: "Importante",
  urgente: "Urgente",
};

export const roleLabel: Record<AppRole, string> = {
  admin: "Administrador",
  corretor: "Corretor",
};

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(date: string | null | undefined): string {
  if (!date) return "—";
  return new Date(date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function slugify(text: string): string {
  return text
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts[parts.length - 1]?.[0] ?? "")).toUpperCase();
}
