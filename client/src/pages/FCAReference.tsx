import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Library, ExternalLink, Search } from "lucide-react";
import type { FcaModule } from "@shared/schema";

interface ApiResp {
  categories: string[];
  modules: FcaModule[];
}

export default function FCAReference() {
  const { data } = useQuery<ApiResp>({ queryKey: ["/api/fca/modules"] });
  const [q, setQ] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredModules = useMemo(() => {
    if (!data) return [];
    let mods = data.modules;
    if (activeCategory) mods = mods.filter((m) => m.category === activeCategory);
    if (q.trim()) {
      const s = q.toLowerCase();
      mods = mods.filter(
        (m) =>
          m.code.toLowerCase().includes(s) ||
          m.title.toLowerCase().includes(s) ||
          (m.description ?? "").toLowerCase().includes(s),
      );
    }
    return mods;
  }, [data, q, activeCategory]);

  const grouped = useMemo(() => {
    const out: Record<string, FcaModule[]> = {};
    for (const m of filteredModules) {
      (out[m.category] ??= []).push(m);
    }
    return out;
  }, [filteredModules]);

  return (
    <div className="px-6 py-6 max-w-6xl mx-auto">
      <div className="flex items-start justify-between mb-5 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Library className="w-4 h-4" />
            <h1 className="text-base font-semibold">FCA Handbook Reference</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            All modules link to the canonical{" "}
            <a
              href="https://handbook.fca.org.uk/handbook"
              target="_blank"
              rel="noreferrer"
              className="text-primary hover:underline inline-flex items-center gap-0.5"
            >
              handbook.fca.org.uk <ExternalLink className="w-2.5 h-2.5" />
            </a>
            .
          </p>
        </div>
        <div className="relative w-72">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search e.g. SYSC, COBS, market abuse…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Category pills */}
      {data && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          <button
            onClick={() => setActiveCategory(null)}
            className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
              activeCategory === null
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border bg-card hover:bg-secondary"
            }`}
          >
            All
          </button>
          {data.categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat === activeCategory ? null : cat)}
              className={`text-[11px] px-2.5 py-1 rounded-md border transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border bg-card hover:bg-secondary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {Object.entries(grouped).map(([cat, mods]) => (
        <section key={cat} className="mb-6">
          <h2 className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
            {cat}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {mods.map((m) => (
              <a
                key={m.code}
                href={m.url}
                target="_blank"
                rel="noreferrer"
                className="group bg-card border border-border rounded-lg p-3 hover:border-primary/40 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-mono font-semibold text-primary">{m.code}</p>
                    <p className="text-[11px] font-medium mt-0.5">{m.title}</p>
                    {m.description && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                        {m.description}
                      </p>
                    )}
                  </div>
                  <ExternalLink className="w-3 h-3 text-muted-foreground group-hover:text-primary shrink-0" />
                </div>
              </a>
            ))}
          </div>
        </section>
      ))}

      {filteredModules.length === 0 && (
        <p className="text-xs text-muted-foreground py-8 text-center">No modules match.</p>
      )}
    </div>
  );
}
