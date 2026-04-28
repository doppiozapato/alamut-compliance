import { useEffect, useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { BookOpen, Search, FileText, ChevronRight, AlertTriangle, Inbox, LogIn } from "lucide-react";
import type { ManualChapter, ManualSourcePdf } from "@shared/schema";
import { logout } from "@/lib/auth";
import { ApiError } from "@/lib/queryClient";

export default function Manual() {
  const { data: chapters = [], isLoading, isError, error, refetch, isFetching } = useQuery<ManualChapter[]>({
    queryKey: ["/api/manual/chapters"],
  });
  const status = error instanceof ApiError ? error.status : null;
  const isUnauthenticated = status === 401;
  const { data: source } = useQuery<ManualSourcePdf>({
    queryKey: ["/api/manual/source"],
  });
  const [q, setQ] = useState("");

  // When the session has expired we want the user to land on Login
  // automatically — App.tsx's session-expired listener already handles this,
  // but we kick a small delay-fallback redirect in case the listener has
  // been bypassed (e.g. very old cached client bundle).
  useEffect(() => {
    if (!isUnauthenticated) return;
    const t = window.setTimeout(() => {
      // wouter uses hash routing; clear the hash and reload to drop into Login
      window.location.hash = "";
      window.location.reload();
    }, 4000);
    return () => window.clearTimeout(t);
  }, [isUnauthenticated]);

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

  const main = filtered.filter((c) => c.kind !== "appendix");
  const appendices = filtered.filter((c) => c.kind === "appendix");
  const allMain = chapters.filter((c) => c.kind !== "appendix");
  const allAppendices = chapters.filter((c) => c.kind === "appendix");

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          <h1 className="text-base font-semibold">
            {source?.title ?? "Firm Compliance Manual"}
          </h1>
          {chapters.length > 0 && (
            <span className="text-[11px] text-muted-foreground">
              · {allMain.length} chapters
              {allAppendices.length > 0 ? ` · ${allAppendices.length} appendices` : ""}
            </span>
          )}
        </div>
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search chapters, sections, FCA refs…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>
      {source && (
        <p className="text-[11px] text-muted-foreground mb-5 flex items-center gap-1.5">
          <FileText className="w-3 h-3" /> {source.version}
          {source.page_count ? ` · ${source.page_count} pages` : ""} ·
          source: <span className="font-mono">{source.source_file}</span>
        </p>
      )}

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-8">Loading manual…</p>
      ) : isUnauthenticated ? (
        <div className="py-10 max-w-md rounded-lg border border-amber-500/40 bg-amber-500/5 px-5 py-5">
          <div className="flex items-start gap-2.5 mb-2">
            <LogIn className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Your session has expired
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                For your security we signed you out after a period of inactivity.
                Sign in again to view the Compliance Manual. You'll be redirected
                automatically in a few seconds.
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={async () => {
                await logout();
                window.location.hash = "";
                window.location.reload();
              }}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Sign in again
            </button>
          </div>
        </div>
      ) : isError ? (
        <div className="py-10 max-w-md rounded-lg border border-destructive/40 bg-destructive/5 px-5 py-5">
          <div className="flex items-start gap-2.5 mb-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Couldn't load the Compliance Manual
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The server returned an error while fetching the chapter list. This
                usually means a transient backend issue — your session is still
                valid.
              </p>
              <p className="text-[10px] font-mono text-muted-foreground/80 mt-2 break-all">
                {status ? `HTTP ${status}` : "network error"}
                {error instanceof Error && error.message && status !== 0
                  ? ` · ${error.message}`
                  : ""}
              </p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              disabled={isFetching}
              onClick={() => refetch()}
              className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {isFetching ? "Retrying…" : "Retry"}
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-xs font-medium px-3 py-1.5 rounded-md border border-border hover:bg-accent transition-colors"
            >
              Hard refresh
            </button>
          </div>
        </div>
      ) : chapters.length === 0 ? (
        <div className="py-10 max-w-md rounded-lg border border-border bg-card px-5 py-5">
          <div className="flex items-start gap-2.5">
            <Inbox className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                No manual chapters found
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The Compliance Manual hasn't been imported yet. An admin needs to
                run the manual import script (or seed Supabase with chapters)
                before this page will populate.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
          <TableOfContents main={allMain} appendices={allAppendices} />
          <div>
            {filtered.length === 0 ? (
              <p className="text-xs text-muted-foreground py-8">
                No chapters match your search.
              </p>
            ) : (
              <>
                <ChapterList items={main} heading="Chapters" />
                {appendices.length > 0 && (
                  <div className="mt-8">
                    <ChapterList items={appendices} heading="Appendices" />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function TableOfContents({
  main,
  appendices,
}: {
  main: ManualChapter[];
  appendices: ManualChapter[];
}) {
  return (
    <aside className="self-start lg:sticky lg:top-4 bg-card border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 border-b border-border">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
          Table of contents
        </p>
      </div>
      <nav className="max-h-[70vh] overflow-y-auto">
        <TocSection title="Chapters" items={main} />
        {appendices.length > 0 && <TocSection title="Appendices" items={appendices} />}
      </nav>
    </aside>
  );
}

function TocSection({ title, items }: { title: string; items: ManualChapter[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <p className="px-3 pt-3 pb-1 text-[10px] uppercase tracking-wider text-muted-foreground/80">
        {title}
      </p>
      <ul className="pb-2">
        {items.map((c) => (
          <li key={c.id}>
            <Link href={`/manual/${c.slug}`}>
              <a className="flex items-start gap-2 px-3 py-1.5 text-[12px] text-foreground/90 hover:bg-accent hover:text-accent-foreground border-l-2 border-transparent hover:border-primary transition-colors">
                <span className="font-mono text-[10px] text-muted-foreground w-10 shrink-0 pt-0.5">
                  {c.number}
                </span>
                <span className="leading-snug">{c.title}</span>
              </a>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChapterList({ items, heading }: { items: ManualChapter[]; heading: string }) {
  return (
    <>
      <h2 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
        {heading} <span className="text-muted-foreground/70">· {items.length}</span>
      </h2>
      <ol className="space-y-2">
        {items.map((c) => (
          <li key={c.id}>
            <Link href={`/manual/${c.slug}`}>
              <a className="block bg-card border border-border rounded-lg px-4 py-3 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {c.kind === "appendix" ? "Appendix" : "Chapter"} {c.number}
                      {c.start_page ? ` · pp. ${c.start_page}-${c.end_page}` : ""}
                      {c.version ? ` · ${c.version}` : ""}
                    </p>
                    <p className="text-sm font-semibold mt-0.5 text-primary hover:underline">
                      {c.title}
                    </p>
                    {c.summary && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {c.summary}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-0.5" />
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
                {c.owner && (
                  <p className="text-[10px] text-muted-foreground mt-2">Owner: {c.owner}</p>
                )}
              </a>
            </Link>
          </li>
        ))}
      </ol>
    </>
  );
}
