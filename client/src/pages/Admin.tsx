import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Settings,
  Users,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  KeyRound,
  Copy,
  ShieldCheck,
  Save,
  X,
} from "lucide-react";
import type { Attestation, TeamMember, TabKey, Role } from "@shared/schema";
import {
  TAB_KEYS,
  TAB_LABELS,
  DEFAULT_TAB_PERMISSIONS,
  resolveTabPermissions,
} from "@shared/schema";
import { cn, formatDate, ROLE_LABELS, statusBadgeClass } from "@/lib/utils";
import { getCurrentUser } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

interface TeamSummary extends TeamMember {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
}

const ROLES: Role[] = ["admin", "compliance", "operations", "finance", "team"];

// A "permission profile" applies a sensible default permission set when
// the admin picks a role from the dropdown. Custom keeps whatever boxes
// are currently ticked.
const PROFILES: { key: Role | "custom"; label: string }[] = [
  { key: "admin", label: "Admin (full access)" },
  { key: "compliance", label: "Compliance (oversight)" },
  { key: "operations", label: "Operations" },
  { key: "finance", label: "Finance" },
  { key: "team", label: "Team member" },
  { key: "custom", label: "Custom" },
];

function PermissionGrid({
  value,
  onChange,
  disableAdminLock,
}: {
  value: TabKey[];
  onChange: (next: TabKey[]) => void;
  disableAdminLock?: boolean;
}) {
  const set = new Set(value);
  function toggle(tab: TabKey) {
    const next = new Set(set);
    if (next.has(tab)) next.delete(tab);
    else next.add(tab);
    onChange(Array.from(next));
  }
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {TAB_KEYS.map((tab) => {
        const checked = set.has(tab);
        // The admin tab is always tied to the admin role at the server, but
        // we still let admins tick/untick the box visually; for non-admin
        // profiles the toggle has no effect because the role gate filters
        // the entry out anyway.
        return (
          <label
            key={tab}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded border text-[11px] cursor-pointer transition-colors",
              checked
                ? "border-primary/40 bg-primary/5"
                : "border-border bg-background hover:bg-secondary/40",
            )}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={() => toggle(tab)}
              disabled={disableAdminLock && tab === "admin"}
              className="h-3 w-3"
            />
            <span>{TAB_LABELS[tab]}</span>
          </label>
        );
      })}
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-background hover:bg-secondary/40 text-[10px]"
    >
      <Copy className="w-3 h-3" /> {copied ? "Copied" : "Copy"}
    </button>
  );
}

function GeneratedPasswordBanner({
  email,
  password,
  onClose,
}: {
  email: string;
  password: string;
  onClose: () => void;
}) {
  return (
    <div className="mb-4 px-3 py-3 rounded-md border border-amber-500/40 bg-amber-500/10">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
            One-time password for {email}
          </p>
          <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80 mt-0.5">
            Copy and share this password securely. It will not be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="px-2 py-1 rounded bg-background border border-border text-[11px] font-mono select-all">
              {password}
            </code>
            <CopyButton text={password} />
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-amber-500/20"
          title="Dismiss"
        >
          <X className="w-3.5 h-3.5 text-amber-700 dark:text-amber-400" />
        </button>
      </div>
    </div>
  );
}

interface OneTimePassword {
  userId: number;
  email: string;
  password: string;
}

