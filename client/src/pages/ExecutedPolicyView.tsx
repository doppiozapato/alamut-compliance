import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, FileText, Calendar as CalendarIcon, AlertTriangle, LogIn } from "lucide-react";
import type { ExecutedPolicy } from "@shared/schema";
import { ApiError } from "@/lib/queryClient";
import { logout } from "@/lib/auth";

interface Props {
  slug: string;
}

export default function ExecutedPolicyView({ slug }: Props) {
  const { data: policy, isLoading, isError, error } = useQuery<ExecutedPolicy>({
    queryKey: [`/api/executed-policies/${slug}`],
  });
  const status = error instanceof ApiError ? error.status : null;
  const isUnauthenticated = status === 401;

  if (isLoading) {
    return (
      <div className="px-6 py-6 max-w-4xl mx-auto">
        <p className="text-xs text-muted-foreground">Loading policy…</p>
      </div>
    );
  }

  if (isUnauthenticated) {
    return (
      <div className="px-6 py-6 max-w-4xl mx-auto">
        <div className="py-10 max-w-md rounded-lg border border-amber-500/40 bg-amber-500/5 px-5 py-5">
          <div className="flex items-start gap-2.5 mb-2">
            <LogIn className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Your session has expired</p>
              <p className="text-xs text-muted-foreground mt-1">
                Please sign in again to view this policy.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await logout();
              window.location.hash = "";
              window.location.reload();
            }}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity mt-2"
          >
            Sign in again
          </button>
        </div>
      </div>
    );
  }

  if (isError || !policy) {
    return (
      <div className="px-6 py-6 max-w-4xl mx-auto">
        <div className="py-10 max-w-md rounded-lg border border-destructive/40 bg-destructive/5 px-5 py-5">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">Policy not found</p>
              <p className="text-xs text-muted-foreground mt-1">
                The policy you requested could not be loaded.
              </p>
            </div>
          </div>
          <Link href="/policies">
            <a className="inline-flex items-center gap-1 mt-3 text-xs text-primary hover:underline">
              <ArrowLeft className="w-3 h-3" /> Back to policies
            </a>
          </Link>
        </div>
      </div>
    );
  }

  const paragraphs = (policy.content ?? "").split(/\n\n+/).filter((p) => p.trim());

  return (
    <div className="px-6 py-6 max-w-4xl mx-auto">
      <Link href="/policies">
        <a className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-3 h-3" /> Back to policies
        </a>
      </Link>

      <div className="flex items-start gap-2 mb-1">
        <FileText className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {policy.category}
          </p>
          <h1 className="text-base font-semibold leading-snug">{policy.title}</h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 mb-5 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <CalendarIcon className="w-3 h-3" /> Effective:{" "}
          {policy.effective_date_label ?? policy.year}
        </span>
        <span>· {policy.page_count} pages</span>
        {policy.version && <span>· version {policy.version}</span>}
        {policy.review_status && policy.review_status !== "current" && (
          <span className="inline-flex items-center gap-1 text-amber-600">
            <AlertTriangle className="w-3 h-3" />
            {policy.review_status.replace("_", " ")}
          </span>
        )}
      </div>

      {policy.summary && (
        <div className="bg-muted/40 border border-border rounded-md px-4 py-3 mb-5">
          <p className="text-xs text-foreground/90 leading-relaxed">{policy.summary}</p>
        </div>
      )}

      {policy.source_filename && (
        <p className="text-[10.5px] text-muted-foreground mb-5">
          Source PDF:{" "}
          <code className="font-mono">{policy.source_filename}</code>. The signed source
          document is held in the firm's policy library; this view shows the extracted text.
        </p>
      )}

      <article className="prose prose-sm max-w-none policy-body">
        {paragraphs.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Full text is not yet available for this policy.
          </p>
        ) : (
          paragraphs.map((p, i) => (
            <p key={i} className="text-[12.5px] leading-relaxed mb-3 whitespace-pre-wrap">
              {p}
            </p>
          ))
        )}
      </article>
    </div>
  );
}
