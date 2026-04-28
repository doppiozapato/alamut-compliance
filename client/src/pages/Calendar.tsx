import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Building2,
  Briefcase,
  CheckCircle2,
  MessageSquare,
  Loader2,
  CalendarClock,
} from "lucide-react";
import type { ComplianceObligation } from "@shared/schema";
import { nextDueAfter } from "@shared/schema";
import { cn, daysUntil, formatDate, statusBadgeClass } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { getCurrentUser, hasRole } from "@/lib/auth";

const HB = "https://handbook.fca.org.uk/handbook";

const FREQUENCY_LABEL: Record<ComplianceObligation["frequency"], string> = {
  annual: "annual",
  semi_annual: "semi annual",
  quarterly: "quarterly",
  monthly: "monthly",
  ad_hoc: "ad hoc",
};

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
    setDraftComment("");
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
                  const isLockedSubmitted = o.status === "submitted";
                  const isOverdue =
                    o.status === "overdue" ||
                    (days < 0 && !isLockedSubmitted);
                  const isEditing = editingId === o.id;
                  const isPending =
                    submitMutation.isPending &&
                    submitMutation.variables?.id === o.id;
                  const hasLastSubmission = !!o.submitted_at;
                  const projectedNext =
                    o.frequency !== "ad_hoc"
                      ? nextDueAfter(o.next_due, o.frequency)
                      : null;
                  return (
                    <div
                      key={o.id}
                      className={cn(
                        "bg-card border rounded-lg px-4 py-3",
                        isLockedSubmitted
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
                            · {o.category} · {FREQUENCY_LABEL[o.frequency]} ·{" "}
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
                          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                            Next due
                          </p>
                          <p
                            className={cn(
                              "text-xs font-semibold",
                              isOverdue
                                ? "text-red-600 dark:text-red-400"
                                : "text-foreground",
                            )}
                          >
                            {formatDate(o.next_due)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {isLockedSubmitted
                              ? "submitted"
                              : isOverdue
                                ? `${Math.abs(days)}d overdue`
                                : days === 0
                                  ? "due today"
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

                      {/* Last-submission band — always visible once a
                          submission has been recorded, so the next due
                          date above stays prominent. */}
                      {hasLastSubmission && !isEditing && (
                        <div className="mt-2 pt-2 border-t border-border/60">
                          <div className="flex items-start gap-1.5 text-[11px]">
                            <CheckCircle2 className="w-3 h-3 mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            <div className="min-w-0 flex-1">
                              <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                                Submitted
                                {o.submitted_at
                                  ? ` on ${formatDate(o.submitted_at)}`
                                  : ""}
                                {o.submitted_by_name
                                  ? ` by ${o.submitted_by_name}`
                                  : ""}
                                .
                              </p>
                              {o.submission_comment && (
                                <p className="mt-0.5 text-muted-foreground whitespace-pre-wrap">
                                  <MessageSquare className="w-3 h-3 inline-block mr-1 -mt-0.5" />
                                  {o.submission_comment}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      )}

                      {canSubmit && !isEditing && (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          {projectedNext && !isLockedSubmitted ? (
                            <p className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
                              <CalendarClock className="w-3 h-3" />
                              After this filing, next due rolls to{" "}
                              <span className="font-medium text-foreground">
                                {formatDate(projectedNext)}
                              </span>
                            </p>
                          ) : (
                            <span />
                          )}
                          <button
                            onClick={() => startEditing(o)}
                            className={cn(
                              "text-[11px] px-3 py-1.5 rounded-md border transition-colors inline-flex items-center gap-1.5 font-medium",
                              hasLastSubmission
                                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-950/60"
                                : "bg-primary text-primary-foreground border-primary hover:opacity-90",
                            )}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            {hasLastSubmission
                              ? `Submitted${
                                  o.submitted_at
                                    ? ` ${formatDate(o.submitted_at)}`
                                    : ""
                                }`
                              : "Record submitted"}
                          </button>
                        </div>
                      )}

                      {!canSubmit && hasLastSubmission && (
                        <div className="mt-2 flex items-center justify-end">
                          <span className="text-[11px] px-3 py-1.5 rounded-md border bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 inline-flex items-center gap-1.5 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            Submitted
                            {o.submitted_at
                              ? ` ${formatDate(o.submitted_at)}`
                              : ""}
                          </span>
                        </div>
                      )}

                      {canSubmit && isEditing && (
                        <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
                          <div className="flex items-start gap-2 text-[11px] text-muted-foreground">
                            <CalendarClock className="w-3 h-3 mt-0.5 shrink-0" />
                            <p>
                              Recording this filing will mark{" "}
                              <span className="font-medium text-foreground">
                                {formatDate(o.next_due)}
                              </span>{" "}
                              as submitted
                              {projectedNext ? (
                                <>
                                  {" "}and roll the next due date forward to{" "}
                                  <span className="font-medium text-foreground">
                                    {formatDate(projectedNext)}
                                  </span>
                                  .
                                </>
                              ) : (
                                <>. This obligation is ad hoc, so no next due date will be scheduled automatically.</>
                              )}
                            </p>
                          </div>
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
                            {hasLastSubmission && (
                              <button
                                onClick={() =>
                                  submitMutation.mutate({
                                    id: o.id,
                                    submitted: false,
                                    comment: null,
                                  })
                                }
                                disabled={isPending}
                                className="text-[11px] px-2.5 py-1 rounded-md border border-border bg-card hover:bg-secondary transition-colors disabled:opacity-50"
                              >
                                Clear last submission
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
                              Confirm submitted
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
