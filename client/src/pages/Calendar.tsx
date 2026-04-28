import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Building2,
  Briefcase,
  CheckCircle2,
  MessageSquare,
  Loader2,
} from "lucide-react";
import type { ComplianceObligation } from "@shared/schema";
import { cn, daysUntil, formatDate, statusBadgeClass } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentUser, hasRole } from "@/lib/auth";

const HB = "https://handbook.fca.org.uk/handbook";

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const { data: obligations = [] } = useQuery<ComplianceObligation[]>({
    queryKey: ["/api/obligations"],
  });
  const [scope, setScope] = useState<"all" | "firm" | "fund">("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draftComment, setDraftComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  const currentUser = getCurrentUser();
  const canSubmit = hasRole("admin", "compliance");

  const submitMutation = useMutation({
    mutationFn: async (vars: {
      id: number;
      submitted: boolean;
      comment: string | null;
    }) => {
      const res = await apiRequest("POST", `/api/obligations/${vars.id}/submit`, {
        submitted: vars.submitted,
        comment: vars.comment,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || `Request failed (${res.status})`);
      }
      return (await res.json()) as ComplianceObligation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/obligations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      setEditingId(null);
      setDraftComment("");
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

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

  const startEditing = (o: ComplianceObligation) => {
    setEditingId(o.id);
    setDraftComment(o.submission_comment ?? "");
    setError(null);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setDraftComment("");
    setError(null);
  };

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
                  const isSubmitted = o.status === "submitted";
                  const isOverdue =
                    o.status === "overdue" || (days < 0 && !isSubmitted);
                  const isEditing = editingId === o.id;
                  const isPending =
                    submitMutation.isPending &&
                    submitMutation.variables?.id === o.id;
                  return (
                    <div
                      key={o.id}
                      className={cn(
                        "bg-card border rounded-lg px-4 py-3",
                        isSubmitted
                          ? "border-emerald-300 dark:border-emerald-900/60"
                          : isOverdue
                            ? "border-red-300 dark:border-red-900/60"
                            : "border-border",
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
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
                            <p className="text-[11px] text-muted-foreground mt-1">
                              {o.notes}
                            </p>
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
                              isOverdue
                                ? "text-red-600 dark:text-red-400"
                                : "text-foreground",
                            )}
                          >
                            {formatDate(o.next_due)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {isSubmitted
                              ? "submitted"
                              : isOverdue
                                ? `${Math.abs(days)}d overdue`
                                : `in ${days}d`}
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

                      {(isSubmitted || o.submission_comment) && !isEditing && (
                        <div className="mt-2 pt-2 border-t border-border/60 text-[11px] text-muted-foreground">
                          <div className="flex items-start gap-1.5">
                            <CheckCircle2
                              className={cn(
                                "w-3 h-3 mt-0.5 shrink-0",
                                isSubmitted
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-muted-foreground",
                              )}
                            />
                            <div className="min-w-0">
                              {isSubmitted && (
                                <p>
                                  Submitted
                                  {o.submitted_at
                                    ? ` on ${formatDate(o.submitted_at)}`
                                    : ""}
                                  {o.submitted_by_name
                                    ? ` by ${o.submitted_by_name}`
                                    : ""}
                                  .
                                </p>
                              )}
                              {o.submission_comment && (
                                <p className="mt-0.5 whitespace-pre-wrap">
                                  <MessageSquare className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                                  {o.submission_comment}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {canSubmit && !isEditing && (
                        <div className="mt-2 flex items-center justify-end gap-2">
                          <button
                            onClick={() => startEditing(o)}
                            className="text-[11px] px-2.5 py-1 rounded-md border border-border bg-card hover:bg-secondary transition-colors"
                          >
                            {isSubmitted
                              ? "Edit submission"
                              : "Mark as submitted…"}
                          </button>
                        </div>
                      )}

                      {canSubmit && isEditing && (
                        <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                          <label className="block text-[10px] uppercase tracking-wider text-muted-foreground">
                            Submission comments
                          </label>
                          <textarea
                            value={draftComment}
                            onChange={(e) => setDraftComment(e.target.value)}
                            rows={3}
                            maxLength={4000}
                            placeholder="Optional notes about this submission (filing reference, caveats, etc.)"
                            className="w-full text-xs px-2 py-1.5 rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                            disabled={isPending}
                          />
                          {error && (
                            <p className="text-[11px] text-red-600 dark:text-red-400">
                              {error}
                            </p>
                          )}
                          <div className="flex items-center justify-end gap-2">
                            {isSubmitted && (
                              <button
                                onClick={() =>
                                  submitMutation.mutate({
                                    id: o.id,
                                    submitted: false,
                                    comment:
                                      draftComment.trim() === ""
                                        ? null
                                        : draftComment,
                                  })
                                }
                                disabled={isPending}
                                className="text-[11px] px-2.5 py-1 rounded-md border border-border bg-card hover:bg-secondary transition-colors disabled:opacity-50"
                              >
                                Mark as not submitted
                              </button>
                            )}
                            <button
                              onClick={cancelEditing}
                              disabled={isPending}
                              className="text-[11px] px-2.5 py-1 rounded-md border border-border bg-card hover:bg-secondary transition-colors disabled:opacity-50"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() =>
                                submitMutation.mutate({
                                  id: o.id,
                                  submitted: true,
                                  comment:
                                    draftComment.trim() === ""
                                      ? null
                                      : draftComment,
                                })
                              }
                              disabled={isPending}
                              className="text-[11px] px-2.5 py-1 rounded-md bg-primary text-primary-foreground border border-primary hover:opacity-90 transition-opacity disabled:opacity-50 inline-flex items-center gap-1"
                            >
                              {isPending && (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              )}
                              {isSubmitted
                                ? "Update submission"
                                : "Confirm submitted"}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </section>
        ))
      )}

      {!canSubmit && currentUser && (
        <p className="text-[10px] text-muted-foreground mt-4 text-center">
          Only admin and compliance users can record submissions.
        </p>
      )}
    </div>
  );
}
