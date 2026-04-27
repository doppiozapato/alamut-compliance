import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Building2, Briefcase } from "lucide-react";
import type { ComplianceObligation } from "@shared/schema";
import { cn, daysUntil, formatDate, statusBadgeClass } from "@/lib/utils";

const HB = "https://handbook.fca.org.uk/handbook";

export default function CalendarPage() {
  const { data: obligations = [] } = useQuery<ComplianceObligation[]>({
    queryKey: ["/api/obligations"],
  });
  const [scope, setScope] = useState<"all" | "firm" | "fund">("all");

  const filtered = useMemo(() => {
    if (scope === "all") return obligations;
    return obligations.filter((o) => o.scope === scope || o.scope === "both");
  }, [obligations, scope]);

  const grouped = useMemo(() => {
    const out: Record<string, ComplianceObligation[]> = {};
    for (const o of filtered) {
      const month = o.next_due.slice(0, 7); // YYYY-MM
      (out[month] ??= []).push(o);
    }
    return out;
  }, [filtered]);

  const months = Object.keys(grouped).sort();

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4" />
          <h1 className="text-base font-semibold">Compliance Calendar</h1>
        </div>
        <div className="flex items-center gap-1.5">
          {(["all", "firm", "fund"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={cn(
                "text-[11px] px-2.5 py-1 rounded-md border transition-colors",
                scope === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-card hover:bg-secondary",
              )}
            >
              {s === "all" ? "All" : s === "firm" ? "Firm" : "Fund"}
            </button>
          ))}
        </div>
      </div>

      {months.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8 text-center">
          No obligations match the current filter.
        </p>
      ) : (
        months.map((m) => (
          <section key={m} className="mb-6">
            <h2 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
              {new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", {
                month: "long",
                year: "numeric",
              })}
            </h2>
            <div className="space-y-2">
              {grouped[m]
                .sort((a, b) => a.next_due.localeCompare(b.next_due))
                .map((o) => {
                  const days = daysUntil(o.next_due);
                  const isOverdue =
                    o.status === "overdue" || (days < 0 && o.status !== "submitted");
                  return (
                    <div
                      key={o.id}
                      className={cn(
                        "bg-card border rounded-lg px-4 py-3 flex items-start justify-between gap-3",
                        isOverdue
                          ? "border-red-300 dark:border-red-900/60"
                          : "border-border",
                      )}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {o.scope === "fund" ? (
                            <Briefcase className="w-3 h-3 text-muted-foreground" />
                          ) : (
                            <Building2 className="w-3 h-3 text-muted-foreground" />
                          )}
                          <p className="text-xs font-medium">{o.title}</p>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {o.scope === "firm"
                            ? "Firm"
                            : o.scope === "fund"
                            ? "Fund"
                            : "Firm / Fund"}{" "}
                          · {o.category} · {o.frequency.replace("_", " ")} ·{" "}
                          {o.owner ?? "Unassigned"}
                        </p>
                        {o.notes && (
                          <p className="text-[11px] text-muted-foreground mt-1">{o.notes}</p>
                        )}
                        {o.fca_refs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {o.fca_refs.map((r) => {
                              const code = r.split(/\s/)[0];
                              return (
                                <a
                                  key={r}
                                  href={`${HB}/${code}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                                >
                                  {r}
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={cn(
                            "text-xs font-medium",
                            isOverdue ? "text-red-600 dark:text-red-400" : "text-foreground",
                          )}
                        >
                          {formatDate(o.next_due)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {isOverdue ? `${Math.abs(days)}d overdue` : `in ${days}d`}
                        </p>
                        <span
                          className={cn(
                            "inline-block mt-1 text-[9px] uppercase px-1.5 py-0.5 rounded border",
                            statusBadgeClass(o.status),
                          )}
                        >
                          {o.status.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
