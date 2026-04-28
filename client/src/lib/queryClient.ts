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

// Custom error so callers (Manual.tsx etc.) can branch on HTTP status —
// 401 (session expired) needs a different UI than 500/network failure.
export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
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
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { credentials: "include" });
  } catch (e) {
    // Network failure (DNS, offline, CORS preflight). Surface as status 0
    // so the UI can distinguish from a server-side error.
    throw new ApiError((e as Error).message || "Network error", 0);
  }
  if (res.status === 401) {
    notifySessionExpired();
    throw new ApiError("UNAUTHENTICATED", 401);
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j?.error) detail = `${res.status} ${j.error}`;
    } catch {
      /* body was not JSON; keep the status line */
    }
    throw new ApiError(detail, res.status);
  }
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
        if (error instanceof ApiError && error.status === 401) return false;
        return failureCount < 1;
      },
    },
  },
});
