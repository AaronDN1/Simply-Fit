"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Footprints, HeartPulse, Link2, Moon, Timer, Trash2 } from "lucide-react";
import { Card, PageHeader, SectionTitle } from "@/components/ui/card";
import { MiniBars } from "@/components/ui/data";
import { CardioForm, CheckInForm, SleepForm, StepsForm } from "@/components/app/quick-log";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { average, cardioMinutesOn, cardioMinutesWeek, sleepSeries, stepSeries } from "@/lib/stats";
import { nativeBridge } from "@/lib/health";
import { readinessAdvice, readinessScore } from "@/lib/plan";
import { cn, formatDay, lastNDays, relativeDayLabel, todayISO } from "@/lib/utils";

export default function ActivityPage() {
  const { data, deleteCardio } = useStore();
  const toast = useToast();
  const [nativePlatform, setNativePlatform] = useState(false);
  useEffect(() => setNativePlatform(!!nativeBridge()), []);
  const plan = data.profile.plan!;
  const days14 = lastNDays(14);
  const labels = days14.map((d, i) => (i % 2 ? "" : formatDay(d, { weekday: "narrow" })));
  const steps = stepSeries(data.daily, 14);
  const sleep = sleepSeries(data.daily, 14);
  const weekCardio = cardioMinutesWeek(data.cardio);
  const cardioByDay = days14.map((d) => cardioMinutesOn(data.cardio, d) || null);
  const recentCardio = [...data.cardio].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
  const readinessDays = lastNDays(7).map((d) => {
    const r = data.daily.find((x) => x.date === d)?.readiness;
    return r ? readinessScore(r) : null;
  });
  const today = data.daily.find((d) => d.date === todayISO());

  return (
    <div>
      <PageHeader title="Activity" description="Cardio, steps, sleep, and recovery — the work outside the gym that makes the plan work." />

      {!nativePlatform && (
        <Card className="mb-5 flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <p className="flex items-start gap-3 text-[14px] text-ink-soft">
            <Link2 className="mt-0.5 size-4 shrink-0 text-accent" />
            Steps, sleep, cardio, and weight are entered by hand. This browser can't read Apple Health or Health Connect.
          </p>
          <Link href="/settings#health" className="shrink-0 text-[14px] font-medium text-accent hover:underline">
            About phone sync
          </Link>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card id="steps" className="scroll-mt-24 p-5 sm:p-6">
          <SectionTitle
            title="Steps"
            description={`Target ${plan.levers.stepTarget.toLocaleString()}${average(steps) === null ? "" : ` · 2-week avg ${Math.round(average(steps)!).toLocaleString()}`}`}
            action={<Footprints className="size-4 text-accent" />}
          />
          <MiniBars values={steps} target={plan.levers.stepTarget} labels={labels} height={96} />
          <p className="mb-2 mt-5 text-[13px] font-medium text-ink-soft">
            Today {nativePlatform && today?.stepsSource && today.stepsSource !== "manual" && <span className="font-normal text-muted">· synced</span>}
          </p>
          <StepsForm key={`s${today?.steps}`} />
        </Card>

        <Card id="cardio" className="scroll-mt-24 p-5 sm:p-6">
          <SectionTitle
            title="Cardio"
            description={`${weekCardio} of ${plan.levers.cardioMinutesPerWeek} min in the last 7 days`}
            action={<Timer className="size-4 text-clay" />}
          />
          <MiniBars values={cardioByDay} labels={labels} height={96} color="bg-clay" />
          <div className="mt-5">
            <CardioForm />
          </div>
          {recentCardio.length > 0 && (
            <ul className="mt-5 divide-y divide-line border-t border-line">
              {recentCardio.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-2.5 text-[14px]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">{c.activity}</span>
                    <span className="block text-[12px] text-muted">
                      {relativeDayLabel(c.date)} · {c.intensity}
                      {nativePlatform && c.source !== "manual" && " · synced"}
                    </span>
                  </span>
                  <span className="tabular text-ink-soft">{c.minutes} min</span>
                  <button
                    onClick={async () => {
                      await deleteCardio(c.id);
                      toast("Cardio entry removed");
                    }}
                    className="grid size-7 place-items-center rounded-full text-faint hover:bg-sunken hover:text-clay"
                    aria-label={`Delete ${c.activity}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card id="sleep" className="scroll-mt-24 p-5 sm:p-6">
          <SectionTitle title="Sleep" description={`Target ${plan.sleepTargetHours} h${average(sleep) === null ? "" : ` · 2-week avg ${average(sleep)!.toFixed(1)} h`}`} action={<Moon className="size-4 text-sky" />} />
          <MiniBars values={sleep} target={plan.sleepTargetHours} labels={labels} height={96} color="bg-sky" />
          <p className="mb-2 mt-5 text-[13px] font-medium text-ink-soft">Last night</p>
          <SleepForm key={`sl${today?.sleepHours}`} />
        </Card>

        <Card id="recovery" className="scroll-mt-24 p-5 sm:p-6">
          <SectionTitle title="Recovery check-in" description="Ten seconds, once a day. Used to suggest how hard to push — not to diagnose anything." action={<HeartPulse className="size-4 text-honey" />} />
          <div className="mb-5 flex items-end gap-1.5">
            {readinessDays.map((s, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={cn("h-10 w-full rounded-lg", s == null ? "bg-sunken" : s >= 70 ? "bg-accent" : s >= 45 ? "bg-honey" : "bg-clay")}
                  style={{ opacity: s == null ? 1 : 0.35 + (s / 100) * 0.65 }}
                  title={s == null ? "No check-in" : `${readinessAdvice(s).label} (${s})`}
                />
                <span className="text-[10px] text-faint">{formatDay(lastNDays(7)[i], { weekday: "narrow" })}</span>
              </div>
            ))}
          </div>
          <CheckInForm key={`r${JSON.stringify(today?.readiness)}`} />
        </Card>
      </div>
    </div>
  );
}
