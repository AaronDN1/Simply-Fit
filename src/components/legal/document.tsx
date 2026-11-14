import Link from "next/link";
import { Logo } from "@/components/logo";
import { LEGAL_UPDATED } from "@/lib/legal";

const LINKS = [
  { href: "/privacy", label: "Privacy" },
  { href: "/terms", label: "Terms" },
  { href: "/medical", label: "Medical disclaimer" },
  { href: "/cookies", label: "Cookies" },
] as const;

export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav className={className} aria-label="Legal">
      {LINKS.map((link) => (
        <Link key={link.href} href={link.href} className="hover:text-ink">
          {link.label}
        </Link>
      ))}
    </nav>
  );
}

export function LegalSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-[18px] font-semibold tracking-tight text-ink">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function LegalDocument({ title, lede, children }: { title: string; lede: string; children: React.ReactNode }) {
  return (
    <div className="min-h-[100svh]">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5">
          <Logo />
          <Link href="/" className="text-sm text-muted hover:text-ink">
            Home
          </Link>
        </div>
      </header>
      <article className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        <p className="text-[13px] font-medium text-muted">Updated {LEGAL_UPDATED}</p>
        <h1 className="mt-2 font-display text-[40px] leading-[1.05] tracking-tight sm:text-[52px]">{title}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink-soft">{lede}</p>
        <div className="mt-10 space-y-8 text-[15px] leading-relaxed text-ink-soft">{children}</div>
      </article>
      <footer className="border-t border-line px-5 py-8">
        <div className="mx-auto flex max-w-3xl flex-col gap-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>Simply Fit · general fitness guidance, not medical advice.</p>
          <LegalLinks className="flex flex-wrap gap-4" />
        </div>
      </footer>
    </div>
  );
}
