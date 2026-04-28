import { apiRequest } from "./queryClient";
import {
  resolveTabPermissions,
  type Role as SchemaRole,
  type TabKey,
} from "@shared/schema";

export type Role = SchemaRole;

export interface CurrentUser {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  tab_permissions: TabKey[];
}

function hydrateUser(u: any): CurrentUser | null {
  if (!u || typeof u !== "object") return null;
  const role = u.role as Role;
  const perms = Array.isArray(u.tab_permissions) && u.tab_permissions.length > 0
    ? (u.tab_permissions as TabKey[])
    : resolveTabPermissions(role, null);
  return {
    id: u.id,
    email: u.email,
    full_name: u.full_name,
    role,
    tab_permissions: perms,
  };
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
    _user = hydrateUser(j.user);
    return _user;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<CurrentUser | null> {
  const res = await apiRequest("POST", "/api/auth/login", { email, password });
  if (!res.ok) return null;
  const j = await res.json();
  _user = hydrateUser(j.user);
  return _user;
}

export async function logout() {
  await apiRequest("POST", "/api/auth/logout");
  _user = null;
}

export function hasRole(...roles: Role[]): boolean {
  return _user ? roles.includes(_user.role) : false;
}
