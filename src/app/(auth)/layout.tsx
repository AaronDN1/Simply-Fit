import { Logo } from "@/components/logo";
import { LegalLinks, SupportEmail } from "@/components/legal/document";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[100svh] lg:grid-cols-[1fr_1.1fr]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <Logo />
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[380px]">{children}</div>
        </div>
        <div className="flex flex-col items-center gap-2 text-center text-[12px] text-faint lg:items-start lg:text-left">
          <p>General fitness guidance, not medical advice.</p>
          <p>
            Support: <SupportEmail />
          </p>
          <LegalLinks className="flex flex-wrap justify-center gap-3 lg:justify-start" />
        </div>
      </div>
      <aside className="relative hidden overflow-hidden bg-brand lg:block">
        <div className="absolute inset-0 flex flex-col justify-end p-14 text-chalk">
          <p className="font-display text-[56px] leading-[0.98] tracking-tight">
            Plan less.
            <br />
            <span className="italic text-chalk-dim">Do more.</span>
          </p>
          <p className="mt-5 max-w-sm text-[16px] leading-relaxed text-chalk-dim">
            One clear plan for your food, training, activity, recovery, and goals. You focus on doing the work.
          </p>
        </div>
        <svg className="absolute -right-24 -top-24 size-[520px] text-white/[0.06]" viewBox="0 0 200 200" aria-hidden>
          {Array.from({ length: 7 }).map((_, i) => (
            <circle key={i} cx="100" cy="100" r={20 + i * 12} fill="none" stroke="currentColor" strokeWidth="1" />
          ))}
        </svg>
      </aside>
    </div>
  );
}
