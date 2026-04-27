import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckSquare, CheckCircle2, ChevronRight } from "lucide-react";
import type { Attestation } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { cn, formatDate, statusBadgeClass } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";

export default function AttestationsPage() {
  const user = getCurrentUser();
  const qc = useQueryClient();
  const { data: rows = [] } = useQuery<Attestation[]>({ queryKey: ["/api/attestations"] });
  const [openId, setOpenId] = useState<number | null>(null);
  const [comment, setComment] = useState("");

  const complete = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/attestations/${id}/complete`, {
        comment: comment.trim() || null,
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attestations"] });
      qc.invalidateQueries({ queryKey: ["/api/stats"] });
      setOpenId(null);
      setComment("");
    },
  });

  // Filter to current user's attestations regardless of role.
  const mine = rows.filter((r) => r.user_id === user?.id);
  const pending = mine.filter((r) => r.status !== "completed");
  const completed = mine.filter((r) => r.status === "completed");

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <CheckSquare className="w-4 h-4" />
        <h1 className="text-base font-semibold">Attestations</h1>
      </div>
      <p className="text-xs text-muted-foreground mb-5">
        Complete each attestation to confirm acknowledgement. Compliance and admin can
        view team-wide records via the{" "}
        <span className="text-foreground font-medium">Admin</span> tab.
      </p>

      <section className="mb-6">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Pending ({pending.length})
        </p>
        {pending.length === 0 ? (
          <div className="bg-card border border-border rounded-lg px-4 py-6 text-center text-xs text-muted-foreground">
            All current attestations completed. 🎉
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((a) => (
              <div key={a.id} className="bg-card border border-border rounded-lg">
                <button
                  onClick={() => {
                    setOpenId(openId === a.id ? null : a.id);
                    setComment("");
                  }}
                  className="w-full flex items-start justify-between gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium">{a.topic}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {a.category} · due {formatDate(a.due_date)} ·{" "}
                      {a.fca_refs.join(", ") || "—"}
                    </p>
                    {a.description && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {a.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={cn(
                        "text-[9px] uppercase px-1.5 py-0.5 rounded border",
                        statusBadgeClass(a.status),
                      )}
                    >
                      {a.status}
                    </span>
                    <ChevronRight
                      className={cn(
                        "w-3.5 h-3.5 text-muted-foreground transition-transform",
                        openId === a.id && "rotate-90",
                      )}
                    />
                  </div>
                </button>
                {openId === a.id && (
                  <div className="border-t border-border px-4 py-3 space-y-2">
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      Acknowledgement comment (optional)
                    </label>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      rows={2}
                      placeholder="I have read and will adhere to…"
                      className="w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setOpenId(null);
                          setComment("");
                        }}
                        className="text-[11px] px-2.5 py-1 rounded-md border border-border bg-background hover:bg-secondary"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={complete.isPending}
                        onClick={() => complete.mutate(a.id)}
                        className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        {complete.isPending ? "Saving…" : "Mark complete"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Completed ({completed.length})
        </p>
        {completed.length === 0 ? (
          <p className="text-xs text-muted-foreground py-3">No completed attestations yet.</p>
        ) : (
          <div className="space-y-1.5">
            {completed.map((a) => (
              <div
                key={a.id}
                className="bg-card border border-border rounded-lg px-4 py-2.5 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-[11px] font-medium">{a.topic}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Completed {formatDate(a.completed_at)} · {a.category}
                  </p>
                  {a.comment && (
                    <p className="text-[11px] text-muted-foreground mt-1 italic">
                      "{a.comment}"
                    </p>
                  )}
                </div>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
