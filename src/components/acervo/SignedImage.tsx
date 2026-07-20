import { useEffect, useState } from "react";
import { getSignedUrl } from "@/lib/storage";
import { cn } from "@/lib/utils";
import { ImageIcon } from "lucide-react";

type Props = {
  bucket: string;
  path: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
};

export function SignedImage({ bucket, path, alt, className, fallbackClassName }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    if (!path) { setUrl(null); setLoading(false); return; }
    getSignedUrl(bucket, path).then((u) => { if (!cancelled) { setUrl(u); setLoading(false); } });
    return () => { cancelled = true; };
  }, [bucket, path]);

  if (!path || (!loading && !url)) {
    return (
      <div className={cn("flex items-center justify-center bg-muted text-muted-foreground", fallbackClassName ?? className)}>
        <ImageIcon className="h-8 w-8 opacity-40" />
      </div>
    );
  }
  if (loading) return <div className={cn("animate-pulse bg-muted", className)} />;
  return <img src={url!} alt={alt} className={className} loading="lazy" />;
}
