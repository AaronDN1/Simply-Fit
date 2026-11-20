"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Shield } from "lucide-react";
import { isAdminEmail, type AdminDirectory, type AdminUserDetail, type AdminUserSummary } from "@/lib/admin";
import { loadAdminDetail, loadAdminDirectory, updateAdminAccess } from "@/lib/admin-client";
import { useStore } from "@/lib/store";
import { GOAL_LABEL } from "@/lib/plan";
import type { Goal } from "@/lib/types";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const EMPTY: AdminDirectory = { users: [], total: 0, onboarded: 0, disabled: 0, planGranted: 0, hasMore: false };

function when(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function goalLabel(goal: string | null) {
  if (!goal) return "No plan yet";
  return goal in GOAL_LABEL ? GOAL_LABEL[goal as Goal] : goal;
}

export default function AdminPage() {
  const { actor, mode, status, beginImpersonation } = useStore();
  const router = useRouter();
  const toast = useToast();
  const allowed = isAdminEmail(actor?.email);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [directory, setDirectory] = useState<AdminDirectory>(EMPTY);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<AdminUserDetail | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);

  useEffect(() => {
    if (status === "ready" && actor && !allowed) router.replace("/today");
  }, [status, actor, allowed, router]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 200);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setOffset(0);
  }, [debounced]);

  useEffect(() => {
    if (!allowed) return;
    let cancel = false;
    setLoading(true);
    setError(null);
    loadAdminDirectory(mode, debounced, offset)
      .then((next) => {
        if (cancel) return;
        setDirectory((current) => (offset === 0 ? next : { ...next, users: [...current.users, ...next.users] }));
      })
      .catch((e: unknown) => {
        if (!cancel) setError(e instanceof Error ? e.message : "Couldn't load accounts.");
      })
      .finally(() => {
        if (!cancel) setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [allowed, mode, debounced, offset]);

  async function openUser(user: AdminUserSummary) {
    setOpening(user.id);
    setConfirmDisable(false);
    try {
      const detail = await loadAdminDetail(mode, user.id);
      setSelected(detail);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't open that account.", "error");
    } finally {
      setOpening(null);
    }
  }

  async function impersonate(user: AdminUserSummary) {
    setBusy("impersonate");
    try {
      await beginImpersonation({ id: user.id, email: user.email, name: user.name });
      setSelected(null);
      router.push("/today");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't open that account.", "error");
      setBusy(null);
    }
  }

  async function saveAccess(patch: Parameters<typeof updateAdminAccess>[2], key: string) {
    if (!selected) return;
    setBusy(key);
    try {
      const next = await updateAdminAccess(mode, selected.id, patch);
      if (next) setSelected(next);
      setConfirmDisable(false);
      const refreshed = await loadAdminDirectory(mode, debounced, 0);
      setOffset(0);
      setDirectory(refreshed);
      toast("Account updated");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't update that account.", "error");
    } finally {
      setBusy(null);
    }
  }

  if (!allowed) return null;

  const selfId = actor?.id;

  return (
    <div>
      <PageHeader eyebrow="Allowlist only" title="Admin" description="Accounts on Simply Fit. Search, open a record, turn access off, or view the app as that person." />

      {mode === "demo" && (
        <p className="mb-4 rounded-2xl bg-honey-soft px-4 py-3 text-[13px] leading-relaxed text-honey">
          Local demo: this list is accounts saved in this browser. Hosted accounts appear here once Supabase is connected.
        </p>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Accounts" value={directory.total} />
        <Stat label="Onboarded" value={directory.onboarded} />
        <Stat label="Disabled" value={directory.disabled} />
        <Stat label="Plan access" value={directory.planGranted} />
      </div>

      <Card className="overflow-hidden">
        <div className="border-b border-line p-3 sm:p-4">
          <label className="flex items-center gap-2 rounded-full border border-line bg-canvas px-3">
            <Search className="size-4 shrink-0 text-muted" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or email" className="h-10 border-0 bg-transparent px-0 shadow-none focus-visible:outline-none" />
          </label>
        </div>
        {error && <p className="px-4 py-3 text-[13px] text-clay">{error}</p>}
        {!error && directory.users.length === 0 && !loading && <p className="px-4 py-10 text-center text-[14px] text-muted">No accounts match that search.</p>}
        <ul className="divide-y divide-line">
          {directory.users.map((user) => {
            const mine = user.id === selfId;
            const locked = isAdminEmail(user.email);
            return (
              <li key={user.id} className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
                <button type="button" onClick={() => openUser(user)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-strong">
                    {(user.name || user.email || "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[15px] font-medium">{user.name || "Unnamed"}</span>
                      {mine && <Badge>You</Badge>}
                      {locked && !mine && <Badge tone="accent">Admin</Badge>}
                      {user.disabledAt && <Badge tone="clay">Disabled</Badge>}
                      {user.planAccess === "granted" && <Badge tone="honey">Granted</Badge>}
                      {user.planAccess === "paid" && <Badge tone="honey">Paid</Badge>}
                      {user.planAccess === "unlimited" && <Badge tone="honey">Unlimited</Badge>}
                    </span>
                    <span className="mt-0.5 block truncate text-[13px] text-muted">{user.email || "No email"}</span>
                  </span>
                </button>
                <span className="flex items-center gap-2 sm:shrink-0">
                  <span className="hidden text-[12px] text-muted sm:block">{user.onboardedAt ? "Onboarded" : "Not started"}</span>
                  <Button size="sm" variant="secondary" onClick={() => openUser(user)} loading={opening === user.id}>
                    View
                  </Button>
                  <Button size="sm" variant="quiet" disabled={mine} onClick={() => impersonate(user)}>
                    Impersonate
                  </Button>
                </span>
              </li>
            );
          })}
        </ul>
        {directory.hasMore && (
          <div className="border-t border-line p-3 text-center">
            <Button variant="ghost" size="sm" onClick={() => setOffset((n) => n + 40)} loading={loading}>
              Load more
            </Button>
          </div>
        )}
        {loading && directory.users.length === 0 && !error && <p className="px-4 py-8 text-center text-[14px] text-muted">Loading accounts…</p>}
      </Card>

      <Sheet open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.name || "Account"} description={selected?.email}>
        {selected && (
          <AccountSheet
            user={selected}
            mine={selected.id === selfId}
            adminLocked={isAdminEmail(selected.email)}
            confirmDisable={confirmDisable}
            busy={busy}
            onConfirmDisable={setConfirmDisable}
            onImpersonate={() => impersonate(selected)}
            onDisable={() => saveAccess({ disabledAt: new Date().toISOString() }, "disable")}
            onEnable={() => saveAccess({ disabledAt: null }, "enable")}
            onPlan={(plan) => saveAccess({ plan }, "plan")}
          />
        )}
      </Sheet>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="px-4 py-3">
      <p className="text-[12px] font-medium text-muted">{label}</p>
      <p className="mt-1 font-display text-[28px] leading-none tabular">{value}</p>
    </Card>
  );
}

function AccountSheet({
  user,
  mine,
  adminLocked,
  confirmDisable,
  busy,
  onConfirmDisable,
  onImpersonate,
  onDisable,
  onEnable,
  onPlan,
}: {
  user: AdminUserDetail;
  mine: boolean;
  adminLocked: boolean;
  confirmDisable: boolean;
  busy: string | null;
  onConfirmDisable: (value: boolean) => void;
  onImpersonate: () => void;
  onDisable: () => void;
  onEnable: () => void;
  onPlan: (plan: "none" | "granted") => void;
}) {
  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
        <Fact label="Joined" value={when(user.createdAt)} />
        <Fact label="Onboarded" value={when(user.onboardedAt)} />
        <Fact label="Goal" value={goalLabel(user.goal)} />
        <Fact label="Age" value={user.age == null ? "—" : String(user.age)} />
        <Fact label="Calories" value={user.calorieTarget == null ? "—" : user.calorieTarget.toLocaleString("en-US")} />
        <Fact label="Protein" value={user.proteinG == null ? "—" : `${user.proteinG} g`} />
        <Fact label="Lifting days" value={user.liftingDays == null ? "—" : String(user.liftingDays)} />
        <Fact label="Units" value={user.units === "kg" ? "Kilograms" : "Pounds"} />
      </dl>
      <p className="truncate text-[12px] text-faint">ID {user.id}</p>

      <div className="space-y-2 border-t border-line pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[14px] font-medium">Account access</p>
            <p className="mt-0.5 text-[13px] text-muted">{user.disabledAt ? `Disabled ${when(user.disabledAt)}.` : "They can sign in and use Simply Fit."}</p>
          </div>
          {user.disabledAt ? (
            <Button size="sm" variant="secondary" onClick={onEnable} loading={busy === "enable"} disabled={adminLocked}>
              Enable
            </Button>
          ) : confirmDisable ? (
            <span className="flex gap-2">
              <Button size="sm" variant="ghost" onClick={() => onConfirmDisable(false)}>
                Cancel
              </Button>
              <Button size="sm" variant="danger" onClick={onDisable} loading={busy === "disable"}>
                Disable
              </Button>
            </span>
          ) : (
            <Button size="sm" variant="danger" onClick={() => onConfirmDisable(true)} disabled={mine || adminLocked}>
              Disable
            </Button>
          )}
        </div>
        {(mine || adminLocked) && !user.disabledAt && <p className="text-[12px] text-muted">Allowlisted administrators stay active.</p>}

        <div className="flex items-start justify-between gap-3 pt-2">
          <div>
            <p className="flex items-center gap-1.5 text-[14px] font-medium">
              <Shield className="size-3.5 text-muted" /> Plan access
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              {user.planAccess === "paid"
                ? "Paid subscription through Stripe."
                : user.planAccess === "unlimited"
                  ? "Unlimited subscription through Stripe."
                  : user.planAccess === "granted"
                    ? "Complimentary access, with no Stripe subscription."
                    : "Free account. Grant gives complimentary Unlimited access."}
            </p>
          </div>
          {user.planAccess === "granted" ? (
            <Button size="sm" variant="secondary" onClick={() => onPlan("none")} loading={busy === "plan"}>
              Remove
            </Button>
          ) : user.planAccess === "paid" || user.planAccess === "unlimited" ? (
            <span className="text-[13px] capitalize text-muted">{user.planAccess}</span>
          ) : (
            <Button size="sm" onClick={() => onPlan("granted")} loading={busy === "plan"}>
              Grant
            </Button>
          )}
        </div>
      </div>

      <Button className="w-full" disabled={mine} onClick={onImpersonate} loading={busy === "impersonate"}>
        Impersonate
      </Button>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className={cn("mt-0.5 font-medium text-ink")}>{value}</dd>
    </div>
  );
}
