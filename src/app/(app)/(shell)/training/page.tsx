"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Dumbbell, Moon, TrendingUp } from "lucide-react";
import { Card, Empty, PageHeader } from "@/components/ui/card";
import { Segmented } from "@/components/ui/field";
import { Sparkline } from "@/components/ui/data";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { WorkoutLogger } from "@/components/app/workout-logger";
import { WorkoutCheckoff } from "@/components/app/workout-checkoff";
import { SplitEditor } from "@/components/app/split-editor";
import { useStore } from "@/lib/store";
import { dayForDate, exerciseHistory, trainedExercises } from "@/lib/workouts";
import { displayWeight } from "@/lib/units";
import { workoutCompletion } from "@/lib/stats";
import { addDays, cn, formatDay, todayISO, WEEKDAYS, weekdayIndex } from "@/lib/utils";

type Tab = "today" | "split" | "history";

export default function TrainingPage() {
  const { data } = useStore();
  const [tab, setTab] = useState<Tab>("today");
  const date = todayISO();
  const split = data.profile.split;
  const scheduled = dayForDate(split, date);
  const log = data.workouts.find((w) => w.date === date);
  const [override, setOverride] = useState<string | null>(null);
  const day = split?.days.find((d) => d.id === (log?.dayId ?? override)) ?? scheduled;
  const completion = workoutCompletion(data.workouts, split, 28, data.profile.onboardedAt);

  return (
    <div>
      <PageHeader
        title="Training"
        description={
          split
            ? completion.scheduled
              ? `${split.name} · ${completion.completed} of ${completion.scheduled} planned sessions done in the last 4 weeks`
              : `${split.name} · ${split.days.filter((d) => !d.isRest).length} sessions a week`
            : undefined
        }
        action={
          <Segmented
            value={tab}
            onChange={setTab}
            options={[
              { value: "today", label: "Today" },
              { value: "split", label: "My split" },
              { value: "history", label: "History" },
            ]}
          />
        }
      />

      {tab === "today" && (
        <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
          <div>
            {day && !day.isRest ? (
              <div className="space-y-3">
                <div className="flex justify-end">
                  <WorkoutCheckoff day={day} log={log} />
                </div>
                <WorkoutLogger key={day.id + (log?.id ?? "")} day={day} log={log} />
              </div>
            ) : (
              <Card>
                <Empty
                  icon={<Moon className="size-5" />}
                  title="Rest day"
                  body="Recovery is where training turns into progress. A walk, some stretching, and a good night's sleep are the plan."
                  action={
                    split && (
                      <div className="flex flex-wrap justify-center gap-2">
                        {split.days
                          .filter((d) => !d.isRest)
                          .slice(0, 3)
                          .map((d) => (
                            <Button key={d.id} variant="secondary" size="sm" onClick={() => setOverride(d.id)}>
                              Train {d.name} anyway
                            </Button>
                          ))}
                      </div>
                    )
                  }
                />
              </Card>
            )}
          </div>
          <WeekStrip />
        </div>
      )}
      {tab === "split" && <SplitEditor />}
      {tab === "history" && <History />}
    </div>
  );
}