function CreateMemberCard({
  onCreated,
}: {
  onCreated: (otp: OneTimePassword) => void;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("team");
  const [profile, setProfile] = useState<Role | "custom">("team");
  const [perms, setPerms] = useState<TabKey[]>(DEFAULT_TAB_PERMISSIONS.team);
  const [supplyOwn, setSupplyOwn] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function applyProfile(p: Role | "custom") {
    setProfile(p);
    if (p !== "custom") {
      setRole(p);
      setPerms(DEFAULT_TAB_PERMISSIONS[p]);
    }
  }

  function reset() {
    setOpen(false);
    setEmail("");
    setName("");
    setRole("team");
    setProfile("team");
    setPerms(DEFAULT_TAB_PERMISSIONS.team);
    setSupplyOwn(false);
    setPassword("");
    setError("");
  }

  const create = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        email,
        full_name: name,
        role,
        tab_permissions: perms,
      };
      if (supplyOwn && password) body.password = password;
      const res = await apiRequest("POST", "/api/admin/team", body);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `Failed (${res.status})`);
      }
      return res.json() as Promise<{
        member: TeamMember;
        password: string;
        password_generated: boolean;
      }>;
    },
    onSuccess: (data) => {
      onCreated({
        userId: data.member.id,
        email: data.member.email,
        password: data.password,
      });
      qc.invalidateQueries({ queryKey: ["/api/admin/team"] });
      reset();
    },
    onError: (e: Error) => setError(e.message),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-card hover:bg-secondary/40 text-[11px]"
      >
        <UserPlus className="w-3.5 h-3.5" /> Add team member
      </button>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold inline-flex items-center gap-1.5">
          <UserPlus className="w-3.5 h-3.5" /> New team member
        </h3>
        <button onClick={reset} className="text-[10px] text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Full name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="Jane Smith"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Email
          </label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder="jane@alamut-im.com"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Permission profile
          </label>
          <select
            value={profile}
            onChange={(e) => applyProfile(e.target.value as Role | "custom")}
            className="mt-1 w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {PROFILES.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => {
              setRole(e.target.value as Role);
              setProfile("custom");
            }}
            className="mt-1 w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r] ?? r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="mt-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
          Visible tabs
        </p>
        <PermissionGrid
          value={perms}
          onChange={(next) => {
            setPerms(next);
            setProfile("custom");
          }}
        />
      </div>

      <div className="mt-3 border-t border-border pt-3">
        <label className="inline-flex items-center gap-2 text-[11px]">
          <input
            type="checkbox"
            checked={supplyOwn}
            onChange={(e) => setSupplyOwn(e.target.checked)}
          />
          Provide an initial password (otherwise one is generated)
        </label>
        {supplyOwn && (
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 10 characters"
            className="mt-2 w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        )}
      </div>

      {error && (
        <p className="mt-3 text-[11px] text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={reset}
          className="px-3 py-1.5 rounded-md border border-border bg-background text-[11px]"
        >
          Cancel
        </button>
        <button
          onClick={() => create.mutate()}
          disabled={create.isPending}
          className="px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] disabled:opacity-60"
        >
          {create.isPending ? "Creating…" : "Create member"}
        </button>
      </div>
    </div>
  );
}

function MemberEditor({
  member,
  onClose,
  onResetPassword,
}: {
  member: TeamMember;
  onClose: () => void;
  onResetPassword: (otp: OneTimePassword) => void;
}) {
  const qc = useQueryClient();
  const initialPerms = useMemo(
    () => resolveTabPermissions(member.role, member.tab_permissions ?? null),
    [member],
  );
  const [name, setName] = useState(member.full_name);
  const [email, setEmail] = useState(member.email);
  const [role, setRole] = useState<Role>(member.role);
  const [perms, setPerms] = useState<TabKey[]>(initialPerms);
  const [active, setActive] = useState(member.is_active);
  const [error, setError] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetSupplyOwn, setResetSupplyOwn] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/admin/team/${member.id}`, {
        email: email.trim().toLowerCase(),
        full_name: name,
        role,
        is_active: active,
        tab_permissions: perms,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `Failed (${res.status})`);
      }
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/team"] });
      onClose();
    },
    onError: (e: Error) => setError(e.message),
  });

  const reset = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      if (resetSupplyOwn && resetPassword) body.password = resetPassword;
      const res = await apiRequest(
        "POST",
        `/api/admin/team/${member.id}/reset-password`,
        body,
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error ?? `Failed (${res.status})`);
      }
      return res.json() as Promise<{ password: string; password_generated: boolean }>;
    },
    onSuccess: (data) => {
      onResetPassword({
        userId: member.id,
        email: member.email,
        password: data.password,
      });
      setResetPassword("");
      setResetSupplyOwn(false);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <div className="bg-card border border-border rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold inline-flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5" /> Edit {member.full_name}
        </h3>
        <button onClick={onClose} className="text-[10px] text-muted-foreground hover:text-foreground">
          Close
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Full name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Email (login username)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            className="mt-1 w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <p className="mt-1 text-[10px] text-muted-foreground">
            This is the address the user signs in with. Changing it updates
            their login username — the existing password is preserved.
          </p>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="mt-1 w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          >
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r] ?? r}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Active
          </label>
          <div className="mt-1.5">
            <label className="inline-flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Account is active
            </label>
          </div>
        </div>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Visible tabs
          </p>
          <button
            type="button"
            onClick={() => setPerms(DEFAULT_TAB_PERMISSIONS[role])}
            className="text-[10px] text-muted-foreground hover:text-foreground"
          >
            Reset to {ROLE_LABELS[role]} default
          </button>
        </div>
        <PermissionGrid value={perms} onChange={setPerms} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 justify-end border-t border-border pt-3">
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-md border border-border bg-background text-[11px]"
        >
          Cancel
        </button>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-[11px] disabled:opacity-60"
        >
          <Save className="w-3 h-3" /> {save.isPending ? "Saving…" : "Save changes"}
        </button>
      </div>

      <div className="mt-4 border-t border-border pt-3">
        <h4 className="text-[11px] font-semibold inline-flex items-center gap-1.5 mb-2">
          <KeyRound className="w-3 h-3" /> Password
        </h4>
        <p className="text-[10px] text-muted-foreground mb-2">
          Generate or reset this user's password. The new password is shown only
          once and replaces any existing credential.
        </p>
        <label className="inline-flex items-center gap-2 text-[11px]">
          <input
            type="checkbox"
            checked={resetSupplyOwn}
            onChange={(e) => setResetSupplyOwn(e.target.checked)}
          />
          Supply password instead of generating
        </label>
        {resetSupplyOwn && (
          <input
            type="text"
            value={resetPassword}
            onChange={(e) => setResetPassword(e.target.value)}
            placeholder="At least 10 characters"
            className="mt-2 w-full px-2 py-1.5 text-xs rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-ring"
          />
        )}
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => reset.mutate()}
            disabled={reset.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[11px] disabled:opacity-60"
          >
            <KeyRound className="w-3 h-3" />
            {reset.isPending
              ? "Working…"
              : resetSupplyOwn
                ? "Set password"
                : "Generate new password"}
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-[11px] text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

export default function Admin() {
  const user = getCurrentUser();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [otp, setOtp] = useState<OneTimePassword | null>(null);

  const { data: team = [] } = useQuery<TeamSummary[]>({
    queryKey: ["/api/admin/team"],
    enabled: user?.role === "admin",
  });
  const { data: detail = [] } = useQuery<Attestation[]>({
    queryKey: [`/api/admin/team/${selectedId}/attestations`],
    enabled: !!selectedId,
  });

  if (user?.role !== "admin") {
    return (
      <div className="px-6 py-6 max-w-2xl mx-auto">
        <div className="bg-card border border-border rounded-lg p-6 text-center">
          <AlertTriangle className="w-5 h-5 mx-auto mb-2 text-amber-500" />
          <p className="text-sm font-medium">Restricted</p>
          <p className="text-xs text-muted-foreground mt-1">
            Admin oversight is available to senior admin accounts only.
          </p>
        </div>
      </div>
    );
  }

  if (selectedId) {
    const member = team.find((t) => t.id === selectedId);
    return (
      <div className="px-6 py-6 max-w-4xl mx-auto">
        <button
          onClick={() => setSelectedId(null)}
          className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-3 h-3" /> Back to team
        </button>
        {member && (
          <div className="mb-5">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {ROLE_LABELS[member.role] ?? member.role}
            </p>
            <h1 className="text-base font-semibold mt-0.5">{member.full_name}</h1>
            <p className="text-xs text-muted-foreground">{member.email}</p>
          </div>
        )}
        <div className="space-y-2">
          {detail.length === 0 ? (
            <p className="text-xs text-muted-foreground">No attestations.</p>
          ) : (
            detail.map((a) => (
              <div
                key={a.id}
                className="bg-card border border-border rounded-lg px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium">{a.topic}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {a.category} · due {formatDate(a.due_date)}
                    {a.completed_at ? ` · completed ${formatDate(a.completed_at)}` : ""}
                  </p>
                  {a.comment && (
                    <p className="text-[11px] text-muted-foreground italic mt-1">"{a.comment}"</p>
                  )}
                </div>
                <span
                  className={cn(
                    "text-[9px] uppercase px-1.5 py-0.5 rounded border whitespace-nowrap",
                    statusBadgeClass(a.status),
                  )}
                >
                  {a.status}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  const editing = editId != null ? team.find((t) => t.id === editId) ?? null : null;

  return (
    <div className="px-6 py-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Settings className="w-4 h-4" />
        <h1 className="text-base font-semibold">Admin · Team Oversight</h1>
      </div>
      <p className="text-xs text-muted-foreground mb-5">
        Manage team accounts, control sidebar tab visibility, and reset passwords.
      </p>

      {otp && (
        <GeneratedPasswordBanner
          email={otp.email}
          password={otp.password}
          onClose={() => setOtp(null)}
        />
      )}

      {editing ? (
        <MemberEditor
          member={editing}
          onClose={() => setEditId(null)}
          onResetPassword={setOtp}
        />
      ) : (
        <div className="mb-4 flex items-center justify-between gap-2">
          <CreateMemberCard onCreated={setOtp} />
        </div>
      )}

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="grid grid-cols-12 px-4 py-2 border-b border-border bg-secondary/40 text-[10px] uppercase tracking-wider text-muted-foreground">
          <div className="col-span-3 flex items-center gap-1.5">
            <Users className="w-3 h-3" /> Member
          </div>
          <div className="col-span-2">Role</div>
          <div className="col-span-3">Visible tabs</div>
          <div className="col-span-1 text-right">Done</div>
          <div className="col-span-1 text-right">Pend</div>
          <div className="col-span-1 text-right">Over</div>
          <div className="col-span-1 text-right">Manage</div>
        </div>
        {team.map((m) => {
          const perms = resolveTabPermissions(m.role, m.tab_permissions ?? null);
          return (
            <div
              key={m.id}
              className="grid grid-cols-12 px-4 py-2.5 border-b border-border last:border-0 text-xs hover:bg-secondary/40 transition-colors"
            >
              <button
                onClick={() => setSelectedId(m.id)}
                className="col-span-3 text-left"
              >
                <p className="font-medium">{m.full_name}</p>
                <p className="text-[10px] text-muted-foreground">{m.email}</p>
              </button>
              <div className="col-span-2 text-[11px] text-muted-foreground self-center">
                {ROLE_LABELS[m.role] ?? m.role}
                {!m.is_active && (
                  <span className="ml-1 text-[9px] uppercase text-red-500">(inactive)</span>
                )}
              </div>
              <div className="col-span-3 self-center text-[10px] text-muted-foreground truncate" title={perms.map((p) => TAB_LABELS[p]).join(", ")}>
                {perms.length} tab{perms.length === 1 ? "" : "s"}
              </div>
              <div className="col-span-1 text-right self-center text-emerald-600 dark:text-emerald-400 inline-flex items-center justify-end gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {m.completed}
              </div>
              <div className="col-span-1 text-right self-center text-amber-600 dark:text-amber-400">
                {m.pending}
              </div>
              <div className="col-span-1 text-right self-center text-red-600 dark:text-red-400 inline-flex items-center justify-end gap-1">
                {m.overdue > 0 && <AlertTriangle className="w-3 h-3" />}
                {m.overdue}
              </div>
              <div className="col-span-1 text-right self-center">
                <button
                  onClick={() => setEditId(m.id)}
                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-border bg-background hover:bg-secondary/40 text-[10px]"
                >
                  Edit <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
