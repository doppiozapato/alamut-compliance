import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, ExternalLink } from "lucide-react";
import type { ManualChapter, ManualSection } from "@shared/schema";
import { formatDate } from "@/lib/utils";

interface Props {
  slug: string;
}

// Tiny markdown-ish renderer — converts headings, lists, paragraphs.
function renderMarkdown(md: string): string {
  const escaped = md
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const lines = escaped.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;
  for (const raw of lines) {
    const line = raw.trimEnd();
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      const level = h[1].length;
      out.push(`<h${level}>${h[2]}</h${level}>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      if (!inList) {
        out.push("<ul>");
        inList = true;
      }
      out.push(`<li>${line.replace(/^[-*]\s+/, "")}</li>`);
      continue;
    }
    if (line === "") {
      if (inList) {
        out.push("</ul>");
        inList = false;
      }
      out.push("");
      continue;
    }
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
    out.push(`<p>${line}</p>`);
  }
  if (inList) out.push("</ul>");
  return out.join("\n");
}

const HB = "https://handbook.fca.org.uk/handbook";

function sectionAnchor(num: string): string {
  return `sec-${num.replace(/\./g, "-")}`;
}

export default function ChapterView({ slug }: Props) {
  const { data: c, isLoading } = useQuery<ManualChapter>({
    queryKey: [`/api/manual/chapters/${slug}`],
  });

  const sections: ManualSection[] = useMemo(() => c?.sections ?? [], [c]);
  const isAppendix = c?.kind === "appendix";

  if (isLoading) {
    return <div className="px-6 py-6 text-xs text-muted-foreground">Loading…</div>;
  }
  if (!c) {
    return (
      <div className="px-6 py-6">
        <p className="text-xs text-muted-foreground">Chapter not found.</p>
        <Link href="/manual">
          <a className="text-xs text-primary hover:underline mt-2 inline-block">
            ← Back to manual
          </a>
        </Link>
      </div>
    );
  }

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <Link href="/manual">
        <a className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="w-3 h-3" /> Back to manual
        </a>
      </Link>

      <div className="mb-5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {isAppendix ? "Appendix" : "Chapter"} {c.number}
          {c.start_page ? ` · pp. ${c.start_page}–${c.end_page}` : ""}
          {c.version ? ` · ${c.version}` : ""}
          {c.effective_date ? ` · effective ${formatDate(c.effective_date)}` : ""}
        </p>
        <h1 className="text-lg font-semibold mt-1">{c.title}</h1>
        {c.summary && <p className="text-xs text-muted-foreground mt-1">{c.summary}</p>}
      </div>

      {c.fca_refs.length > 0 && (
        <div className="mb-5 bg-card border border-border rounded-lg px-3.5 py-2.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
            FCA Handbook references
          </p>
          <div className="flex flex-wrap gap-1.5">
            {c.fca_refs.map((r) => {
              const code = r.split(/\s/)[0];
              return (
                <a
                  key={r}
                  href={`${HB}/${code}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                >
                  {r}
                  <ExternalLink className="w-2.5 h-2.5" />
                </a>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-6">
        {sections.length > 0 ? (
          <aside className="hidden lg:block self-start sticky top-4">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              Sections
            </p>
            <nav className="space-y-1 text-[11px] border-l border-border pl-3">
              {sections.map((s) => (
                <a
                  key={s.number}
                  href={`#${sectionAnchor(s.number)}`}
                  className="block text-muted-foreground hover:text-foreground"
                >
                  <span className="font-mono text-[10px] mr-1.5">{s.number}</span>
                  {s.title}
                </a>
              ))}
            </nav>
          </aside>
        ) : null}

        <article className="prose prose-sm dark:prose-invert max-w-none">
          {sections.length > 0 ? (
            <>
              {sections.map((s) => (
                <section key={s.number} id={sectionAnchor(s.number)} className="scroll-mt-20">
                  <h2 className="text-sm font-semibold flex items-baseline gap-2 mt-6 mb-2">
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {s.number}
                    </span>
                    <span>{s.title}</span>
                    {s.page ? (
                      <span className="text-[10px] text-muted-foreground/70 font-normal">
                        p. {s.page}
                      </span>
                    ) : null}
                  </h2>
                  {s.content ? (
                    <div
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(s.content) }}
                    />
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Section content pending — see source PDF for full text.
                    </p>
                  )}
                </section>
              ))}
            </>
          ) : (
            <div
              // eslint-disable-next-line react/no-danger
              dangerouslySetInnerHTML={{ __html: renderMarkdown(c.content) }}
            />
          )}
        </article>
      </div>

      <div className="mt-8 pt-4 border-t border-border text-[10px] text-muted-foreground flex items-center justify-between">
        <span>Last updated {formatDate(c.updated_at)}</span>
        {c.owner && <span>Owner: {c.owner}</span>}
      </div>
    </div>
  );
}