function WeekStrip() {
  const { data } = useStore();
  const split = data.profile.split;
  const today = weekdayIndex(todayISO());
  if (!split) return null;
  const entries = split.rotation
    ? Array.from({ length: 7 }, (_, offset) => {
        const iso = addDays(todayISO(), offset);
        return { d: dayForDate(split, iso), iso, label: offset === 0 ? "Today" : WEEKDAYS[weekdayIndex(iso)].slice(0, 3), current: offset === 0 };
      })
    : split.days.map((d, i) => ({ d, iso: addDays(todayISO(), i - today), label: WEEKDAYS[i].slice(0, 3), current: i === today }));
  return (
    <Card className="self-start p-5">
      <p className="mb-3 text-[15px] font-semibold tracking-tight">This week</p>
      <ul className="space-y-1">
        {entries.map(({ d, iso, label, current }) => {
          const done = data.workouts.some((w) => w.date === iso && w.completedAt);
          return (
            <li key={`${iso}-${d?.id ?? "rest"}`} className={cn("flex items-center gap-3 rounded-xl px-3 py-2", current && "bg-canvas")}>
              <span className={cn("w-9 text-[12px] font-medium uppercase", current ? "text-accent" : "text-muted")}>{label}</span>
              <span className={cn("flex-1 truncate text-[14px]", d?.isRest && "text-muted")}>{d?.isRest ? "Rest" : d?.name ?? "Unscheduled"}</span>
              {done ? (
                <span className="size-2 rounded-full bg-accent" aria-label="Completed" />
              ) : !split.rotation && !current && d && !d.isRest ? (
                <span className="size-2 rounded-full border border-line-strong" aria-label="Not logged" />
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function History() {
  const { data } = useStore();
  const units = data.profile.settings.units;
  const [selected, setSelected] = useState<string | null>(null);
  const exercises = useMemo(() => trainedExercises(data.workouts), [data.workouts]);
  const sessions = [...data.workouts].filter((w) => w.completedAt).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);

  if (!exercises.length)
    return (
      <Card>
        <Empty icon={<Dumbbell className="size-5" />} title="No workouts logged yet" body="Finish your first session and your history, estimated maxes, and trends will show up here." />
      </Card>
    );

  const hist = selected ? exerciseHistory(data.workouts, selected) : [];
  const selName = exercises.find((e) => e.id === selected)?.name ?? "";

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <Card className="overflow-hidden">
        <p className="px-5 pb-2 pt-4 text-[15px] font-semibold tracking-tight">Exercises</p>
        <ul className="divide-y divide-line">
          {exercises.map((ex) => {
            const h = exerciseHistory(data.workouts, ex.id);
            const best = Math.max(...h.map((p) => p.bestE1rm));
            const first = h[0]?.bestE1rm ?? 0;
            const last = h[h.length - 1]?.bestE1rm ?? 0;
            const change = first ? (last - first) / first : 0;
            return (
              <li key={ex.id}>
                <button onClick={() => setSelected(ex.id)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-canvas/60">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium">{ex.name}</span>
                    <span className="block text-[12px] text-muted">
                      {best > 0 ? `Est. max ${displayWeight(best, units, 0)} ${units.weight}` : "Bodyweight"} · {ex.sessions} sessions
                    </span>
                  </span>
                  {best > 0 && <Sparkline values={h.map((p) => p.bestE1rm)} width={64} height={24} fill={false} />}
                  {change > 0.005 && <span className="w-12 text-right text-[12px] font-medium text-accent">+{Math.round(change * 100)}%</span>}
                  <ChevronRight className="size-4 text-faint" />
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
      <Card className="self-start overflow-hidden">
        <p className="px-5 pb-2 pt-4 text-[15px] font-semibold tracking-tight">Recent sessions</p>
        <ul className="divide-y divide-line">
          {sessions.map((s) => {
            const vol = s.sets.filter((x) => x.done).reduce((a, x) => a + x.weightKg * x.reps, 0);
            return (
              <li key={s.id} className="flex items-center justify-between px-5 py-3 text-[14px]">
                <span>
                  <span className="block font-medium">{s.dayName}</span>
                  <span className="block text-[12px] text-muted">{formatDay(s.date, { weekday: "short", month: "short", day: "numeric" })}</span>
                </span>
                <span className="text-right text-[12px] tabular text-muted">
                  {s.sets.filter((x) => x.done).length} sets
                  <br />
                  {Math.round(displayWeight(vol, units, 0)).toLocaleString()} {units.weight}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      <Sheet open={!!selected} onClose={() => setSelected(null)} title={selName} description="Estimated 1-rep max uses the Epley formula from your best set each session." wide>
        {hist.length > 0 && (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[12px] text-muted">Best estimated max</p>
                <p className="text-[28px] font-semibold tracking-tight tabular">
                  {displayWeight(Math.max(...hist.map((h) => h.bestE1rm)), units, 0)} <span className="text-[15px] font-normal text-muted">{units.weight}</span>
                </p>
              </div>
              {hist.length > 1 && (
                <p className="flex items-center gap-1 text-[13px] text-accent">
                  <TrendingUp className="size-4" />
                  {Math.round(((hist[hist.length - 1].bestE1rm - hist[0].bestE1rm) / Math.max(1, hist[0].bestE1rm)) * 100)}% since {formatDay(hist[0].date, { month: "short", day: "numeric" })}
                </p>
              )}
            </div>
            <Sparkline values={hist.map((h) => h.bestE1rm)} width={560} height={110} className="mt-4 h-auto w-full" />
            <table className="mt-5 w-full text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wide text-faint">
                  <th className="pb-2 font-medium">Date</th>
                  <th className="pb-2 font-medium">Top set</th>
                  <th className="pb-2 text-right font-medium">Est. max</th>
                  <th className="pb-2 text-right font-medium">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...hist].reverse().slice(0, 12).map((h) => (
                  <tr key={h.date}>
                    <td className="py-2">{formatDay(h.date, { month: "short", day: "numeric" })}</td>
                    <td className="py-2 tabular">
                      {displayWeight(h.topSet.weightKg, units, 1)} × {h.topSet.reps}
                    </td>
                    <td className="py-2 text-right tabular">{displayWeight(h.bestE1rm, units, 0)}</td>
                    <td className="py-2 text-right tabular text-muted">{Math.round(displayWeight(h.volumeKg, units, 0)).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 rounded-xl bg-canvas px-3.5 py-2.5 text-[13px] text-muted">
              Progressive overload: when you hit the top of your rep range on every set, add a small amount of weight next time. Slow and steady wins.
            </p>
          </>
        )}
      </Sheet>
    </div>
  );
}
