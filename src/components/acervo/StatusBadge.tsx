import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { commercialStatusLabel, publicationStatusLabel } from "@/lib/format";
import type { CommercialStatus, PublicationStatus } from "@/lib/format";

const commercialColor: Record<CommercialStatus, string> = {
  lancamento: "bg-accent/10 text-accent border-accent/20",
  em_construcao: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200",
  pronto_para_morar: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200",
  ultimas_unidades: "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200",
  em_breve: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200",
  indisponivel: "bg-muted text-muted-foreground",
};

export function CommercialBadge({ status }: { status: CommercialStatus }) {
  return <Badge variant="outline" className={cn("font-medium", commercialColor[status])}>{commercialStatusLabel[status]}</Badge>;
}

export function PublicationBadge({ status }: { status: PublicationStatus }) {
  const cls =
    status === "published" ? "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200"
    : status === "draft" ? "bg-muted text-muted-foreground"
    : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200";
  return <Badge variant="outline" className={cls}>{publicationStatusLabel[status]}</Badge>;
}
