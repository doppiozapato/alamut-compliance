import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  BookOpen,
  Library,
  CalendarDays,
  CheckSquare,
  AlertTriangle,
  Users,
  ChevronRight,
  Clock,
} from "lucide-react";
import type {
  DashboardStats,
  ComplianceObligation,
  Attestation,
  ManualChapter,
} from "@shared/schema";
import { cn, daysUntil, formatDate, statusBadgeClass } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";

export default function Dashboard() {
  const user = getCurrentUser();
  const { data: stats } = useQuery<DashboardStats>({ queryKey: ["/api/stats"] });
  const { data: obligations = [] } = useQuery<ComplianceObligation[]>({
    queryKey: ["/api/obligations"],
  });
  const { data: attestations = [] } = useQuery<Attestation[]>({
    queryKey: ["/api/attestations"],
  });
  const { data: chapters = [] } = useQuery<ManualChapter[]>({
    queryKey: ["/api/manual/chapters"],
  });

  const today = new Date().toISOString().slice(0, 10);
  const upcomingObs = obligations
    .filter((o) => o.next_due >= today && o.status !== "submitted")
    .slice(0, 6);
  const overdueObs = obligations.filter(
    (o) => o.status === "overdue" || (o.next_due < today && o.status !== "submitted"),
  );
  const myAttestations = attestations.filter((a) => a.status !== "completed").slice(0, 6);

  const cards = [
    { label: "Manual chapters", value: stats?.totalChapters ?? "—", icon: BookOpen, href: "/manual" },
    { label: "Upcoming obligations", value: stats?.upcomingObligations ?? "—", icon: CalendarDays, href: "/calendar" },
    {
      label: "Overdue",
      value: stats?.overdueObligations ?? "—",
      icon: AlertTriangle,
      href: "/calendar",
      tone: (stats?.overdueObligations ?? 0) > 0 ? "warn" : undefined,
    },
    { label: "Pending attestations", value: stats?.pendingAttestations ?? "—", icon: CheckSquare, href: "/attestations" },
    { label: "Completed attestations", value: stats?.completedAttestations ?? "—", icon: CheckSquare, href: "/attestations" },
    { label: "Team members", value: stats?.teamMembers ?? "—", icon: Users, href: user?.role === "admin" ? "/admin" : "/attestations" },
  ];

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-base font-semibold">Welcome back, {user?.full_name}</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Here is the firm and fund compliance posture as of {formatDate(today)}.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href}>
            <a
              className={cn(
                "block bg-card border border-border rounded-lg p-3.5 transition-colors hover:border-primary/40",
                c.tone === "warn" && "border-red-300 dark:border-red-900/60",
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <c.icon className="w-3.5 h-3.5 text-muted-foreground" />
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              </div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                {c.label}
              </p>
              <p
                className={cn(
                  "text-xl font-semibold",
                  c.tone === "warn" ? "text-red-600 dark:text-red-400" : "text-foreground",
                )}
              >
                {c.value}
              </p>
            </a>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Upcoming + overdue */}
        <section className="lg:col-span-2 bg-card border border-border rounded-lg">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-xs font-semibold flex items-center gap-1.5">
              <CalendarDays className="w-3.5 h-3.5" /> Upcoming obligations
            </h2>
            <Link href="/calendar">
              <a className="text-[11px] text-primary hover:underline">View calendar</a>
            </Link>
          </div>
          {overdueObs.length > 0 && (
            <div className="px-4 pt-3">
              <p className="text-[10px] uppercase tracking-wider text-red-600 dark:text-red-400 mb-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Overdue ({overdueObs.length})
              </p>
              <div className="space-y-1.5 mb-3">
                {overdueObs.slice(0, 3).map((o) => (
                  <ObligationRow key={o.id} o={o} overdue />
                ))}
              </div>
            </div>
          )}
          <div className="px-4 py-3 space-y-1.5">
            {upcomingObs.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                Nothing upcoming. Calendar is clear.
              </p>
            ) : (
              upcomingObs.map((o) => <ObligationRow key={o.id} o={o} />)
            )}
          </div>
        </section>

        {/* Pending attestations */}
        <section className="bg-card border border-border rounded-lg">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-xs font-semibold flex items-center gap-1.5">
              <CheckSquare className="w-3.5 h-3.5" /> Pending attestations
            </h2>
            <Link href="/attestations">
              <a className="text-[11px] text-primary hover:underline">View all</a>
            </Link>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            {myAttestations.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">
                All attestations complete.
              </p>
            ) : (
              myAttestations.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-3 py-1.5 border-b border-border/50 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="text-[11px] font-medium truncate">{a.topic}</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {a.category} · due {formatDate(a.due_date)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "text-[9px] uppercase px-1.5 py-0.5 rounded border whitespace-nowrap",
                      statusBadgeClass(a.status),
                    )}
                  >
                    {a.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      {/* Manual chapters quick access */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" /> Compliance manual
          </h2>
          <Link href="/manual">
            <a className="text-[11px] text-primary hover:underline">Open manual</a>
          </Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {chapters.slice(0, 6).map((c) => (
            <Link key={c.id} href={`/manual/${c.slug}`}>
              <a className="block bg-card border border-border rounded-lg p-3 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Chapter {c.number}
                    </p>
                    <p className="text-xs font-medium truncate mt-0.5">{c.title}</p>
                    {c.summary && (
                      <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
                        {c.summary}
                      </p>
                    )}
                  </div>
                  <Library className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                </div>
                {c.fca_refs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.fca_refs.slice(0, 4).map((r) => (
                      <span
                        key={r}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </a>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function ObligationRow({ o, overdue }: { o: ComplianceObligation; overdue?: boolean }) {
  const days = daysUntil(o.next_due);
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/50 last:border-0">
      <div className="min-w-0">
        <p className="text-[11px] font-medium truncate">{o.title}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {o.scope === "firm" ? "Firm" : o.scope === "fund" ? "Fund" : "Firm / Fund"} ·{" "}
          {o.category} · {o.fca_refs.join(", ") || "—"}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p
          className={cn(
            "text-[11px] font-medium",
            overdue ? "text-red-600 dark:text-red-400" : "text-foreground",
          )}
        >
          {formatDate(o.next_due)}
        </p>
        <p className="text-[10px] text-muted-foreground flex items-center gap-1 justify-end">
          <Clock className="w-3 h-3" />
          {overdue ? `${Math.abs(days)}d overdue` : `${days}d`}
        </p>
      </div>
    </div>
  );
}
