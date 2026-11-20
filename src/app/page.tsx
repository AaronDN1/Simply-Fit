import Link from "next/link";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";
import { LandingAuthAction } from "@/components/landing/auth-action";
import { Hero } from "@/components/landing/hero";
import { LegalLinks, SupportEmail } from "@/components/legal/document";
import { DashboardSection, FinalCta, HealthSection, HowItWorks, NutritionSection, PlansSection, PricingSection, ProgressSection } from "@/components/landing/sections";

export default function LandingPage() {
  return (
    <div className="grain relative">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-transparent bg-canvas/75 backdrop-blur-md">
        <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <div className="hidden items-center gap-7 text-sm text-ink-soft md:flex">
            <Link href="#how-it-works" className="hover:text-ink">
              How it works
            </Link>
            <Link href="#features" className="hover:text-ink">
              Features
            </Link>
          </div>
          <div className="flex items-center gap-1.5">
            <LandingAuthAction />
            <ButtonLink href="/signup" size="sm">
              Build My Plan
            </ButtonLink>
          </div>
        </nav>
      </header>
      <main>
        <Hero />
        <HowItWorks />
        <div id="features" className="scroll-mt-16">
          <PlansSection />
          <NutritionSection />
          <DashboardSection />
          <ProgressSection />
          <HealthSection />
        </div>
        <PricingSection />
        <FinalCta />
      </main>
      <footer className="border-t border-line px-5 py-10 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 text-sm text-muted sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Logo />
            <p className="mt-3 max-w-sm text-[13px] leading-relaxed">
              Simply Fit offers general fitness and nutrition guidance, not medical advice. Talk to a qualified professional about medical conditions, pregnancy, or
              eating-disorder concerns.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <div className="flex gap-6">
              <Link href="/login" className="hover:text-ink">
                Sign in
              </Link>
              <Link href="/signup" className="hover:text-ink">
                Create account
              </Link>
            </div>
            <LegalLinks className="flex flex-wrap gap-4" />
            <SupportEmail className="text-[13px]" />
          </div>
        </div>
      </footer>
    </div>
  );
}
