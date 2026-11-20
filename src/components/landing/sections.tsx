"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useInView } from "motion/react";
import { Activity, ArrowRight, Check, Dumbbell, Footprints, HeartPulse, Moon, Scale, Sparkles, Timer } from "lucide-react";
import { BillingAssurance, PlanCards, startPlan, useViewerPlan } from "@/components/billing/plan-cards";
import { ButtonLink } from "@/components/ui/button";
import { Slider } from "@/components/ui/field";
import { MiniBars, Sparkline } from "@/components/ui/data";
import { buildPlan, defaultLevers, rateForCalories } from "@/lib/plan";
import type { AccountTier } from "@/lib/billing";
import { EXAMPLE_INTAKE } from "@/lib/data/seed";
import { formatRate } from "@/lib/units";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.8, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function SectionHead({ kicker, title, body }: { kicker: string; title: React.ReactNode; body: string }) {
  return (
    <Reveal className="max-w-xl">
      <p className="mb-3 text-[13px] font-medium uppercase tracking-[0.14em] text-accent">{kicker}</p>
      <h2 className="font-display text-[40px] leading-[1.02] tracking-tight sm:text-[52px]">{title}</h2>
      <p className="mt-4 text-[17px] leading-relaxed text-ink-soft">{body}</p>
    </Reveal>
  );
}

/* ---------------- How it works ---------------- */

