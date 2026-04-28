import { useEffect, useState } from "react";
import { Router, Switch, Route } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, SESSION_EXPIRED_EVENT } from "@/lib/queryClient";
import { fetchSession, getCurrentUser, setCurrentUser, type CurrentUser } from "@/lib/auth";
import type { TabKey } from "@shared/schema";

import Login from "@/pages/Login";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Manual from "@/pages/Manual";
import ChapterView from "@/pages/ChapterView";
import Policies from "@/pages/Policies";
import ExecutedPolicyView from "@/pages/ExecutedPolicyView";
import FCAReference from "@/pages/FCAReference";
import Calendar from "@/pages/Calendar";
import RegulatoryUpdates from "@/pages/RegulatoryUpdates";
import Attestations from "@/pages/Attestations";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";

// Map a route prefix to the permission tab that controls it. Anything not
// in this map is unguarded (e.g. "/" without a perm — in practice we still
// require "dashboard").
const ROUTE_TAB: { prefix: string; tab: TabKey }[] = [
  { prefix: "/manual", tab: "manual" },
  { prefix: "/policies", tab: "policies" },
  { prefix: "/fca", tab: "fca" },
  { prefix: "/calendar", tab: "calendar" },
  { prefix: "/regulatory-updates", tab: "regulatory-updates" },
  { prefix: "/attestations", tab: "attestations" },
  { prefix: "/admin", tab: "admin" },
];

function tabForLocation(loc: string): TabKey {
  if (loc === "" || loc === "/") return "dashboard";
  const match = ROUTE_TAB.find((r) => loc === r.prefix || loc.startsWith(r.prefix + "/"));
  return (match?.tab ?? "dashboard") as TabKey;
}

function pickFallbackPath(perms: TabKey[]): string {
  if (perms.includes("dashboard")) return "/";
  const order: { tab: TabKey; path: string }[] = [
    { tab: "manual", path: "/manual" },
    { tab: "attestations", path: "/attestations" },
    { tab: "calendar", path: "/calendar" },
    { tab: "policies", path: "/policies" },
    { tab: "regulatory-updates", path: "/regulatory-updates" },
    { tab: "fca", path: "/fca" },
    { tab: "admin", path: "/admin" },
  ];
  for (const o of order) if (perms.includes(o.tab)) return o.path;
  return "/";
}

// Guards rendered children behind the user's tab_permissions. If the
// current location maps to a tab the user can't access, redirect them to
// the first tab they *can* access. The admin role is special-cased so a
// hand-edited tab_permissions row can never lock an admin out.
function RouteGuard({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  const [location, navigate] = useHashLocation();
  const currentTab = tabForLocation(location);
  const allowed = new Set<TabKey>(user.tab_permissions ?? []);
  const isAdminRoute = currentTab === "admin";
  const canSee =
    allowed.has(currentTab) || (isAdminRoute && user.role === "admin");

  useEffect(() => {
    if (!canSee) {
      const fallback = pickFallbackPath(user.tab_permissions ?? []);
      if (fallback !== location) navigate(fallback);
    }
  }, [canSee, location, navigate, user.tab_permissions]);

  if (!canSee) {
    return (
      <div className="px-6 py-10 text-center text-xs text-muted-foreground">
        Redirecting…
      </div>
    );
  }
  return <>{children}</>;
}

function AppRoutes({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  return (
    <Router hook={useHashLocation}>
      <Layout user={user} onLogout={onLogout}>
        <RouteGuard user={user}>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/manual" component={Manual} />
            <Route path="/manual/:slug">
              {(p) => <ChapterView slug={p.slug} />}
            </Route>
            <Route path="/policies" component={Policies} />
            <Route path="/policies/executed/:slug">
              {(p) => <ExecutedPolicyView slug={p.slug} />}
            </Route>
            <Route path="/fca" component={FCAReference} />
            <Route path="/calendar" component={Calendar} />
            <Route path="/regulatory-updates" component={RegulatoryUpdates} />
            <Route path="/attestations" component={Attestations} />
            <Route path="/admin" component={Admin} />
            <Route component={NotFound} />
          </Switch>
        </RouteGuard>
      </Layout>
    </Router>
  );
}

export default function App() {
  const [user, setUser] = useState<CurrentUser | null>(getCurrentUser());
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);

  useEffect(() => {
    fetchSession().then((u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  // Any API call that comes back 401 (besides the auth endpoints themselves)
  // means the cookie has expired or been cleared server-side. Drop cached
  // queries and the in-memory user so the Login screen comes back and the
  // user is not stranded in an admin shell with failed data.
  useEffect(() => {
    function onExpired() {
      setCurrentUser(null);
      setUser(null);
      setSessionExpired(true);
      queryClient.clear();
    }
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {user ? (
        <AppRoutes
          user={user}
          onLogout={() => {
            setCurrentUser(null);
            setUser(null);
          }}
        />
      ) : (
        <Login
          sessionExpired={sessionExpired}
          onAuth={(u) => {
            setCurrentUser(u);
            setUser(u);
            setSessionExpired(false);
          }}
        />
      )}
    </QueryClientProvider>
  );
}
