import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Shield,
  Search,
  ChevronRight,
  BookOpen,
  AlertTriangle,
  LogIn,
  FileText,
  Calendar as CalendarIcon,
  Layers,
} from "lucide-react";
import type { ManualChapter, ExecutedPolicy } from "@shared/schema";
import { ApiError } from "@/lib/queryClient";
import { logout } from "@/lib/auth";

// Two distinct policy surfaces:
//   1. "Manual" — categorised links into Compliance Manual chapters that
//      describe the firm's policy *guidance*. Source of truth lives in the
//      manual itself; clicking opens the chapter.
//   2. "Executed" — operative signed/dated firm policies (PDF imports). These
//      are standalone documents with a year, page count, and full extracted
//      text accessible inline.

type PolicyTab = "executed" | "manual";

type ManualPolicyCategory = {
  key: string;
  label: string;
  description: string;
  matchers: RegExp[];
};

const MANUAL_CATEGORIES: ManualPolicyCategory[] = [
  {
    key: "conduct",
    label: "Conduct & Client Treatment",
    description:
      "Policies governing how the firm treats clients, communicates with them and ensures fair outcomes.",
    matchers: [
      /conduct[- ]of[- ]business/i,
      /treating[- ]customers[- ]fairly/i,
      /tcf/i,
      /suitability/i,
      /appropriateness/i,
      /complaints/i,
      /product[- ]governance/i,
      /client[- ]categorisation/i,
      /reporting[- ]to[- ]clients/i,
    ],
  },
  {
    key: "market-integrity",
    label: "Market Integrity",
    description:
      "Market abuse, insider information, rumours and personal account dealing controls.",
    matchers: [
      /market[- ]abuse/i,
      /rumour/i,
      /personal[- ]account[- ]dealing/i,
      /short[- ]selling/i,
      /transaction[- ]reporting/i,
      /trade[- ]reporting/i,
    ],
  },
  {
    key: "financial-crime",
    label: "Financial Crime",
    description:
      "Anti-money-laundering, anti-bribery, fraud and sanctions controls.",
    matchers: [
      /financial[- ]crime/i,
      /anti[- ]bribery/i,
      /bribery/i,
      /fraud/i,
      /money[- ]laundering/i,
      /sanctions/i,
    ],
  },
  {
    key: "governance",
    label: "Governance & Senior Management",
    description:
      "SYSC governance map, prescribed responsibilities, fitness & propriety, conflicts of interest.",
    matchers: [
      /senior[- ]management/i,
      /sysc/i,
      /conflicts[- ]of[- ]interest/i,
      /fitness/i,
      /propriety/i,
      /competence/i,
      /outside[- ]business/i,
    ],
  },
  {
    key: "operations",
    label: "Operational Controls",
    description:
      "Record-keeping, telephone & electronic communications, dealing & managing, client money/assets.",
    matchers: [
      /recording[- ]of[- ]telephone/i,
      /electronic[- ]commu/i,
      /telephone[- ]and[- ]electronic/i,
      /dealing[- ]and[- ]managing/i,
      /client[- ]money/i,
      /client[- ]assets/i,
      /recordkeeping/i,
      /record[- ]keeping/i,
    ],
  },
  {
    key: "disclosure",
    label: "Disclosure & Reporting",
    description:
      "Disclosure obligations, sustainability, transparency and notifications to the FCA.",
    matchers: [
      /disclosure/i,
      /transparency/i,
      /sustainability/i,
      /notifying[- ]the[- ]fca/i,
      /reporting[- ]to[- ]and[- ]notifying/i,
      /financial[- ]promotions/i,
      /communicating[- ]with[- ]clients/i,
    ],
  },
  {
    key: "prudential",
    label: "Capital, Liquidity & Prudential",
    description:
      "Regulatory capital, liquidity, MIFIDPRU/IPRU-INV requirements and ICARA.",
    matchers: [
      /regulatory[- ]capital/i,
      /liquidity/i,
      /mifidpru/i,
      /icara/i,
      /prudential/i,
    ],
  },
  {
    key: "structures",
    label: "Fund & AIFM Specific",
    description:
      "AIFMD-specific obligations, EMIR, commodity derivatives and inducements (research).",
    matchers: [/aifm/i, /emir/i, /commodity[- ]derivatives/i, /inducements/i],
  },
];

const FALLBACK_CATEGORY: ManualPolicyCategory = {
  key: "other",
  label: "Other",
  description: "Other manual chapters and appendices.",
  matchers: [],
};

function categorise(c: ManualChapter): ManualPolicyCategory {
  const haystack = `${c.title} ${c.slug}`;
  for (const cat of MANUAL_CATEGORIES) {
    if (cat.matchers.some((re) => re.test(haystack))) return cat;
  }
  return FALLBACK_CATEGORY;
}

interface CategoryGroup {
  category: ManualPolicyCategory;
  items: ManualChapter[];
}

