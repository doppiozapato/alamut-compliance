import { apiRequest } from "./queryClient";

export type Role = "admin" | "compliance" | "operations" | "finance" | "team";

export interface CurrentUser {
  id: number;
  email: string;
  full_name: string;
  role: Role;
}

let _user: CurrentUser | null = null;

export function getCurrentUser(): CurrentUser | null {
  return _user;
}

export function setCurrentUser(u: CurrentUser | null) {
  _user = u;
}

export async function fetchSession(): Promise<CurrentUser | null> {
  try {
    const res = await apiRequest("GET", "/api/auth/me");
    if (!res.ok) return null;
    const j = await res.json();
    _user = j.user ?? null;
    return _user;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<CurrentUser | null> {
  const res = await apiRequest("POST", "/api/auth/login", { email, password });
  if (!res.ok) return null;
  const j = await res.json();
  _user = j.user;
  return _user;
}

export async function logout() {
  await apiRequest("POST", "/api/auth/logout");
  _user = null;
}

export function hasRole(...roles: Role[]): boolean {
  return _user ? roles.includes(_user.role) : false;
}
