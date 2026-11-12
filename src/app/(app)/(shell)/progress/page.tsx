"use client";

import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Dumbbell, Flag, Footprints, Moon, Scale, Soup, Sparkles, Timer } from "lucide-react";
import { Card, PageHeader, SectionTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/field";
import { Bar, MiniBars, Ring, Sparkline } from "@/components/ui/data";
import { WeightForm } from "@/components/app/quick-log";
import { useStore } from "@/lib/store";
import {
  average,
  cardioMinutesOn,
  nutritionAdherence,
  projectGoal,
  sleepSeries,
  stepSeries,
  strengthHighlights,
  weeklyReview,
  weightSeries,
  weightTrend,
  workoutCompletion,
} from "@/lib/stats";
import { displayWeight } from "@/lib/units";
import { addDays, formatDay, lastNDays, todayISO } from "@/lib/utils";

export default function ProgressPage() {
  const { data } = useStore();
  const { plan, settings } = data.profile;
  const units = settings.units;
  const [range, setRange] = useState<"30" | "90">("30");
  const days = Number(range);

  const series = useMemo(() => weightSeries(data.daily, days), [data.daily, days]);
  const trend = weightTrend(data.daily);
  const lastAvg = [...series].reverse().find((p) => p.avg != null)?.avg ?? null;
  const goal = projectGoal(data.profile, data.daily);
  const nutrition = nutritionAdherence(data.foods, plan, 14);
  const workouts = workoutCompletion(data.workouts, data.profile.split, 28, data.profile.onboardedAt);
  const steps = stepSeries(data.daily, 14);
  const sleep = sleepSeries(data.daily, 14);
  const cardio = lastNDays(14).map((d) => cardioMinutesOn(data.cardio, d));
  const strength = strengthHighlights(data.workouts, 4);
  const review = weeklyReview(data.profile, data, units);
  const stepDays = steps.filter((s) => s != null && plan && s >= plan.levers.stepTarget).length;
  const loggedSteps = steps.filter((s) => s != null).length;

  return (
    <div>
      <PageHeader title="Progress" description="The trends that matter, without the noise." />

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
                <Scale className="size-4" /> Weight · 7-day average
              </p>
              <p className="mt-1 font-display text-[52px] leading-none tabular">{lastAvg ? displayWeight(lastAvg, units) : "—"}</p>
              <p className="mt-2 text-[14px] text-muted">
                {trend != null ? (
                  <>
                    Trending <span className="font-medium text-ink">{trend > 0 ? "+" : ""}{displayWeight(trend, units, units.weight === "lb" ? 1 : 2)} {units.weight}/week</span>
                    {plan && <> · plan {plan.levers.weeklyRateKg > 0 ? "+" : ""}{displayWeight(plan.levers.weeklyRateKg, units, units.weight === "lb" ? 1 : 2)}</>}
                  </>
                ) : (
                  "Log a few weigh-ins this week to see your trend."
                )}
              </p>
            </div>
            <Segmented size="sm" value={range} onChange={setRange} options={[{ value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} />
          </div>
          <WeightChart series={series} units={units} />
          <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <p className="text-[12px] text-muted">Dots are daily weigh-ins; the line is your 7-day average. Daily swings of 1–2% are mostly water and food volume.</p>
            <div className="w-full sm:w-64">
              <WeightForm />
            </div>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <SectionTitle title="Goal projection" action={<Flag className="size-4 text-accent" />} />
            {goal ? (
              goal.reached ? (
                <p className="text-[15px]">You're at your goal weight. Consider switching your goal to maintenance in your plan.</p>
              ) : goal.weeks ? (
                <>
                  <p className="font-display text-[34px] leading-tight">~{formatDay(addDays(todayISO(), goal.weeks * 7), { month: "long", day: "numeric" })}</p>
                  <p className="mt-1 text-[14px] text-muted">
                    {displayWeight(Math.abs(goal.goal - goal.current), units)} {units.weight} to go · about {goal.weeks} weeks at your {goal.basis === "trend" ? "current trend" : "planned pace"}.
                  </p>
                  <Bar
                    className="mt-4"
                    value={data.profile.intake ? 1 - Math.abs(goal.goal - goal.current) / Math.max(0.1, Math.abs(goal.goal - data.profile.intake.weightKg)) : 0}
                  />
                </>
              ) : (
                <p className="text-[14px] text-muted">Your recent trend is moving away from your goal. That's common for a week or two — keep logging and we'll update this.</p>
              )
            ) : (
              <p className="text-[14px] text-muted">Add a goal weight in your plan settings to see a projection.</p>
            )}
          </Card>

          <Card className="p-5 sm:p-6">
            <SectionTitle title="Weekly review" action={<Sparkles className="size-4 text-accent" />} />
            <div className="space-y-4">
              {review.map((r, i) => (
                <motion.div key={r.title} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}>
                  <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted">{r.title}</p>
                  <p className="mt-1 text-[15px] leading-relaxed">{r.body}</p>
                </motion.div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-[15px] font-semibold tracking-tight">Consistency · last 2 weeks</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          icon={<Soup className="size-4" />}
          label="Nutrition"
          ring={nutrition.logged ? nutrition.onTarget / nutrition.logged : 0}
          value={nutrition.logged ? `${nutrition.onTarget}/${nutrition.logged}` : "—"}
          sub="logged days within 10% of target"
          extra={nutrition.logged ? `Protein hit ${nutrition.proteinHit} of ${nutrition.logged} days` : "Counts from your first full logged day"}
        />
        <Stat
          icon={<Dumbbell className="size-4" />}
          label="Workouts"
          ring={workouts.rate}
          value={`${workouts.completed}/${workouts.scheduled}`}
          sub="planned sessions · 4 weeks"
          extra={`${Math.round(workouts.rate * 100)}% completion`}
        />
        <Stat
          icon={<Footprints className="size-4" />}
          label="Steps"
          ring={loggedSteps ? stepDays / loggedSteps : 0}
          value={average(steps) === null ? "—" : Math.round(average(steps)!).toLocaleString()}
          sub="daily average"
          extra={`Target hit ${stepDays} of ${loggedSteps} days`}
          chart={<MiniBars values={steps} target={plan?.levers.stepTarget} height={32} />}
        />
        <Stat
          icon={<Moon className="size-4" />}
          label="Sleep"
          ring={plan ? Math.min(1, (average(sleep) ?? 0) / plan.sleepTargetHours) : 0}
          value={average(sleep) === null ? "—" : `${average(sleep)!.toFixed(1)} h`}
          sub="nightly average"
          extra={plan ? `Target ${plan.sleepTargetHours} h` : ""}
          chart={<MiniBars values={sleep} target={plan?.sleepTargetHours} height={32} color="bg-sky" />}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card className="p-5 sm:p-6">
          <SectionTitle title="Macro consistency" description="Daily calories and protein vs. target" />
          <div className="space-y-4">
            <div>
              <p className="mb-1.5 text-[12px] text-muted">Calories · target {plan?.calorieTarget.toLocaleString()}</p>
              <MiniBars values={nutrition.calories.map((c) => c || null)} target={plan?.calorieTarget} height={48} color="bg-honey" />
            </div>
            <div>
              <p className="mb-1.5 text-[12px] text-muted">Protein · target {plan?.proteinG} g</p>
              <MiniBars values={nutrition.protein.map((c) => c || null)} target={plan?.proteinG} height={48} />
            </div>
          </div>
        </Card>
        <Card className="p-5 sm:p-6">
          <SectionTitle title="Strength" description="Estimated max on your most-trained lifts" />
          {strength.length ? (
            <ul className="divide-y divide-line">
              {strength.map((s) => (
                <li key={s.id} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{s.name}</span>
                    <span className="block text-[12px] text-muted">{s.best > 0 ? `${displayWeight(s.best, units, 0)} ${units.weight} e1RM` : "Bodyweight"}</span>
                  </span>
                  {s.best > 0 && <Sparkline values={s.series} width={80} height={26} fill={false} />}
                  <span className="w-12 text-right text-[13px] font-medium text-accent">{s.change > 0.005 ? `+${Math.round(s.change * 100)}%` : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[14px] text-muted">Finish a few workouts and your strength trends will appear here.</p>
          )}
          <div className="mt-4 flex items-center gap-2 border-t border-line pt-4 text-[13px] text-muted">
            <Timer className="size-4 text-clay" /> Cardio: {cardio.reduce((a, b) => a + b, 0)} min over 2 weeks · {cardio.filter(Boolean).length} active days
          </div>
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon, label, ring, value, sub, extra, chart }: { icon: React.ReactNode; label: string; ring: number; value: string; sub: string; extra?: string; chart?: React.ReactNode }) {
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-muted">
          {icon}
          {label}
        </p>
        <Ring value={ring} size={30} stroke={3.5} />
      </div>
      <p className="mt-3 text-[24px] font-semibold tracking-tight tabular">{value}</p>
      <p className="text-[12px] text-muted">{sub}</p>
      {chart && <div className="mt-3">{chart}</div>}
      {extra && <p className="mt-2 text-[12px] text-ink-soft">{extra}</p>}
    </Card>
  );
}

function WeightChart({ series, units }: { series: { date: string; weight: number | null; avg: number | null }[]; units: { weight: "lb" | "kg"; height: "imperial" | "metric" } }) {
  const W = 640;
  const H = 180;
  const pad = { l: 8, r: 40, t: 12, b: 22 };
  const vals = series.flatMap((p) => [p.weight, p.avg]).filter((v): v is number => v != null);
  if (vals.length < 2) return <div className="mt-6 grid h-[180px] place-items-center rounded-2xl bg-canvas text-[13px] text-muted">Your weight chart appears after a couple of weigh-ins.</div>;
  const min = Math.min(...vals) - 0.3;
  const max = Math.max(...vals) + 0.3;
  const x = (i: number) => pad.l + (i / (series.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);
  const avgPts = series.map((p, i) => ({ i, v: p.avg })).filter((p): p is { i: number; v: number } => p.v != null);
  const d = avgPts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const ticks = [min + 0.3, (min + max) / 2, max - 0.3];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-6 h-auto w-full" role="img" aria-label="Weight trend chart">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="var(--color-line)" strokeDasharray="2 4" />
          <text x={W - pad.r + 6} y={y(t) + 4} fontSize="11" fill="var(--color-faint)">
            {displayWeight(t, units, 1)}
          </text>
        </g>
      ))}
      {series.map((p, i) =>
        p.weight != null ? <circle key={p.date} cx={x(i)} cy={y(p.weight)} r={2.5} fill="var(--color-line-strong)" /> : null
      )}
      <motion.path d={d} fill="none" stroke="var(--color-accent)" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }} />
      {[0, Math.floor(series.length / 2), series.length - 1].map((i) => (
        <text key={i} x={x(i)} y={H - 4} fontSize="11" fill="var(--color-faint)" textAnchor={i === 0 ? "start" : i === series.length - 1 ? "end" : "middle"}>
          {formatDay(series[i].date, { month: "short", day: "numeric" })}
        </text>
      ))}
    </svg>
  );
}
