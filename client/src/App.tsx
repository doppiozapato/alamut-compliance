import { useEffect, useState } from "react";
import { Router, Switch, Route } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient, SESSION_EXPIRED_EVENT } from "@/lib/queryClient";
import { fetchSession, getCurrentUser, setCurrentUser, type CurrentUser } from "@/lib/auth";

import Login from "@/pages/Login";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Manual from "@/pages/Manual";
import ChapterView from "@/pages/ChapterView";
import Policies from "@/pages/Policies";
import FCAReference from "@/pages/FCAReference";
import Calendar from "@/pages/Calendar";
import RegulatoryUpdates from "@/pages/RegulatoryUpdates";
import Attestations from "@/pages/Attestations";
import Admin from "@/pages/Admin";
import NotFound from "@/pages/not-found";

function AppRoutes({ user, onLogout }: { user: CurrentUser; onLogout: () => void }) {
  return (
    <Router hook={useHashLocation}>
      <Layout user={user} onLogout={onLogout}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/manual" component={Manual} />
          <Route path="/manual/:slug">
            {(p) => <ChapterView slug={p.slug} />}
          </Route>
          <Route path="/policies" component={Policies} />
          <Route path="/fca" component={FCAReference} />
          <Route path="/calendar" component={Calendar} />
          <Route path="/regulatory-updates" component={RegulatoryUpdates} />
          <Route path="/attestations" component={Attestations} />
          <Route path="/admin" component={Admin} />
          <Route component={NotFound} />
        </Switch>
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
