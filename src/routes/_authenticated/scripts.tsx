import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { db } from "@/lib/localdb/client";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { copyText } from "@/lib/clipboard";
import { cn } from "@/lib/utils";
import { Search, Copy, Check, MessageSquareText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/scripts")({
  component: ScriptsPage,
});

type Script = {
  id: string;
  title: string;
  content: string;
  category: string | null;
  sort_order: number;
};

const SEM_CATEGORIA = "Geral";

function ScriptsPage() {
  const [q, setQ] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["broker-scripts"],
    queryFn: async () => {
      const { data } = await db
        .from("scripts")
        .select("id, title, content, category, sort_order")
        .eq("status", "active")
        .order("sort_order");
      return (data ?? []) as Script[];
    },
  });

  const groups = useMemo(() => {
    const lc = q.trim().toLowerCase();
    const filtered = (data ?? []).filter((s) =>
      !lc
        ? true
        : [s.title, s.content, s.category].some((f) => f?.toLowerCase().includes(lc)),
    );

    const byCategory = new Map<string, Script[]>();
    for (const s of filtered) {
      const key = s.category?.trim() || SEM_CATEGORIA;
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key)!.push(s);
    }
    return Array.from(byCategory, ([name, scripts]) => ({ name, scripts }));
  }, [data, q]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Scripts rápidos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Mensagens prontas para o dia a dia. Clique em um script para copiar e cole onde precisar.
        </p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por assunto, texto ou categoria..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
          <MessageSquareText className="h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 font-medium">
            {q ? "Nenhum script encontrado" : "Nenhum script cadastrado ainda"}
          </p>
          <p className="text-sm text-muted-foreground">
            {q ? "Tente outra busca." : "Os scripts publicados pela administração aparecerão aqui."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.name} className="space-y-3">
              <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                {g.name}
              </h2>
              <div className="grid items-start gap-3 sm:grid-cols-2">
                {g.scripts.map((s) => (
                  <ScriptCard key={s.id} script={s} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function ScriptCard({ script }: { script: Script }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    const ok = await copyText(script.content);
    if (!ok) {
      toast.error("Não foi possível copiar. Tente selecionar o texto manualmente.");
      return;
    }
    setCopied(true);
    toast.success("Script copiado!");
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={`Copiar script: ${script.title}`}
      className={cn(
        "group flex h-full w-full flex-col rounded-xl border bg-card p-4 text-left transition-all",
        copied ? "border-accent ring-1 ring-accent" : "hover:border-accent/40 hover:shadow-md",
      )}
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h3 className="font-medium leading-snug">{script.title}</h3>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 text-xs font-medium transition-colors",
            copied ? "text-accent" : "text-muted-foreground group-hover:text-accent",
          )}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copiado" : "Copiar"}
        </span>
      </div>
      <p className="whitespace-pre-line text-sm text-muted-foreground line-clamp-5">
        {script.content}
      </p>
    </button>
  );
}
