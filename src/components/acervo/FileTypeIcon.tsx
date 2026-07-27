import {
  File, FileArchive, FileAudio, FileSpreadsheet, FileText,
  Image as ImageIcon, Presentation, Ruler, Video,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Kind = { icon: typeof File; tile: string };

// As cores saem dos tokens do tema (chart-*), nunca hardcoded — assim o ícone
// acompanha o modo claro/escuro. Ver src/styles.css.
const KINDS: Record<string, Kind> = {
  pdf: { icon: FileText, tile: "bg-chart-4/12 text-chart-4" },
  imagem: { icon: ImageIcon, tile: "bg-chart-1/12 text-chart-1" },
  video: { icon: Video, tile: "bg-chart-5/12 text-chart-5" },
  audio: { icon: FileAudio, tile: "bg-chart-5/12 text-chart-5" },
  planilha: { icon: FileSpreadsheet, tile: "bg-chart-2/12 text-chart-2" },
  apresentacao: { icon: Presentation, tile: "bg-chart-3/12 text-chart-3" },
  documento: { icon: FileText, tile: "bg-chart-1/12 text-chart-1" },
  planta: { icon: Ruler, tile: "bg-chart-2/12 text-chart-2" },
  compactado: { icon: FileArchive, tile: "bg-muted text-muted-foreground" },
  outro: { icon: File, tile: "bg-secondary text-muted-foreground" },
};

const BY_EXTENSION: Record<string, keyof typeof KINDS> = {
  pdf: "pdf",
  jpg: "imagem", jpeg: "imagem", png: "imagem", gif: "imagem", webp: "imagem",
  svg: "imagem", heic: "imagem", bmp: "imagem", tif: "imagem", tiff: "imagem",
  mp4: "video", mov: "video", avi: "video", mkv: "video", webm: "video", m4v: "video",
  mp3: "audio", wav: "audio", m4a: "audio", ogg: "audio",
  xls: "planilha", xlsx: "planilha", csv: "planilha", ods: "planilha",
  ppt: "apresentacao", pptx: "apresentacao", odp: "apresentacao",
  doc: "documento", docx: "documento", txt: "documento", rtf: "documento", odt: "documento",
  dwg: "planta", dxf: "planta", skp: "planta",
  zip: "compactado", rar: "compactado", "7z": "compactado", gz: "compactado",
};

/** Resolve a "família" do arquivo pela extensão (ex.: "xlsx" → planilha). */
function kindOf(extension: string | null | undefined): Kind {
  const ext = extension?.replace(/^\./, "").toLowerCase() ?? "";
  return KINDS[BY_EXTENSION[ext] ?? "outro"];
}

/** Quadradinho com o ícone e a cor do tipo do arquivo. */
export function FileTypeIcon({
  extension,
  fileName,
  className,
}: {
  extension?: string | null;
  /** Usado como reserva quando o registro não tem a extensão salva. */
  fileName?: string | null;
  className?: string;
}) {
  const ext = extension || fileName?.match(/\.([^.]+)$/)?.[1] || null;
  const { icon: Icon, tile } = kindOf(ext);

  return (
    <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md", tile, className)}>
      <Icon className="h-5 w-5" />
    </div>
  );
}
