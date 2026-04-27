import { useState } from "react";
import { Lock } from "lucide-react";
import { login, type CurrentUser } from "@/lib/auth";
import AlamutLogo from "@/components/AlamutLogo";

interface Props {
  onAuth: (u: CurrentUser) => void;
}

export default function Login({ onAuth }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
                placeholder="you@alamut-im.com"
                className="w-full px-3 py-2 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
                required
                autoComplete="email"
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
                autoComplete="current-password"
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
        </div>
      </div>
    </div>
  );
}
