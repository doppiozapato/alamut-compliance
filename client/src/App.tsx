import { useEffect, useState } from "react";
import { Router, Switch, Route } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { fetchSession, getCurrentUser, setCurrentUser, type CurrentUser } from "@/lib/auth";

import Login from "@/pages/Login";
import Layout from "@/components/Layout";
import Dashboard from "@/pages/Dashboard";
import Manual from "@/pages/Manual";
import ChapterView from "@/pages/ChapterView";
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

  useEffect(() => {
    fetchSession().then((u) => {
      setUser(u);
      setLoading(false);
    });
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
          onAuth={(u) => {
            setCurrentUser(u);
            setUser(u);
          }}
        />
      )}
    </QueryClientProvider>
  );
}
