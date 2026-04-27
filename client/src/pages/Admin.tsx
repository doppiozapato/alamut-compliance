import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Settings, Users, ChevronRight, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react";
import type { Attestation, TeamMember } from "@shared/schema";
import { cn, formatDate, ROLE_LABELS, statusBadgeClass } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";

interface TeamSummary extends TeamMember {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

export default function Admin() {
  const user = getCurrentUser();
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: team = [] } = useQuery<TeamSummary[]>({
    queryKey: ["/api/admin/team"],
    enabled: user?.role === "admin",
  });
  const { data: detail = [] } = useQuery<Attestation[]>({
    queryKey: [`/api/admin/team/${selectedId}/attestations`],
    enabled: !!selectedId,
  });

  if (user?.role !== "admin") {
    return (
      <div className="px-6 py-6 max-w-2xl mx-auto">
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-amber-500" />
          <p className="text-sm font-medium">Restricted</p>
          <p className="text-xs text-muted-foreground mt-1">
            Admin oversight is available to senior admin accounts only.
          </p>
        </div>
      </div>
    );
  }

  if (selectedId) {
    const member = team.find((t) => t.id === selectedId);
    return (
      <div className="px-6 py-6 max-w-4xl mx-auto">
        <button
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-3 h-3" /> Back to team
        </button>
        {member && (
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {ROLE_LABELS[member.role] ?? member.role}
            </p>
            <h1 className="text-base font-semibold mt-0.5">{member.full_name}</h1>
            <p className="text-xs text-muted-foreground">{member.email}</p>
          </div>
        )}
        <div className="space-y-2">
          {detail.length === 0 ? (
            <p className="text-xs text-muted-foreground">No attestations.</p>
          ) : (
            detail.map((a) => (
              <div
                key={a.id}
                className="bg-card border border-border rounded-lg px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium">{a.topic}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {a.category} · due {formatDate(a.due_date)}
                    {a.completed_at ? ` · completed ${formatDate(a.completed_at)}` : ""}
                  </p>
                  {a.comment && (
                    <p className="text-[11px] text-muted-foreground italic mt-1">"{a.comment}"</p>
                  )}
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
      </div>
    );
  }

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Settings className="w-4 h-4" />
        <h1 className="text-base font-semibold">Admin · Team Oversight</h1>
      </div>
      <p className="text-xs text-muted-foreground mb-5">
        Review attestation status across the team. Click a member to drill into their record.
      </p>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 border-b border-border bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
          <div className="col-span-4 flex items-center gap-1.5">
            <Users className="w-3 h-3" /> Member
          </div>
          <div className="col-span-2">Role</div>
          <div className="col-span-2 text-right">Completed</div>
          <div className="col-span-2 text-right">Pending</div>
          <div className="col-span-2 text-right">Overdue</div>
        </div>
        {team.map((m) => (
          <button
            key={m.id}
            onClick={() => setSelectedId(m.id)}
            className="w-full grid grid-cols-12 px-4 py-2.5 border-b border-border last:border-0 text-xs hover:bg-secondary/40 transition-colors text-left"
          >
            <div className="col-span-4 flex items-center gap-2">
              <div>
                <p className="font-medium">{m.full_name}</p>
                <p className="text-[10px] text-muted-foreground">{m.email}</p>
              </div>
            </div>
            <div className="col-span-2 text-[11px] text-muted-foreground self-center">
              {ROLE_LABELS[m.role] ?? m.role}
            </div>
            <div className="col-span-2 text-right self-center text-emerald-600 dark:text-emerald-400 inline-flex items-center justify-end gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {m.completed}
            </div>
            <div className="col-span-2 text-right self-center text-amber-600 dark:text-amber-400">
              {m.pending}
            </div>
            <div className="col-span-2 text-right self-center text-red-600 dark:text-red-400 inline-flex items-center justify-end gap-1">
              {m.overdue > 0 && <AlertTriangle className="w-3 h-3" />}
              {m.overdue}
              <ChevronRight className="w-3 h-3 text-muted-foreground ml-1" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
