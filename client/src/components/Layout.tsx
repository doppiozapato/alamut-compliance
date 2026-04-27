import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import {
  LayoutDashboard,
  BookOpen,
  Library,
  CalendarDays,
  CheckSquare,
  FileText,
  Settings,
  LogOut,
  Moon,
  Sun,
  Search,
} from "lucide-react";
import { cn, ROLE_LABELS } from "@/lib/utils";
import { logout, type CurrentUser } from "@/lib/auth";
import AlamutLogo from "./AlamutLogo";

const NAV: { href: string; label: string; icon: any; roles?: string[] }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/manual", label: "Compliance Manual", icon: BookOpen },
  { href: "/fca", label: "FCA Handbook", icon: Library },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/regulatory-updates", label: "Regulatory Updates", icon: FileText },
  { href: "/attestations", label: "Attestations", icon: CheckSquare },
  { href: "/admin", label: "Admin", icon: Settings, roles: ["admin"] },
];

// Admins (and the compliance officer) see the full oversight portal; everyone
// else sees a slimmer "Team Portal" with only the items they need to action.
function portalLabel(role: string): string {
  if (role === "admin") return "Admin Portal";
  if (role === "compliance") return "Compliance Portal";
  return "Team Portal";
}

interface Props {
  user: CurrentUser;
  children: React.ReactNode;
  onLogout: () => void;
}

export default function Layout({ user, children, onLogout }: Props) {
  const [location] = useHashLocation();
  const [dark, setDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  async function handleLogout() {
    await logout();
    onLogout();
  }

  const visibleNav = NAV.filter((n) => !n.roles || n.roles.includes(user.role));

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar — dark operational shell */}
      <aside className="w-56 flex flex-col bg-sidebar border-r border-sidebar-border shrink-0">
        <div className="px-4 py-5 border-b border-sidebar-border flex items-center justify-center">
          <AlamutLogo small className="text-sidebar-foreground" />
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/"
                ? location === "/" || location === ""
                : location.startsWith(href);
            return (
              <Link key={href} href={href}>
                <a
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  {label}
                </a>
              </Link>
            );
          })}
        </nav>

        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="mb-2">
            <p className="text-[11px] font-medium text-sidebar-foreground/90">{user.full_name}</p>
            <p className="text-[10px] text-sidebar-foreground/50">{ROLE_LABELS[user.role] ?? user.role}</p>
          </div>
          <button
            onClick={() => setDark((d) => !d)}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[11px] text-sidebar-foreground/60 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors"
          >
            {dark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
            {dark ? "Light mode" : "Dark mode"}
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[11px] text-sidebar-foreground/60 hover:bg-red-900/30 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main column */}
      <main className="flex-1 overflow-y-auto">
        {/* Compact header */}
        <header className="sticky top-0 z-10 bg-background/90 backdrop-blur border-b border-border">
          <div className="px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Alamut Compliance</span>
              <span className="text-muted-foreground/60">·</span>
              <span className="font-medium text-foreground/80">{portalLabel(user.role)}</span>
              <span className="text-muted-foreground/60">/</span>
              <span>{location === "/" ? "Dashboard" : location.replace(/^\//, "").replace(/-/g, " ")}</span>
            </div>
            <div className="relative w-full max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search manual, FCA, attestations…"
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-card focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          </div>
        </header>

        <div>{children}</div>
      </main>
    </div>
  );
}