export function HowItWorks() {
  const steps = [
    { n: "01", title: "Tell us about your real life", body: "Your schedule, training, steps, sleep, food preferences, and what you're working toward. Skip anything that doesn't apply." },
    { n: "02", title: "Get one clear plan", body: "Calories, macros, training days, cardio, steps, and sleep — calculated for you, with a plain-language reason for each." },
    { n: "03", title: "Just do today", body: "Open the app and see what matters right now. Log a meal in a sentence, tick off sets, and let the plan adapt." },
  ];
  return (
    <section id="how-it-works" className="scroll-mt-20 px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHead kicker="How it works" title={<>Three steps. Then it's just your day.</>} body="Simply Fit does the planning math so you don't have to — and explains it, so you always know why." />
        <div className="mt-14 grid gap-px overflow-hidden rounded-[28px] border border-line bg-line md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.08} className="bg-surface p-7 sm:p-8">
              <span className="font-display text-[44px] leading-none text-accent/70">{s.n}</span>
              <h3 className="mt-6 text-lg font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Personalized plans (interactive tradeoff) ---------------- */

export function PlansSection() {
  const units = { weight: "lb" as const, height: "imperial" as const };
  const base = useMemo(() => buildPlan(EXAMPLE_INTAKE, defaultLevers(EXAMPLE_INTAKE), { units }), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [extraFood, setExtraFood] = useState(0);
  const [extraSteps, setExtraSteps] = useState(0);

  const levers = { ...base.levers, stepTarget: base.levers.stepTarget + extraSteps };
  const atPace = buildPlan(EXAMPLE_INTAKE, levers, { units });
  const calories = base.calorieTarget + extraFood;
  const rate = rateForCalories(EXAMPLE_INTAKE, levers, calories);
  const plan = buildPlan(EXAMPLE_INTAKE, { ...levers, weeklyRateKg: rate }, { units });

  const message =
    extraFood === 0 && extraSteps === 0
      ? "Your starting plan. Drag a slider to see the tradeoff."
      : extraSteps > 0 && extraFood > 0
        ? `${extraSteps.toLocaleString()} more steps a day covers ~${atPace.calorieTarget - base.calorieTarget} of those extra calories.`
        : extraSteps > 0
          ? `More steps means faster progress at the same food — or ~${atPace.calorieTarget - base.calorieTarget} more calories at the same pace.`
          : `More food is fine — it just slows the pace. Add ~${Math.round((extraFood / (EXAMPLE_INTAKE.weightKg * 0.5)) * 1000 / 500) * 500} steps a day to keep it.`;

  return (
    <section className="px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
        <SectionHead
          kicker="Personalized plans"
          title={<>A plan built around your life, not a template.</>}
          body="Want more food? Fewer cardio sessions? A gentler pace? Move a slider and Simply Fit shows exactly what changes — in plain language, with no math required."
        />
        <Reveal delay={0.1}>
          <div className="rounded-[28px] border border-line bg-surface p-6 shadow-[var(--shadow-lift)] sm:p-8">
            <div className="flex items-baseline justify-between">
              <p className="text-[13px] font-medium text-muted">Daily calories</p>
              <p className="text-[13px] text-muted">22 · 6′0″ · 170 lb · lifts daily</p>
            </div>
            <p className="mt-1 font-display text-[64px] leading-none tabular">{plan.calorieTarget.toLocaleString()}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
              <span className="rounded-full bg-accent-soft px-2.5 py-1 font-medium text-accent-strong">{formatRate(plan.levers.weeklyRateKg, units)}</span>
              <span className="rounded-full bg-sunken px-2.5 py-1 text-ink-soft">{plan.proteinG} g protein</span>
              <span className="rounded-full bg-sunken px-2.5 py-1 text-ink-soft">{plan.levers.stepTarget.toLocaleString()} steps</span>
            </div>
            <div className="mt-7 space-y-5">
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>More food</span>
                  <span className="tabular text-muted">+{extraFood} kcal</span>
                </div>
                <Slider ariaLabel="More food" value={extraFood} onChange={setExtraFood} min={0} max={400} step={50} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span>More steps</span>
                  <span className="tabular text-muted">+{extraSteps.toLocaleString()}/day</span>
                </div>
                <Slider ariaLabel="More steps" value={extraSteps} onChange={setExtraSteps} min={0} max={5000} step={500} />
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.p
                key={message}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.25 }}
                className="mt-6 rounded-2xl bg-accent-tint px-4 py-3 text-[14px] leading-relaxed text-accent-strong"
              >
                {message}
              </motion.p>
            </AnimatePresence>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- AI nutrition logging ---------------- */

const CHAT = [
  { from: "user", text: "I had 150g white rice and 8 oz chicken breast for lunch" },
  { from: "ai", text: "Were those weighed cooked or uncooked? And any oil or sauce on the chicken?" },
  { from: "user", text: "Cooked. Grilled with a teaspoon of olive oil." },
] as const;

export function NutritionSection() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  return (
    <section className="bg-surface px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-[1fr_1.05fr]">
        <div className="lg:order-2">
          <SectionHead
            kicker="AI nutrition logging"
            title={<>Log meals the way you'd text a friend.</>}
            body="Type what you ate. Simply Fit asks only what it needs — cooked or raw, oil or sauce — then shows the estimate for you to confirm. No barcode hunting, no searching through 40 versions of “chicken.”"
          />
        </div>
        <div ref={ref} className="rounded-[28px] border border-line bg-canvas p-4 sm:p-6 lg:order-1">
          <div className="space-y-3">
            {CHAT.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={inView ? { opacity: 1, y: 0, scale: 1 } : {}}
                transition={{ delay: 0.2 + i * 0.7, type: "spring", stiffness: 300, damping: 28 }}
                className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}
              >
                <div className={cn("max-w-[85%] rounded-[20px] px-4 py-2.5 text-[15px] leading-snug", m.from === "user" ? "rounded-br-md bg-ink text-canvas" : "rounded-bl-md border border-line bg-surface text-ink")}>
                  {m.text}
                </div>
              </motion.div>
            ))}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 2.4, type: "spring", stiffness: 260, damping: 26 }}
              className="rounded-[20px] border border-line bg-surface p-4"
            >
              <div className="flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
                  <Sparkles className="size-3.5 text-accent" /> Estimate · Lunch
                </p>
                <p className="text-[13px] text-muted">Review before logging</p>
              </div>
              {[
                ["White rice (cooked)", "150 g", 195],
                ["Chicken breast (cooked)", "8 oz", 374],
                ["Olive oil", "1 tsp", 40],
              ].map(([n, q, c]) => (
                <div key={n as string} className="flex items-center justify-between border-b border-line py-2.5 text-[14px] last:border-0">
                  <span>
                    {n} <span className="text-muted">· {q}</span>
                  </span>
                  <span className="tabular text-ink-soft">{c} kcal</span>
                </div>
              ))}
              <div className="mt-3 flex items-center justify-between">
                <p className="text-[13px] text-muted">
                  <span className="font-semibold text-ink">609 kcal</span> · 74 P · 42 C · 13 F
                </p>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3.5 py-1.5 text-[13px] font-medium text-canvas">
                  <Check className="size-3.5" /> Log to Lunch
                </span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------- One dashboard ---------------- */

