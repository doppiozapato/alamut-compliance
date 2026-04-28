import { QueryClient } from "@tanstack/react-query";

// Same-origin API. Cookies are required for session auth.
const API_BASE = "";

// Custom event fired when any API call returns 401. App.tsx listens for this
// to drop the cached user and return to the Login screen instead of leaving
// the user inside an authenticated shell with broken data.
export const SESSION_EXPIRED_EVENT = "alamut:session-expired";

function notifySessionExpired() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
  }
}

export async function apiRequest(
  method: string,
  path: string,
  body?: unknown,
): Promise<Response> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    method,
    credentials: "include",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  // Don't fire on the auth endpoints themselves — Login uses a 401 to mean
  // "wrong password", not "session expired". Same for the session probe.
  if (res.status === 401 && !path.startsWith("/api/auth/")) {
    notifySessionExpired();
  }
  return res;
}

async function defaultQueryFn({ queryKey }: { queryKey: readonly unknown[] }) {
  const path = queryKey[0] as string;
  const res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  if (res.status === 401) {
    notifySessionExpired();
    throw new Error("UNAUTHENTICATED");
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: defaultQueryFn,
      staleTime: 30_000,
      // Don't retry an UNAUTHENTICATED response — retrying just delays the
      // session-expired prompt without any chance of success.
      retry: (failureCount, error) => {
        if (error instanceof Error && error.message === "UNAUTHENTICATED") return false;
        return failureCount < 1;
      },
    },
  },
});
