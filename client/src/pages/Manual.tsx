import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search } from "lucide-react";
import type { ManualChapter } from "@shared/schema";

export default function Manual() {
  const { data: chapters = [], isLoading } = useQuery<ManualChapter[]>({
    queryKey: ["/api/manual/chapters"],
  });
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q.trim()) return chapters;
    const s = q.toLowerCase();
    return chapters.filter(
      (c) =>
        c.title.toLowerCase().includes(s) ||
        c.number.toLowerCase().includes(s) ||
        (c.summary ?? "").toLowerCase().includes(s) ||
        c.fca_refs.some((r) => r.toLowerCase().includes(s)) ||
        c.tags.some((t) => t.toLowerCase().includes(s)),
    );
  }, [q, chapters]);

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          <h1 className="text-base font-semibold">Firm Compliance Manual</h1>
        </div>
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chapters, topics, FCA refs…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">
          No chapters match. Use the import script (<span className="font-mono">script/importManual.ts</span>) to ingest the firm manual.
        </p>
      ) : (
        <ol className="space-y-2">
          {filtered.map((c) => (
            <li key={c.id}>
              <Link href={`/manual/${c.slug}`}>
                <a className="block bg-card border border-border rounded-lg px-4 py-3 hover:border-primary/40 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        Chapter {c.number} {c.version ? `· ${c.version}` : ""}
                      </p>
                      <p className="text-sm font-medium mt-0.5">{c.title}</p>
                      {c.summary && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {c.summary}
                        </p>
                      )}
                    </div>
                    {c.owner && (
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                        Owner: {c.owner}
                      </span>
                    )}
                  </div>
                  {(c.fca_refs.length > 0 || c.tags.length > 0) && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {c.fca_refs.map((r) => (
                        <span
                          key={r}
                          className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20"
                        >
                          {r}
                        </span>
                      ))}
                      {c.tags.map((t) => (
                        <span
                          key={t}
                          className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </a>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