export function DashboardSection() {
  const rows = [
    { icon: <Dumbbell className="size-4" />, label: "Training", value: "4 of 5 sessions", spark: [60, 62, 61, 64, 66, 65, 68, 70], tone: "var(--color-accent)" },
    { icon: <Timer className="size-4" />, label: "Cardio", value: "140 / 180 min", spark: [20, 30, 0, 25, 30, 35, 0, 30], tone: "var(--color-clay)" },
    { icon: <Footprints className="size-4" />, label: "Steps", value: "9,840 avg", spark: [8.2, 9.1, 10.4, 9.7, 11.2, 8.8, 10.1, 9.9], tone: "var(--color-accent)" },
    { icon: <Moon className="size-4" />, label: "Sleep", value: "7h 36m avg", spark: [7.2, 7.8, 6.9, 7.5, 8.1, 7.6, 7.9, 7.4], tone: "var(--color-sky)" },
    { icon: <Scale className="size-4" />, label: "Weight", value: "171.2 lb · ↓0.8/wk", spark: [174, 173.6, 173.8, 173.1, 172.6, 172.4, 171.8, 171.2], tone: "var(--color-ink-soft)" },
  ];
  return (
    <section className="px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          kicker="One dashboard"
          title={<>Training, cardio, steps, sleep, and weight. Finally together.</>}
          body="Each part of your health affects the others. Seeing them in one calm view makes it obvious what to adjust — and what's already working."
        />
        <Reveal delay={0.1} className="mt-12">
          <div className="overflow-hidden rounded-[28px] border border-line bg-surface">
            {rows.map((r, i) => (
              <motion.div
                key={r.label}
                initial={{ opacity: 0, x: -12 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.15 + i * 0.07, duration: 0.6, ease }}
                className="flex items-center gap-4 border-b border-line px-5 py-4 last:border-0 sm:px-8 sm:py-5"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-sunken text-ink-soft">{r.icon}</span>
                <span className="w-24 text-[15px] font-medium sm:w-40">{r.label}</span>
                <span className="flex-1 text-[15px] tabular text-ink-soft">{r.value}</span>
                <Sparkline values={r.spark} color={r.tone} width={120} height={32} className="hidden sm:block" />
              </motion.div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Progress ---------------- */

export function ProgressSection() {
  const weights = [174.4, 174.9, 173.8, 174.2, 173.5, 173.9, 173.1, 172.8, 173.4, 172.6, 172.2, 172.9, 172.0, 171.6, 172.1, 171.4];
  const avg = weights.map((_, i) => {
    const w = weights.slice(Math.max(0, i - 6), i + 1);
    return w.reduce((a, b) => a + b, 0) / w.length;
  });
  return (
    <section className="bg-surface px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
        <SectionHead
          kicker="Progress"
          title={<>Progress you can read in ten seconds.</>}
          body="Daily weight bounces around. Simply Fit shows the rolling trend, the habits behind it, and a short weekly review in plain language — never a wall of charts."
        />
        <Reveal delay={0.1}>
          <div className="rounded-[28px] border border-line bg-canvas p-6 sm:p-8">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[13px] text-muted">7-day average</p>
                <p className="font-display text-[48px] leading-none tabular">171.9</p>
              </div>
              <p className="rounded-full bg-accent-soft px-2.5 py-1 text-[13px] font-medium text-accent-strong">↓ 0.9 lb / week</p>
            </div>
            <div className="relative mt-6">
              <Sparkline values={weights} color="var(--color-faint)" fill={false} width={460} height={110} className="absolute inset-0 h-full w-full" />
              <Sparkline values={avg} color="var(--color-accent)" width={460} height={110} className="relative h-auto w-full" />
            </div>
            <div className="mt-6 rounded-2xl border border-line bg-surface p-4">
              <p className="text-[13px] font-medium text-muted">Weekly review</p>
              <p className="mt-1.5 text-[15px] leading-relaxed">
                4 workouts done and protein hit 5 of 7 days. Your trend is right on pace. One focus for next week: a 10-minute walk after dinner.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Activity logging ---------------- */

export function HealthSection() {
  return (
    <section className="px-5 py-24 sm:px-8 sm:py-32">
      <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
        <SectionHead
          kicker="Activity, logged simply"
          title={<>Steps, sleep, and cardio, in the same place.</>}
          body="Log them in a few taps. Steps, sleep, cardio, and weight sit next to your plan, and you type the numbers yourself."
        />
        <Reveal delay={0.1}>
          <div className="mx-auto w-full max-w-sm rounded-[36px] border border-line bg-surface p-3 shadow-[var(--shadow-lift)]">
            <div className="rounded-[28px] bg-canvas p-5">
              <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Logged today</p>
              <div className="mt-4 space-y-2">
                {[
                  { icon: <Footprints className="size-4" />, l: "Steps", v: "11,204", s: "Entered by you" },
                  { icon: <Moon className="size-4" />, l: "Sleep", v: "7h 52m", s: "Entered by you" },
                  { icon: <Activity className="size-4" />, l: "Cycling", v: "32 min", s: "Entered by you" },
                  { icon: <HeartPulse className="size-4" />, l: "Weight", v: "171.4 lb", s: "Entered by you" },
                ].map((r, i) => (
                  <motion.div
                    key={r.l}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.2 + i * 0.12, type: "spring", stiffness: 260, damping: 26 }}
                    className="flex items-center gap-3 rounded-2xl bg-surface px-3.5 py-3"
                  >
                    <span className="grid size-8 place-items-center rounded-xl bg-accent-soft text-accent">{r.icon}</span>
                    <span className="flex-1">
                      <span className="block text-[14px] font-medium">{r.l}</span>
                      <span className="block text-[12px] text-muted">{r.s}</span>
                    </span>
                    <span className="text-[14px] tabular">{r.v}</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Pricing ---------------- */

export function PricingSection() {
  const viewer = useViewerPlan();
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    const flag = new URLSearchParams(window.location.search).get("billing");
    if (flag === "cancel") setNote("Checkout closed. Your plan is unchanged.");
  }, []);

  async function choose(plan: AccountTier) {
    if (viewer.tier === plan) return;
    if (!viewer.signedIn) {
      window.location.assign(plan === "free" ? "/signup" : `/signup?plan=${plan}`);
      return;
    }
    setBusy(plan);
    setNote(null);
    try {
      await startPlan(plan, "/settings");
    } catch (error) {
      setNote(error instanceof Error ? error.message : "Couldn't open billing.");
      setBusy(null);
    }
  }

  return (
    <section id="pricing" className="scroll-mt-20 px-5 py-24 sm:px-8 sm:py-28">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          kicker="Pricing"
          title={<>Start free. Pay when the AI becomes the habit.</>}
          body="The plan, the log, and your history stay on every account. A new Paid or Unlimited subscription starts with an account, then opens Stripe."
        />
        <div className="mt-12">
          <PlanCards layout="marketing" current={viewer.tier} subscriber={viewer.subscriber} busy={busy} onChoose={choose} />
          <BillingAssurance />
          {note && <p className="mt-4 text-[13px] text-clay">{note}</p>}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Final CTA ---------------- */

export function FinalCta() {
  return (
    <section className="px-5 pb-16 pt-8 sm:px-8 sm:pb-24">
      <Reveal className="mx-auto max-w-6xl">
        <div className="relative overflow-hidden rounded-[36px] bg-brand px-6 py-16 text-center text-chalk sm:px-12 sm:py-24">
          <MiniBars
            values={[3, 5, 4, 6, 5, 7, 6, 8, 7, 9, 8, 10, 9, 11, 10, 12]}
            height={160}
            color="bg-white/10"
            className="pointer-events-none absolute inset-x-6 bottom-0 opacity-60"
          />
          <h2 className="relative font-display text-[44px] leading-[1] tracking-tight sm:text-[64px]">
            Your plan is a few
            <br className="hidden sm:block" /> questions away.
          </h2>
          <p className="relative mx-auto mt-5 max-w-md text-[17px] text-chalk-dim">
            Create a free account, answer what's relevant, and get a clear plan for food, training, activity, and recovery in about three minutes.
          </p>
          <div className="relative mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/signup" size="lg" className="bg-chalk text-iron hover:bg-white">
              Build My Plan <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink href="/login" size="lg" variant="ghost" className="text-chalk hover:bg-white/10">
              I have an account
            </ButtonLink>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
