import Link from "next/link";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--color-accent)" />
      <path d="M9 19.5c2.2 2.4 4.6 3.5 7 3.5 3.2 0 5.5-1.6 5.5-4 0-5.4-11.5-2.6-11.5-8 0-2.3 2.1-4 5.2-4 2.1 0 4.1.8 5.8 2.4" fill="none" stroke="#f5f2ec" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2", className)} aria-label="Simply Fit home">
      <LogoMark />
      <span className="text-[17px] font-semibold tracking-tight">Simply Fit</span>
    </Link>
  );
}
