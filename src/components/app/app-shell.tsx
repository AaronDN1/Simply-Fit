"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Activity, CalendarCheck, Dumbbell, LineChart, LogOut, Settings, SlidersHorizontal, Soup } from "lucide-react";
import { Logo, LogoMark } from "@/components/logo";
import { ThemeSwitch } from "@/components/theme";
import { useStore } from "@/lib/store";
import { signOut } from "@/lib/auth";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/today", label: "Today", icon: CalendarCheck },
  { href: "/nutrition", label: "Nutrition", icon: Soup },
  { href: "/training", label: "Training", icon: Dumbbell },
  { href: "/activity", label: "Activity", icon: Activity },
  { href: "/progress", label: "Progress", icon: LineChart },
];
const SECONDARY = [
  { href: "/plan", label: "My plan", icon: SlidersHorizontal },
  { href: "/settings", label: "Settings", icon: Settings },
];

function initials(name: string, email: string) {
  const s = name.trim() || email;
  return s.slice(0, 1).toUpperCase();
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { data, mode } = useStore();
  const active = (href: string) => path === href || path.startsWith(`${href}/`);

  async function logout() {
    await signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-[100svh] lg:grid lg:grid-cols-[232px_1fr]">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-[100svh] flex-col border-r border-line px-4 py-5 lg:flex">
        <Logo href="/today" className="px-2" />
        <nav className="mt-8 flex flex-col gap-0.5">
          {NAV.map((n) => (
            <SideLink key={n.href} {...n} active={active(n.href)} />
          ))}
        </nav>
        <div className="my-4 h-px bg-line" />
        <nav className="flex flex-col gap-0.5">
          {SECONDARY.map((n) => (
            <SideLink key={n.href} {...n} active={active(n.href)} />
          ))}
        </nav>
        <div className="mt-auto">
          <ThemeSwitch className="mb-3" />
          {mode === "demo" && (
            <p className="mb-3 rounded-xl bg-honey-soft px-3 py-2 text-[12px] leading-snug text-honey">Local demo — data stays in this browser.</p>
          )}
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
            <span className="grid size-8 place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-strong">
              {initials(data.profile.displayName, data.profile.email)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{data.profile.displayName || "You"}</span>
              <span className="block truncate text-[12px] text-muted">{data.profile.email}</span>
            </span>
            <button onClick={logout} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink" aria-label="Sign out">
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line/70 bg-canvas/85 px-4 backdrop-blur-md lg:hidden">
        <Link href="/today" aria-label="Today">
          <LogoMark />
        </Link>
        <div className="flex items-center gap-1">
          <ThemeSwitch labelled={false} className="mr-1" />
          <Link href="/plan" className={cn("grid size-9 place-items-center rounded-full", active("/plan") ? "bg-sunken text-ink" : "text-muted")} aria-label="My plan">
            <SlidersHorizontal className="size-[18px]" />
          </Link>
          <Link href="/settings" className={cn("grid size-9 place-items-center rounded-full", active("/settings") ? "bg-sunken text-ink" : "text-muted")} aria-label="Settings">
            <Settings className="size-[18px]" />
          </Link>
        </div>
      </header>

      <main className="min-w-0 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-5 sm:px-6 lg:px-10 lg:pb-16 lg:pt-10">
        <div className="mx-auto max-w-[1080px]">{children}</div>
      </main>

      {/* Mobile tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <div className="mx-auto grid max-w-md grid-cols-5">
          {NAV.map((n) => {
            const on = active(n.href);
            return (
              <Link key={n.href} href={n.href} className="relative flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium">
                {on && <motion.span layoutId="tab-dot" className="absolute top-0 h-0.5 w-8 rounded-full bg-accent" />}
                <n.icon className={cn("size-5", on ? "text-accent" : "text-muted")} strokeWidth={on ? 2.2 : 1.8} />
                <span className={on ? "text-ink" : "text-muted"}>{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SideLink({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; active: boolean }) {
  return (
    <Link href={href} className={cn("relative flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] transition-colors", active ? "text-ink" : "text-muted hover:text-ink")}>
      {active && <motion.span layoutId="side-active" className="absolute inset-0 rounded-xl bg-surface shadow-[var(--shadow-soft)] ring-1 ring-line" />}
      <Icon className={cn("relative size-[18px]", active && "text-accent")} />
      <span className="relative font-medium">{label}</span>
    </Link>
  );
}
