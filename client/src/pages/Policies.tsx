import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Shield, Search, ChevronRight, BookOpen, AlertTriangle, LogIn } from "lucide-react";
import type { ManualChapter } from "@shared/schema";
import { ApiError } from "@/lib/queryClient";
import { logout } from "@/lib/auth";

// Curated mapping of chapter/appendix slugs to a Policies "category". The
// categories are derived structurally from the manual — no policy text is
// invented here. Each entry points the user back at the underlying manual
// chapter so the source-of-truth stays in one place.
//
// The matcher is permissive: any chapter whose title or slug contains the
// keyword falls into that category. Slugs that match more than one keyword
// land in the first matching category to keep the list deterministic.
type PolicyCategory = {
  key: string;
  label: string;
  description: string;
  matchers: RegExp[];
};

const CATEGORIES: PolicyCategory[] = [
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
    matchers: [
      /aifm/i,
      /emir/i,
      /commodity[- ]derivatives/i,
      /inducements/i,
    ],
  },
];

const FALLBACK_CATEGORY: PolicyCategory = {
  key: "other",
  label: "Other",
  description: "Other manual chapters and appendices.",
  matchers: [],
};

function categorise(c: ManualChapter): PolicyCategory {
  const haystack = `${c.title} ${c.slug}`;
  for (const cat of CATEGORIES) {
    if (cat.matchers.some((re) => re.test(haystack))) return cat;
  }
  return FALLBACK_CATEGORY;
}

interface CategoryGroup {
  category: PolicyCategory;
  items: ManualChapter[];
}

export default function Policies() {
  const { data: chapters = [], isLoading, isError, error, refetch, isFetching } = useQuery<ManualChapter[]>({
    queryKey: ["/api/manual/chapters"],
  });
  const status = error instanceof ApiError ? error.status : null;
  const isUnauthenticated = status === 401;
  const [q, setQ] = useState("");
  const [activeKey, setActiveKey] = useState<string | "all">("all");

  const groups: CategoryGroup[] = useMemo(() => {
    const byKey = new Map<string, CategoryGroup>();
    for (const cat of [...CATEGORIES, FALLBACK_CATEGORY]) {
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

  return (
    <div className="px-6 py-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-2 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4" />
          <h1 className="text-base font-semibold">Policies</h1>
          {totalPolicies > 0 && (
            <span className="text-[11px] text-muted-foreground">· {totalPolicies} policies</span>
          )}
        </div>
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
      <p className="text-[11px] text-muted-foreground mb-5 flex items-center gap-1.5">
        <BookOpen className="w-3 h-3" /> Policy library derived from the firm's Compliance
        Manual. Click any policy to open the full chapter.
      </p>

      {isLoading ? (
        <p className="text-xs text-muted-foreground py-8">Loading policies…</p>
      ) : isUnauthenticated ? (
        <div className="py-10 max-w-md rounded-lg border border-amber-500/40 bg-amber-500/5 px-5 py-5">
          <div className="flex items-start gap-2.5 mb-2">
            <LogIn className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Your session has expired
              </p>
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
      ) : isError ? (
        <div className="py-10 max-w-md rounded-lg border border-destructive/40 bg-destructive/5 px-5 py-5">
          <div className="flex items-start gap-2.5 mb-2">
            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Couldn't load the policy library
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                The server returned an error while fetching chapters.
              </p>
              <p className="text-[10px] font-mono text-muted-foreground/80 mt-2 break-all">
                {status ? `HTTP ${status}` : "network error"}
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={isFetching}
            onClick={() => refetch()}
            className="text-xs font-medium px-3 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity mt-2"
          >
            {isFetching ? "Retrying…" : "Retry"}
          </button>
        </div>
      ) : groups.length === 0 ? (
        <p className="text-xs text-muted-foreground py-8">
          No policies available yet. They will appear here once the compliance manual has been
          imported.
        </p>
      ) : (
        <>
          <CategoryChips
            groups={groups}
            active={activeKey}
            onSelect={(k) => setActiveKey(k)}
          />

          {filteredGroups.length === 0 ? (
            <p className="text-xs text-muted-foreground py-8">No policies match your search.</p>
          ) : (
            <div className="space-y-8 mt-6">
              {filteredGroups.map((g) => (
                <CategoryBlock key={g.category.key} group={g} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CategoryChips({
  groups,
  active,
  onSelect,
}: {
  groups: CategoryGroup[];
  active: string;
  onSelect: (key: string | "all") => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5 mt-3">
      <Chip label={`All · ${groups.reduce((n, g) => n + g.items.length, 0)}`} active={active === "all"} onClick={() => onSelect("all")} />
      {groups.map((g) => (
        <Chip
          key={g.category.key}
          label={`${g.category.label} · ${g.items.length}`}
          active={active === g.category.key}
          onClick={() => onSelect(g.category.key)}
        />
      ))}
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