export default function Policies() {
  const [tab, setTab] = useState<PolicyTab>("executed");

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-4 h-4" />
        <h1 className="text-base font-semibold">Policies</h1>
      </div>
      <p className="text-[11px] text-muted-foreground mb-4 flex items-center gap-1.5">
        <BookOpen className="w-3 h-3" /> Operative firm policies and the supporting
        Compliance Manual policy library.
      </p>

      <div className="flex gap-1 mb-5 border-b border-border">
        <TabButton
          active={tab === "executed"}
          onClick={() => setTab("executed")}
          icon={<FileText className="w-3.5 h-3.5" />}
          label="Executed Firm Policies"
        />
        <TabButton
          active={tab === "manual"}
          onClick={() => setTab("manual")}
          icon={<Layers className="w-3.5 h-3.5" />}
          label="Compliance Manual Library"
        />
      </div>

      {tab === "executed" ? <ExecutedPoliciesPanel /> : <ManualPoliciesPanel />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "px-3 py-2 text-xs font-medium border-b-2 transition-colors flex items-center gap-1.5 " +
        (active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground")
      }
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Executed Firm policies ──────────────────────────────────────────────────

function ExecutedPoliciesPanel() {
  const { data: policies = [], isLoading, isError, error, refetch, isFetching } =
    useQuery<ExecutedPolicy[]>({ queryKey: ["/api/executed-policies"] });
  const status = error instanceof ApiError ? error.status : null;
  const isUnauthenticated = status === 401;
  const [q, setQ] = useState("");
  const [activeCat, setActiveCat] = useState<string | "all">("all");

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of policies) {
      map.set(p.category, (map.get(p.category) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [policies]);

  const filtered = useMemo(() => {
    const search = q.trim().toLowerCase();
    return policies
      .filter((p) => activeCat === "all" || p.category === activeCat)
      .filter(
        (p) =>
          !search ||
          p.title.toLowerCase().includes(search) ||
          p.category.toLowerCase().includes(search) ||
          (p.summary ?? "").toLowerCase().includes(search) ||
          String(p.year).includes(search),
      );
  }, [policies, q, activeCat]);

  if (isLoading) {
    return <p className="text-xs text-muted-foreground py-8">Loading executed policies…</p>;
  }
  if (isUnauthenticated) {
    return <SessionExpiredCard />;
  }
  if (isError) {
    return <ErrorCard status={status} onRetry={refetch} retrying={isFetching} />;
  }
  if (policies.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-8">
        No executed firm policies have been imported yet. Run{" "}
        <code className="font-mono text-[10.5px]">script/parseExecutedPolicies.py</code>{" "}
        and the Supabase importer to populate this list.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
        <p className="text-[11px] text-muted-foreground">
          Operative signed firm policies ({policies.length} document
          {policies.length === 1 ? "" : "s"}). Click a card for the full text.
        </p>
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search executed policies…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <Chip
          label={`All · ${policies.length}`}
          active={activeCat === "all"}
          onClick={() => setActiveCat("all")}
        />
        {categories.map((c) => (
          <Chip
            key={c.key}
            label={`${c.key} · ${c.count}`}
            active={activeCat === c.key}
            onClick={() => setActiveCat(c.key)}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-muted-foreground py-6">
          No executed policies match your search.
        </p>
      ) : (
        <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {filtered.map((p) => (
            <li key={p.id}>
              <Link href={`/policies/executed/${p.slug}`}>
                <a className="block bg-card border border-border rounded-lg px-3.5 py-3 hover:border-primary/40 transition-colors h-full">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                        {p.category}
                      </p>
                      <p className="text-[13px] font-semibold mt-0.5 text-primary leading-snug">
                        {p.title}
                      </p>
                      {p.summary && (
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-3">
                          {p.summary}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[10px] text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <CalendarIcon className="w-3 h-3" />
                      {p.effective_date_label ?? p.year}
                    </span>
                    <span>· {p.page_count} pages</span>
                    {p.review_status && p.review_status !== "current" && (
                      <span className="inline-flex items-center gap-1 text-amber-600">
                        <AlertTriangle className="w-3 h-3" />
                        {p.review_status.replace("_", " ")}
                      </span>
                    )}
                  </div>
                </a>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── Manual-derived policy library ───────────────────────────────────────────

function ManualPoliciesPanel() {
  const { data: chapters = [], isLoading, isError, error, refetch, isFetching } =
    useQuery<ManualChapter[]>({ queryKey: ["/api/manual/chapters"] });
  const status = error instanceof ApiError ? error.status : null;
  const isUnauthenticated = status === 401;
  const [q, setQ] = useState("");
  const [activeKey, setActiveKey] = useState<string | "all">("all");

  const groups: CategoryGroup[] = useMemo(() => {
    const byKey = new Map<string, CategoryGroup>();
    for (const cat of [...MANUAL_CATEGORIES, FALLBACK_CATEGORY]) {
      byKey.set(cat.key, { category: cat, items: [] });
    }
    for (const c of chapters) {
      const cat = categorise(c);
      byKey.get(cat.key)!.items.push(c);
    }
    return Array.from(byKey.values()).filter((g) => g.items.length > 0);
  }, [chapters]);

  const filteredGroups: CategoryGroup[] = useMemo(() => {
    const search = q.trim().toLowerCase();
    return groups
      .filter((g) => activeKey === "all" || g.category.key === activeKey)
      .map((g) => ({
        ...g,
        items: search
          ? g.items.filter(
              (c) =>
                c.title.toLowerCase().includes(search) ||
                c.number.toLowerCase().includes(search) ||
                (c.summary ?? "").toLowerCase().includes(search) ||
                c.fca_refs.some((r) => r.toLowerCase().includes(search)) ||
                c.tags.some((t) => t.toLowerCase().includes(search)),
            )
          : g.items,
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, q, activeKey]);

  const totalPolicies = groups.reduce((n, g) => n + g.items.length, 0);

  if (isLoading) {
    return <p className="text-xs text-muted-foreground py-8">Loading manual library…</p>;
  }
  if (isUnauthenticated) {
    return <SessionExpiredCard />;
  }
  if (isError) {
    return <ErrorCard status={status} onRetry={refetch} retrying={isFetching} />;
  }
  if (groups.length === 0) {
    return (
      <p className="text-xs text-muted-foreground py-8">
        No policies available yet. They will appear here once the compliance manual has been
        imported.
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
        <p className="text-[11px] text-muted-foreground">
          Categories derived from the Compliance Manual ({totalPolicies} chapters and
          appendices). Click any card to open the underlying chapter.
        </p>
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search policies, FCA refs, tags…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <Chip
          label={`All · ${totalPolicies}`}
          active={activeKey === "all"}
          onClick={() => setActiveKey("all")}
        />
        {groups.map((g) => (
          <Chip
            key={g.category.key}
            label={`${g.category.label} · ${g.items.length}`}
            active={activeKey === g.category.key}
            onClick={() => setActiveKey(g.category.key)}
          />
        ))}
      </div>

      {filteredGroups.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8">No policies match your search.</p>
      ) : (
        <div className="space-y-8 mt-2">
          {filteredGroups.map((g) => (
            <CategoryBlock key={g.category.key} group={g} />
          ))}
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "text-[11px] px-2.5 py-1 rounded-full border transition-colors " +
        (active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-card text-foreground/80 border-border hover:border-primary/40")
      }
    >
      {label}
    </button>
  );
}

function CategoryBlock({ group }: { group: CategoryGroup }) {
  return (
    <section>
      <div className="mb-2">
        <h2 className="text-sm font-semibold">{group.category.label}</h2>
        <p className="text-[11px] text-muted-foreground">{group.category.description}</p>
      </div>
      <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
        {group.items.map((c) => (
          <li key={c.id}>
            <Link href={`/manual/${c.slug}`}>
              <a className="block bg-card border border-border rounded-lg px-3.5 py-3 hover:border-primary/40 transition-colors h-full">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {c.kind === "appendix" ? "Appendix" : "Chapter"} {c.number}
                    </p>
                    <p className="text-[13px] font-semibold mt-0.5 text-primary leading-snug">
                      {c.title}
                    </p>
                    {c.summary && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-3">
                        {c.summary}
                      </p>
                    )}
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 mt-0.5" />
                </div>
                {c.fca_refs.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {c.fca_refs.slice(0, 4).map((r) => (
                      <span
                        key={r}
                        className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </a>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SessionExpiredCard() {
  return (
    <div className="py-10 max-w-md rounded-lg border border-amber-500/40 bg-amber-500/5 px-5 py-5">
      <div className="flex items-start gap-2.5 mb-2">
        <LogIn className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">Your session has expired</p>
          <p className="text-xs text-muted-foreground mt-1">
            Please sign in again to view the policy library.
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
  );
}

function ErrorCard({
  status,
  onRetry,
  retrying,
}: {
  status: number | null;
  onRetry: () => void;
  retrying: boolean;
}) {
  return (
    <div className="py-10 max-w-md rounded-lg border border-destructive/40 bg-destructive/5 px-5 py-5">
      <div className="flex items-start gap-2.5 mb-2">
        <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            Couldn't load the policy library
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            The server returned an error while fetching the policy list.
          </p>
          <p className="text-[10px] font-mono text-muted-foreground/80 mt-2 break-all">
            {status ? `HTTP ${status}` : "network error"}
          </p>
        </div>
      </div>
      <button
        type="button"
        disabled={retrying}
        onClick={onRetry}
        className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity mt-2"
      >
        {retrying ? "Retrying…" : "Retry"}
      </button>
    </div>
  );
}
