import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, ExternalLink, Search, ChevronDown } from "lucide-react";
import type {
  RegulatoryUpdate,
  RegulatoryUpdateQuarter,
} from "@shared/schema";
import { cn, formatDate } from "@/lib/utils";

const SECTIONS: { key: "all" | "regulatory" | "enforcement"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "regulatory", label: "Regulatory" },
  { key: "enforcement", label: "Enforcement" },
];

export default function RegulatoryUpdatesPage() {
  const { data: quarters = [] } = useQuery<RegulatoryUpdateQuarter[]>({
    queryKey: ["/api/regulatory-updates/quarters"],
  });
  const { data: updates = [] } = useQuery<RegulatoryUpdate[]>({
    queryKey: ["/api/regulatory-updates"],
  });

  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const [section, setSection] = useState<"all" | "regulatory" | "enforcement">("all");
  const [q, setQ] = useState("");

  // Default to the newest quarter once the quarters list loads.
  useEffect(() => {
    if (!selectedQuarter && quarters.length > 0) {
      const first = quarters[0];
      setSelectedQuarter(`${first.year}-${first.quarter}`);
    }
  }, [quarters, selectedQuarter]);

  const filtered = useMemo(() => {
    if (!selectedQuarter) return [];
    const [yearStr, quarter] = selectedQuarter.split("-");
    const year = parseInt(yearStr, 10);
    let rows = updates.filter((u) => u.year === year && u.quarter === quarter);
    if (section !== "all") rows = rows.filter((u) => u.section === section);
    const term = q.trim().toLowerCase();
    if (term) {
      rows = rows.filter(
        (u) =>
          u.title.toLowerCase().includes(term) ||
          u.body.toLowerCase().includes(term) ||
          (u.category ?? "").toLowerCase().includes(term),
      );
    }
    return rows;
  }, [updates, selectedQuarter, section, q]);

  const groupedBySection = useMemo(() => {
    const out: Record<string, RegulatoryUpdate[]> = {};
    for (const u of filtered) {
      (out[u.section] ??= []).push(u);
    }
    return out;
  }, [filtered]);

  const currentLabel =
    quarters.find((qq) => `${qq.year}-${qq.quarter}` === selectedQuarter)?.label ??
    selectedQuarter;

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <h1 className="text-base font-semibold">Regulatory Updates</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Quarterly digest of FCA, FATF and market guidance affecting the firm. Select a quarter to view its updates.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <select
              value={selectedQuarter}
              onChange={(e) => setSelectedQuarter(e.target.value)}
              className="appearance-none text-xs pl-3 pr-8 py-1.5 rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring"
            >
              {quarters.length === 0 && <option value="">No quarters available</option>}
              {quarters.map((qq) => (
                <option key={`${qq.year}-${qq.quarter}`} value={`${qq.year}-${qq.quarter}`}>
                  {qq.label} ({qq.count})
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          <div className="relative w-64">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search title, body, category…"
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-5">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={cn(
              "text-[11px] px-2.5 py-1 rounded-md border transition-colors",
              section === s.key
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-card hover:bg-secondary",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {!selectedQuarter && (
        <p className="text-xs text-muted-foreground py-8 text-center">
          Loading quarters…
        </p>
      )}

      {selectedQuarter && filtered.length === 0 && (
        <p className="text-xs text-muted-foreground py-8 text-center">
          No regulatory updates match the current filter for {currentLabel}.
        </p>
      )}

      {(["regulatory", "enforcement"] as const).map((sec) => {
        const rows = groupedBySection[sec];
        if (!rows || rows.length === 0) return null;
        return (
          <section key={sec} className="mb-6">
            <h2 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              {sec === "regulatory" ? "Regulatory" : "Enforcement Cases"} ·{" "}
              {currentLabel}
            </h2>
            <div className="space-y-3">
              {rows.map((u) => (
                <UpdateCard key={u.id} update={u} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function UpdateCard({ update }: { update: RegulatoryUpdate }) {
  return (
    <article className="bg-card border border-border rounded-lg px-4 py-3">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-tight">{update.title}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[10px] text-muted-foreground">
            <span>
              {update.date_published_label ?? formatDate(update.date_published)}
            </span>
            {update.category && (
              <>
                <span>·</span>
                <span>{update.category}</span>
              </>
            )}
            {(update.effective_date_label || update.effective_date) && (
              <>
                <span>·</span>
                <span>
                  Effective:{" "}
                  {update.effective_date_label ??
                    formatDate(update.effective_date as string)}
                </span>
              </>
            )}
          </div>
        </div>
        <span
          className={cn(
            "inline-block text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded border shrink-0",
            update.section === "enforcement"
              ? "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
              : "bg-primary/10 text-primary border-primary/20",
          )}
        >
          {update.section}
        </span>
      </header>

      {update.body && (
        <div className="mt-2 text-[12px] leading-relaxed text-foreground/90 whitespace-pre-wrap">
          {update.body}
        </div>
      )}

      {update.useful_links.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {update.useful_links.map((ln) => (
            <a
              key={ln.url}
              href={ln.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md border border-border bg-secondary/50 hover:bg-secondary text-foreground/80 hover:text-foreground"
            >
              {ln.label}
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          ))}
        </div>
      )}
    </article>
  );
}
