"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, Check, ChevronRight, Dumbbell, Footprints, HeartPulse, Moon, Scale, Timer, X } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedNumber, Bar, MiniBars, Ring, Sparkline } from "@/components/ui/data";
import { CardioForm, CheckInForm, SleepForm, StepsForm, WeightForm } from "@/components/app/quick-log";
import { useStore } from "@/lib/store";
import { nextActionCopy, todayPlan, type ActionKey } from "@/lib/today";
import { average, latest, sleepSeries, stepSeries, weightSeries, weightTrend } from "@/lib/stats";
import { displayWeight, formatWeight } from "@/lib/units";
import { readinessAdvice, readinessScore } from "@/lib/plan";
import { nativeBridge } from "@/lib/health";
import { mealForTime } from "@/lib/foods";
import { WorkoutCheckoff } from "@/components/app/workout-checkoff";
import { cn, formatDay, greeting, lastNDays, todayISO } from "@/lib/utils";

type DetailKey = "workout" | "cardio" | "steps" | "sleep" | "weight" | "recovery";

export default function TodayPage() {
  const router = useRouter();
  const { data } = useStore();
  const [date] = useState(todayISO);
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState<DetailKey | null>(null);
  const [nativePlatform, setNativePlatform] = useState(false);
  useEffect(() => {
    setNativePlatform(!!nativeBridge());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const plan = data.profile.plan!;
  const units = data.profile.settings.units;
  const t = useMemo(() => todayPlan(data, date, now), [data, date, now]);
  const name = data.profile.displayName.split(" ")[0];
  const meal = mealForTime(now);
  const copy = nextActionCopy(t.next?.key, { remaining: t.remaining, mealHint: meal === "snack" ? "a snack" : meal, dayName: t.day?.name });

  const doneCount = t.actions.filter((a) => !a.optional && a.done).length;
  const totalRequired = t.actions.filter((a) => !a.optional).length;

  function act(key: ActionKey | undefined) {
    const map: Partial<Record<ActionKey, DetailKey>> = { checkin: "recovery", cardio: "cardio", steps: "steps", weigh: "weight" };
    if (!key) return router.push("/progress");
    if (key === "meals") return router.push("/nutrition");
    if (key === "workout") return router.push("/training");
    setOpen(map[key] ?? null);
  }

  const weightLatest = latest(data.daily, "weightKg");
  const trend = weightTrend(data.daily);
  const sleepLast = t.log?.sleepHours ?? null;
  const readiness = t.log?.readiness ? readinessAdvice(readinessScore(t.log.readiness)) : null;

  const cards: { key: DetailKey; icon: React.ReactNode; label: string; value: React.ReactNode; sub: string; progress?: number; tone: string; spark?: (number | null)[] }[] = [
    {
      key: "workout",
      icon: <Dumbbell className="size-4" />,
      label: "Workout",
      value: t.day && !t.day.isRest ? t.day.name : "Rest day",
      sub: t.workoutDone ? "Completed" : t.day && !t.day.isRest ? `${t.day.exercises.length} exercises · next: ${t.day.exercises[0]?.name ?? "—"}` : "Recover and move lightly",
      progress: t.workoutLog ? t.workoutLog.sets.filter((s) => s.done).length / Math.max(1, t.workoutLog.sets.length) : t.workoutDone ? 1 : 0,
      tone: "var(--color-accent)",
    },
    {
      key: "cardio",
      icon: <Timer className="size-4" />,
      label: "Cardio",
      value: (
        <>
          <AnimatedNumber value={t.doneCardio} /> <span className="text-muted">{t.plannedCardio ? `/ ${t.plannedCardio} min` : "min"}</span>
        </>
      ),
      sub: t.plannedCardio ? (t.doneCardio >= t.plannedCardio ? "Done for today" : "Planned today") : "None planned today",
      progress: t.plannedCardio ? t.doneCardio / t.plannedCardio : undefined,
      tone: "var(--color-clay)",
    },
    {
      key: "steps",
      icon: <Footprints className="size-4" />,
      label: "Steps",
      value: (
        <>
          <AnimatedNumber value={t.steps} /> <span className="text-muted">/ {(plan.levers.stepTarget / 1000).toFixed(plan.levers.stepTarget % 1000 ? 1 : 0)}k</span>
        </>
      ),
      sub: nativePlatform && t.log?.stepsSource && t.log.stepsSource !== "manual" ? "Synced from your phone" : "Tap to update",
      progress: t.steps / plan.levers.stepTarget,
      tone: "var(--color-accent)",
    },
    {
      key: "sleep",
      icon: <Moon className="size-4" />,
      label: "Sleep",
      value: sleepLast != null ? `${Math.floor(sleepLast)}h ${Math.round((sleepLast % 1) * 60)}m` : "—",
      sub: `Target ${plan.sleepTargetHours} h`,
      spark: sleepSeries(data.daily, 10),
      tone: "var(--color-sky)",
    },
    {
      key: "weight",
      icon: <Scale className="size-4" />,
      label: "Weight",
      value: weightLatest ? formatWeight(weightLatest.value, units) : "—",
      sub: trend != null ? `${trend > 0 ? "+" : ""}${displayWeight(trend, units, 2)} ${units.weight}/wk trend` : "Log a few weigh-ins to see a trend",
      spark: weightSeries(data.daily, 21).map((p) => p.avg),
      tone: "var(--color-ink-soft)",
    },
    {
      key: "recovery",
      icon: <HeartPulse className="size-4" />,
      label: "Recovery",
      value: readiness ? readiness.label : "Check in",
      sub: readiness ? `Readiness ${readinessScore(t.log!.readiness!)} / 100` : "How are you feeling today?",
      tone: "var(--color-honey)",
    },
  ];

  return (
    <div>
      <header className="mb-6 sm:mb-8">
        <p className="text-[13px] font-medium text-muted">{formatDay(date)}</p>
        <h1 className="mt-1 font-display text-[36px] leading-[1.05] tracking-tight sm:text-[44px]">
          {greeting(now)}
          {name ? `, ${name}` : ""}.
        </h1>
      </header>

      <div className="space-y-4">
        {/* Today's plan */}
        <Card className="overflow-hidden">
          <div className="bg-ink p-5 text-canvas sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-[#b7b2a8]">{t.next ? "Next best step" : "All set"}</p>
                <AnimatePresence mode="wait">
                  <motion.div key={copy.title} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.25 }}>
                    <h2 className="mt-2 font-display text-[30px] leading-tight sm:text-[34px]">{copy.title}</h2>
                    <p className="mt-1.5 max-w-sm text-[15px] text-[#cfcac0]">{copy.body}</p>
                  </motion.div>
                </AnimatePresence>
              </div>
              <Ring value={t.progress} size={58} stroke={5} track="rgb(255 255 255 / 0.12)" color="#9cc3ad">
                <span className="text-[13px] font-semibold tabular">
                  {doneCount}/{totalRequired}
                </span>
              </Ring>
            </div>
            <Button className="mt-5 bg-canvas text-ink hover:bg-white" onClick={() => act(t.next?.key)}>
              {copy.cta} <ArrowRight className="size-4" />
            </Button>
          </div>
          <ul className="divide-y divide-line">
            {t.actions.map((a) => (
              <li key={a.key}>
                <button onClick={() => act(a.key)} className="flex w-full items-center gap-3.5 px-5 py-3.5 text-left transition-colors hover:bg-canvas/60 sm:px-6">
                  <motion.span
                    initial={false}
                    animate={{ scale: a.done ? [1, 1.2, 1] : 1 }}
                    transition={{ duration: 0.35, ease: "easeOut" }}
                    className={cn("grid size-6 shrink-0 place-items-center rounded-full border", a.done ? "border-accent bg-accent text-white" : "border-line-strong")}
                  >
                    {a.done && <Check className="size-3.5" strokeWidth={3} />}
                  </motion.span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-[15px] font-medium", a.done && !a.optional && "text-muted line-through decoration-line-strong")}>
                      {a.title}
                      {a.optional && !a.done && <span className="ml-2 text-[12px] font-normal text-faint">optional</span>}
                    </span>
                    <span className="block truncate text-[13px] text-muted">{a.detail}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-faint" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* Nutrition */}
        <Link href="/nutrition" className="group block">
          <Card className="h-full p-5 transition-shadow group-hover:shadow-[var(--shadow-lift)] sm:p-6">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold tracking-tight">Nutrition</p>
              <span className="text-[13px] text-muted">
                {t.totals.meals} meal{t.totals.meals === 1 ? "" : "s"} logged
              </span>
            </div>
            <div className="mt-5 flex items-center gap-5">
              <Ring value={t.totals.calories / plan.calorieTarget} size={124} stroke={10} color={t.totals.calories > plan.calorieTarget * 1.05 ? "var(--color-honey)" : "var(--color-accent)"}>
                <div className="text-center">
                  <p className="text-[26px] font-semibold leading-none tracking-tight">
                    <AnimatedNumber value={Math.abs(Math.round(t.remaining))} />
                  </p>
                  <p className="mt-1 text-[11px] text-muted">{t.remaining >= 0 ? "kcal left" : "kcal over"}</p>
                </div>
              </Ring>
              <div className="min-w-0 flex-1 space-y-3">
                <Macro label="Protein" value={t.totals.proteinG} target={plan.proteinG} color="bg-accent" />
                <Macro label="Carbs" value={t.totals.carbsG} target={plan.carbsG} color="bg-honey" />
                <Macro label="Fat" value={t.totals.fatG} target={plan.fatG} color="bg-clay" />
              </div>
            </div>
            <div className="mt-5 flex items-center justify-between rounded-2xl bg-canvas px-4 py-3 text-[14px]">
              <span className="text-ink-soft">
                <AnimatedNumber value={Math.round(t.totals.calories)} /> of {plan.calorieTarget.toLocaleString()} kcal eaten
              </span>
              <span className="flex items-center gap-1 font-medium text-accent">
                Log food <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Card>
        </Link>
      </div>

      {/* Essentials */}
      <h2 className="mb-1 mt-8 text-[15px] font-semibold tracking-tight">At a glance</h2>
      <p className="mb-3 max-w-xl text-[13px] leading-relaxed text-muted">These are details. The step at the top is the one to do next.</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:gap-4">
        {cards.map((c) =>
          open === c.key ? (
            <div key={c.key} className="h-[132px] rounded-[var(--radius-card)] border border-dashed border-line" />
          ) : (
            <motion.button
              key={c.key}
              layoutId={`card-${c.key}`}
              onClick={() => setOpen(c.key)}
              className="flex h-[132px] flex-col rounded-[var(--radius-card)] border border-line bg-surface p-4 text-left shadow-[var(--shadow-soft)] transition-shadow hover:shadow-[var(--shadow-lift)] sm:p-5"
            >
              <motion.div layout="position" className="flex w-full items-center justify-between">
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
                  <span style={{ color: c.tone }}>{c.icon}</span>
                  {c.label}
                </span>
                {c.spark && <Sparkline values={c.spark} width={52} height={20} color={c.tone} fill={false} />}
              </motion.div>
              <motion.p layout="position" className="mt-auto truncate text-[19px] font-semibold tracking-tight tabular sm:text-[21px]">
                {c.value}
              </motion.p>
              <motion.p layout="position" className="mt-0.5 truncate text-[12px] text-muted sm:text-[13px]">
                {c.sub}
              </motion.p>
              {c.progress != null && <Bar value={c.progress} className="mt-2.5" height="h-1" color={c.key === "cardio" ? "bg-clay" : "bg-accent"} />}
            </motion.button>
          )
        )}
      </div>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
            <motion.div className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOpen(null)} />
            <motion.div
              layoutId={`card-${open}`}
              role="dialog"
              aria-modal="true"
              className="relative max-h-[90dvh] w-full overflow-y-auto rounded-t-[28px] border border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-[var(--shadow-lift)] sm:max-w-lg sm:rounded-[24px] sm:p-6"
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
            >
              <button onClick={() => setOpen(null)} className="absolute right-4 top-4 grid size-8 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink" aria-label="Close">
                <X className="size-4" />
              </button>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { delay: 0.12 } }} exit={{ opacity: 0, transition: { duration: 0.05 } }}>
                <Detail k={open} close={() => setOpen(null)} />
              </motion.div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Macro({ label, value, target, color }: { label: string; value: number; target: number; color: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-[13px]">
        <span className="text-ink-soft">{label}</span>
        <span className="tabular text-muted">
          <span className="text-ink">{Math.round(value)}</span> / {target} g
        </span>
      </div>
      <Bar value={value / target} color={color} />
    </div>
  );
}

function Detail({ k, close }: { k: DetailKey; close: () => void }) {
  const { data } = useStore();
  const plan = data.profile.plan!;
  const units = data.profile.settings.units;
  const date = todayISO();
  const labels = lastNDays(14).map((d, i) => (i % 2 === 1 ? "" : formatDay(d, { weekday: "narrow" })));
  const t = todayPlan(data, date);

  if (k === "workout") {
    const day = t.day;
    return (
      <div>
        <DetailHead title={day && !day.isRest ? day.name : "Rest day"} sub={day?.focus ?? ""} />
        {day && !day.isRest ? (
          <>
            <ol className="mt-4 divide-y divide-line rounded-2xl border border-line">
              {day.exercises.map((e, i) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3 text-[14px]">
                  <span className="w-5 text-[12px] tabular text-faint">{i + 1}</span>
                  <span className="flex-1 font-medium">{e.name}</span>
                  <span className="tabular text-muted">
                    {e.sets} × {e.repsMin}–{e.repsMax}
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex justify-end">
              <WorkoutCheckoff day={day} log={t.workoutLog} compact />
            </div>
            <Link href="/training" className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-ink text-sm font-medium text-canvas">
              {t.workoutDone ? "View workout" : t.workoutLog ? "Continue workout" : "Start workout"} <ArrowRight className="size-4" />
            </Link>
          </>
        ) : (
          <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">Rest days are when your body adapts to training. An easy walk, some mobility, and good sleep are all you need today.</p>
        )}
      </div>
    );
  }
  if (k === "cardio") {
    const entries = data.cardio.filter((c) => c.date === date);
    return (
      <div>
        <DetailHead title="Cardio" sub={`${t.plannedCardio ? `${t.doneCardio} of ${t.plannedCardio} min planned today` : `${t.doneCardio} min today · none planned`} · ${plan.levers.cardioMinutesPerWeek} min/week target`} />
        {entries.length > 0 && (
          <ul className="mt-4 space-y-1.5">
            {entries.map((e) => (
              <li key={e.id} className="flex justify-between rounded-xl bg-canvas px-3.5 py-2.5 text-[14px]">
                <span>{e.activity}</span>
                <span className="tabular text-muted">
                  {e.minutes} min · {e.intensity}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-5">
          <CardioForm onDone={close} />
        </div>
      </div>
    );
  }
  if (k === "steps") {
    const series = stepSeries(data.daily, 14);
    const avg = average(series.slice(0, -1));
    return (
      <div>
        <DetailHead title="Steps" sub={`Target ${plan.levers.stepTarget.toLocaleString()} · 2-week average ${avg ? Math.round(avg).toLocaleString() : "—"}`} />
        <MiniBars values={series} target={plan.levers.stepTarget} labels={labels} height={90} className="mt-5" />
        <p className="mb-2 mt-6 text-[13px] font-medium text-ink-soft">Today's steps</p>
        <StepsForm onDone={close} />
        <p className="mt-3 text-[12px] text-muted">Enter today's steps here. This browser doesn't sync a phone or watch.</p>
      </div>
    );
  }
  if (k === "sleep") {
    const series = sleepSeries(data.daily, 14);
    const avg = average(series);
    return (
      <div>
        <DetailHead title="Sleep" sub={`Target ${plan.sleepTargetHours} h · 2-week average ${avg ? avg.toFixed(1) : "—"} h`} />
        <MiniBars values={series} target={plan.sleepTargetHours} labels={labels} height={90} className="mt-5" color="bg-sky" />
        <p className="mb-2 mt-6 text-[13px] font-medium text-ink-soft">Last night</p>
        <SleepForm onDone={close} />
      </div>
    );
  }
  if (k === "weight") {
    const series = weightSeries(data.daily, 30);
    const trend = weightTrend(data.daily);
    return (
      <div>
        <DetailHead
          title="Weight"
          sub={trend != null ? `Trend ${trend > 0 ? "+" : ""}${displayWeight(trend, units, 2)} ${units.weight}/week · plan ${displayWeight(plan.levers.weeklyRateKg, units, 2)}` : "A few weigh-ins a week is enough to see a trend."}
        />
        <div className="relative mt-5 h-[100px]">
          <Sparkline values={series.map((p) => p.weight)} color="var(--color-faint)" fill={false} width={440} height={100} className="absolute inset-0 h-full w-full" />
          <Sparkline values={series.map((p) => p.avg)} width={440} height={100} className="absolute inset-0 h-full w-full" />
        </div>
        <p className="mt-2 text-[12px] text-muted">Grey: daily weigh-ins · Green: 7-day average. Day-to-day swings are mostly water.</p>
        <p className="mb-2 mt-5 text-[13px] font-medium text-ink-soft">Today's weight</p>
        <WeightForm onDone={close} />
      </div>
    );
  }
  return (
    <div>
      <DetailHead title="How are you feeling?" sub="A quick read on recovery. We'll suggest how hard to push — never a diagnosis." />
      <div className="mt-5">
        <CheckInForm onDone={close} />
      </div>
    </div>
  );
}

function DetailHead({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="pr-8">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {sub && <p className="mt-1 text-[14px] text-muted">{sub}</p>}
    </div>
  );
}
