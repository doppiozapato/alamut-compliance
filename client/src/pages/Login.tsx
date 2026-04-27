import { useEffect, useState } from "react";
import { Lock, ChevronRight } from "lucide-react";
import { login, type CurrentUser } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import AlamutLogo from "@/components/AlamutLogo";

interface Preset {
  label: string;
  email: string;
  role: string;
}

interface Props {
  onAuth: (u: CurrentUser) => void;
}

export default function Login({ onAuth }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [presets, setPresets] = useState<Preset[]>([]);

  useEffect(() => {
    apiRequest("GET", "/api/auth/presets")
      .then((r) => (r.ok ? r.json() : { presets: [] }))
      .then((j) => setPresets(j.presets ?? []))
      .catch(() => setPresets([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(email, password);
      if (u) onAuth(u);
      else setError("Invalid credentials. Please try again.");
    } catch {
      setError("Connection error. Please retry.");
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(p: Preset) {
    setEmail(p.email);
    // Demo passwords match `role + 2026` for the seed users.
    const guess = `${p.role}2026`;
    setPassword(guess);
    setError("");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: "#ffffff" }}>
      <div className="w-full max-w-md">
        <div className="mb-10 flex flex-col items-center gap-3">
          <AlamutLogo />
        </div>

        <div className="bg-card border border-border rounded-lg p-6">
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Sign in</h2>
          </div>
          <p className="text-xs text-muted-foreground mb-5">
            Use your team credentials to access the Compliance Dashboard.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@alamut.com"
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                required
              />
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full text-xs font-medium px-3 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          {presets.length > 0 && (
            <div className="mt-5 pt-4 border-t border-border">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                Quick switch (demo)
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                {presets.map((p) => (
                  <button
                    key={p.email}
                    type="button"
                    onClick={() => applyPreset(p)}
                    className="text-[11px] flex items-center justify-between px-2.5 py-1.5 rounded-md border border-border bg-background hover:bg-secondary text-left transition-colors"
                  >
                    <span>{p.label}</span>
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Demo passwords: <span className="font-mono">role+2026</span> (e.g. <span className="font-mono">admin2026</span>).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
