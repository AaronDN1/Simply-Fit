"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowLeftRight, Check, Plus, Timer, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AnimatedNumber, Ring } from "@/components/ui/data";
import { Sheet } from "@/components/ui/sheet";
import { Toggle } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import type { SetLog, WorkoutDay, WorkoutLog } from "@/lib/types";
import { displayWeight, inputWeightToKg } from "@/lib/units";
import { e1rm, emptySets, EXERCISE_BY_ID, exerciseHistory, swapOptions, TOOLS_FOR } from "@/lib/workouts";
import { cn, todayISO, uid } from "@/lib/utils";

export function WorkoutLogger({ day, log }: { day: WorkoutDay; log: WorkoutLog | undefined }) {
  const { data, saveWorkout, deleteWorkout, updateProfile } = useStore();
  const toast = useToast();
  const units = data.profile.settings.units;
  const [rest, setRest] = useState<{ until: number; total: number } | null>(null);
  const [swapFor, setSwapFor] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);

  const history = useMemo(() => data.workouts.filter((w) => w.id !== log?.id), [data.workouts, log?.id]);
  // A blur (weight/reps commit) and a tap (mark done) fire back to back before re-render, so
  // edits must build on the latest pending log rather than the one captured by this render.
  const latest = useRef(log);
  useEffect(() => {
    latest.current = log;
  }, [log]);

  async function start() {
    const l: WorkoutLog = { id: uid(), date: todayISO(), dayId: day.id, dayName: day.name, sets: emptySets(day, history), notes: "", startedAt: new Date().toISOString(), completedAt: null };
    await saveWorkout(l);
  }

  if (!log) {
    return (
      <Card className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-[30px] leading-tight">{day.name}</h2>
            <p className="mt-1 text-[14px] text-muted">
              {day.focus} · {day.exercises.length} exercises · ~{Math.round(day.exercises.reduce((s, e) => s + e.sets * (e.restSec + 40), 0) / 60)} min
            </p>
          </div>
        </div>
        <ol className="mt-5 divide-y divide-line rounded-2xl border border-line">
          {day.exercises.map((e, i) => (
            <li key={e.id} className="flex items-center gap-3 px-4 py-3">
              <span className="w-5 text-[12px] tabular text-faint">{i + 1}</span>
              <span className="flex-1 text-[15px] font-medium">{e.name}</span>
              <span className="text-[13px] tabular text-muted">
                {e.sets} × {e.repsMin}–{e.repsMax} · RPE {e.rpe}
              </span>
            </li>
          ))}
        </ol>
        <Button size="lg" className="mt-5 w-full sm:w-auto" onClick={start}>
          Start workout
        </Button>
      </Card>
    );
  }

  const groups = groupSets(log.sets);
  const doneSets = log.sets.filter((s) => s.done).length;
  const volumeKg = log.sets.filter((s) => s.done).reduce((s, x) => s + x.weightKg * x.reps, 0);
  const nextSet = log.sets.find((s) => !s.done);

  async function update(sets: SetLog[] | ((current: SetLog[]) => SetLog[]), extra: Partial<WorkoutLog> = {}) {
    const current = latest.current ?? log!;
    const next = { ...current, sets: typeof sets === "function" ? sets(current.sets) : sets, ...extra };
    latest.current = next;
    try {
      await saveWorkout(next);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save set", "error");
    }
  }

  function toggleDone(s: SetLog, pending: Partial<SetLog>) {
    const done = !s.done;
    update((current) => {
      const weightKg = pending.weightKg ?? current.find((x) => x.id === s.id)?.weightKg ?? 0;
      return current.map((x) => {
        if (x.id === s.id) return { ...x, ...pending, done };
        if (done && weightKg && !x.done && !x.weightKg && x.exerciseId === s.exerciseId && x.setIndex > s.setIndex) return { ...x, weightKg };
        return x;
      });
    });
    if (done) {
      const planned = day.exercises.find((e) => e.exerciseId === s.exerciseId);
      const secs = planned?.restSec ?? 90;
      setRest({ until: Date.now() + secs * 1000, total: secs });
    }
  }

  function addSet(exerciseId: string) {
    update((current) => {
      const sets = current.filter((s) => s.exerciseId === exerciseId);
      const last = sets[sets.length - 1];
      const idx = current.lastIndexOf(last);
      const copy: SetLog = { ...last, id: uid(), setIndex: last.setIndex + 1, done: false, rpe: null };
      return [...current.slice(0, idx + 1), copy, ...current.slice(idx + 1)];
    });
  }

  async function swap(fromId: string, toId: string, alsoSplit: boolean) {
    const to = EXERCISE_BY_ID[toId];
    await update((current) => current.map((s) => (s.exerciseId === fromId ? { ...s, exerciseId: to.id, exerciseName: to.name, done: false, weightKg: 0 } : s)));
    if (alsoSplit && data.profile.split) {
      await updateProfile({
        split: {
          ...data.profile.split,
          source: data.profile.split.source === "recommended" ? "custom" : data.profile.split.source,
          days: data.profile.split.days.map((d) => (d.id !== day.id ? d : { ...d, exercises: d.exercises.map((e) => (e.exerciseId === fromId ? { ...e, exerciseId: to.id, name: to.name } : e)) })),
        },
      });
    }
    setSwapFor(null);
    toast(`Swapped to ${to.name}`);
  }

  async function finish() {
    await update((current) => current, { completedAt: new Date().toISOString() });
    setRest(null);
    setCelebrate(true);
  }

  if (log.completedAt) {
    return <CompletedCard log={log} celebrate={celebrate} units={units} onReopen={() => update((current) => current, { completedAt: null })} history={history} />;
  }

  return (
    <div className={cn("space-y-3", rest && "pb-20")}>
      <Card className="flex items-center gap-4 p-4 sm:p-5">
        <Ring value={doneSets / Math.max(1, log.sets.length)} size={52} stroke={5}>
          <span className="text-[12px] font-semibold tabular">
            {doneSets}/{log.sets.length}
          </span>
        </Ring>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[17px] font-semibold tracking-tight">{log.dayName}</p>
          <p className="truncate text-[13px] text-muted">{nextSet ? `Next: ${nextSet.exerciseName}, set ${nextSet.setIndex + 1}` : "All sets done — finish when ready"}</p>
        </div>
        <div className="hidden text-right sm:block">
          <p className="text-[12px] text-muted">Volume</p>
          <p className="text-[15px] font-semibold tabular">
            <AnimatedNumber value={Math.round(displayWeight(volumeKg, units, 0))} /> {units.weight}
          </p>
        </div>
      </Card>

      {groups.map(({ exerciseId, name, sets }) => {
        const planned = day.exercises.find((e) => e.exerciseId === exerciseId);
        const hist = exerciseHistory(history, exerciseId);
        const last = hist[hist.length - 1];
        const isNext = nextSet?.exerciseId === exerciseId;
        return (
          <Card key={exerciseId} className={cn("overflow-hidden transition-shadow", isNext && "ring-1 ring-accent/40")}>
            <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4 sm:px-5">
              <div className="min-w-0">
                <p className="text-[15px] font-semibold">{name}</p>
                <p className="mt-0.5 text-[12px] text-muted">
                  {planned ? `${planned.repsMin}–${planned.repsMax} reps · RPE ${planned.rpe} · rest ${Math.round(planned.restSec / 60 * 10) / 10} min` : "Added"}
                  {last ? ` · last: ${displayWeight(last.topSet.weightKg, units, 1)} × ${last.topSet.reps}` : ""}
                </p>
              </div>
              {EXERCISE_BY_ID[exerciseId] && (
                <button onClick={() => setSwapFor(exerciseId)} className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] text-muted hover:bg-sunken hover:text-ink">
                  <ArrowLeftRight className="size-3.5" /> Swap
                </button>
              )}
            </div>
            <div className="px-2 pb-2 sm:px-3">
              <div className="grid grid-cols-[28px_1fr_1fr_1fr_44px] gap-1.5 px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
                <span>Set</span>
                <span>{units.weight}</span>
                <span>Reps</span>
                <span>RPE</span>
                <span />
              </div>
              {sets.map((s) => (
                <SetRow key={s.id} s={s} unit={units.weight} onChange={(patch) => update((current) => current.map((x) => (x.id === s.id ? { ...x, ...patch } : x)))} onToggle={(pending) => toggleDone(s, pending)} units={units} />
              ))}
              <button onClick={() => addSet(exerciseId)} className="mt-1 flex w-full items-center justify-center gap-1 rounded-xl py-2 text-[13px] text-muted hover:bg-canvas hover:text-ink">
                <Plus className="size-3.5" /> Add set
              </button>
            </div>
          </Card>
        );
      })}

      <div className="flex flex-col gap-2 pt-2 sm:flex-row">
        <Button size="lg" className="flex-1" onClick={finish} disabled={doneSets === 0}>
          <Check className="size-4" /> Finish workout
        </Button>
        <Button
          size="lg"
          variant="ghost"
          onClick={async () => {
            await deleteWorkout(log.id);
            setRest(null);
          }}
        >
          Discard
        </Button>
      </div>

      <RestTimer rest={rest} onClose={() => setRest(null)} />

      <Sheet open={!!swapFor} onClose={() => setSwapFor(null)} title="Swap exercise" description="Same movement pattern, different equipment.">
        {swapFor && <SwapList exerciseId={swapFor} onPick={swap} equipment={data.profile.intake?.equipment ?? "full_gym"} />}
      </Sheet>
    </div>
  );
}

function SetRow({ s, unit, units, onChange, onToggle }: { s: SetLog; unit: string; units: { weight: "lb" | "kg"; height: "imperial" | "metric" }; onChange: (p: Partial<SetLog>) => void; onToggle: (pending: Partial<SetLog>) => void }) {
  const [w, setW] = useState<string>(s.weightKg ? String(displayWeight(s.weightKg, units, 1)) : "");
  const [r, setR] = useState<string>(String(s.reps));
  const [rpe, setRpe] = useState<string>(s.rpe ? String(s.rpe) : "");
  useEffect(() => setW(s.weightKg ? String(displayWeight(s.weightKg, units, 1)) : ""), [s.weightKg, units]);
  useEffect(() => setR(String(s.reps)), [s.reps]);
  const parsed = {
    weightKg: w ? Math.round(inputWeightToKg(Number(w) || 0, units) * 100) / 100 : 0,
    reps: Math.max(0, Math.round(Number(r) || 0)),
    rpe: rpe ? Math.min(10, Math.max(1, Number(rpe) || 1)) : null,
  };
  const cell = "h-10 w-full rounded-lg border bg-surface text-center text-[15px] tabular outline-none transition-colors focus:border-accent";
  return (
    <motion.div layout className={cn("grid grid-cols-[28px_1fr_1fr_1fr_44px] items-center gap-1.5 rounded-xl px-2 py-1", s.done && "bg-accent-tint")}>
      <span className="text-[13px] tabular text-muted">{s.setIndex + 1}</span>
      <input
        inputMode="decimal"
        aria-label={`Weight in ${unit}`}
        className={cn(cell, s.done ? "border-transparent bg-transparent" : "border-line")}
        value={w}
        placeholder="0"
        onChange={(e) => setW(e.target.value)}
        onBlur={() => parsed.weightKg !== s.weightKg && onChange({ weightKg: parsed.weightKg })}
      />
      <input
        inputMode="numeric"
        aria-label="Reps"
        className={cn(cell, s.done ? "border-transparent bg-transparent" : "border-line")}
        value={r}
        onChange={(e) => setR(e.target.value)}
        onBlur={() => parsed.reps !== s.reps && onChange({ reps: parsed.reps })}
      />
      <input
        inputMode="decimal"
        aria-label="RPE"
        className={cn(cell, s.done ? "border-transparent bg-transparent" : "border-line", "placeholder:text-faint")}
        value={rpe}
        placeholder="–"
        onChange={(e) => setRpe(e.target.value)}
        onBlur={() => parsed.rpe !== s.rpe && onChange({ rpe: parsed.rpe })}
      />
      <motion.button
        whileTap={{ scale: 0.85 }}
        onClick={() => onToggle(parsed)}
        aria-label={s.done ? "Mark set not done" : "Mark set done"}
        className={cn("grid size-10 place-items-center rounded-xl border transition-colors", s.done ? "border-accent bg-accent text-on-accent" : "border-line-strong text-faint hover:border-accent hover:text-accent")}
      >
        <AnimatePresence mode="wait" initial={false}>
          {s.done ? (
            <motion.span key="d" initial={{ scale: 0, rotate: -45 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 600, damping: 20 }}>
              <Check className="size-4" strokeWidth={3} />
            </motion.span>
          ) : (
            <motion.span key="n" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Check className="size-4" />
            </motion.span>
          )}
        </AnimatePresence>
      </motion.button>
    </motion.div>
  );
}

function RestTimer({ rest, onClose }: { rest: { until: number; total: number } | null; onClose: () => void }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!rest) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [rest]);
  const left = rest ? Math.max(0, Math.ceil((rest.until - now) / 1000)) : 0;
  useEffect(() => {
    if (rest && left === 0) {
      if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(150);
      const t = setTimeout(onClose, 1500);
      return () => clearTimeout(t);
    }
  }, [left, rest, onClose]);
  return (
    <AnimatePresence>
      {rest && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 40, opacity: 0 }}
          className="pointer-events-none fixed inset-x-0 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 flex justify-center px-4 lg:bottom-8"
        >
          <div className="pointer-events-auto flex items-center gap-3 rounded-full bg-iron py-2 pl-2 pr-3 text-chalk shadow-[var(--shadow-lift)]">
            <Ring value={left / rest.total} size={36} stroke={3.5} track="rgb(255 255 255 / 0.15)" color="var(--color-accent)">
              <Timer className="size-3.5" />
            </Ring>
            <span className="min-w-[88px] text-[15px] font-medium tabular">{left > 0 ? `Rest ${Math.floor(left / 60)}:${String(left % 60).padStart(2, "0")}` : "Go time"}</span>
            <button onClick={onClose} className="grid size-7 place-items-center rounded-full hover:bg-white/10" aria-label="Skip rest">
              <X className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SwapList({ exerciseId, onPick, equipment }: { exerciseId: string; onPick: (from: string, to: string, alsoSplit: boolean) => void; equipment: keyof typeof TOOLS_FOR }) {
  const [alsoSplit, setAlsoSplit] = useState(false);
  const tools = TOOLS_FOR[equipment];
  const options = swapOptions(exerciseId, tools);
  return (
    <div>
      <ul className="space-y-1.5">
        {options.map((o) => {
          const available = o.tools.every((t) => tools.includes(t));
          return (
            <li key={o.id}>
              <button onClick={() => onPick(exerciseId, o.id, alsoSplit)} className="flex w-full items-center justify-between rounded-xl border border-line px-4 py-3 text-left hover:border-line-strong">
                <span className="text-[15px] font-medium">{o.name}</span>
                <span className={cn("text-[12px]", available ? "text-accent" : "text-faint")}>{available ? "Your equipment" : o.tools.join(", ")}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 border-t border-line">
        <Toggle checked={alsoSplit} onChange={setAlsoSplit} label="Also update my split" description="Use this swap every week, not just today." />
      </div>
    </div>
  );
}

function CompletedCard({ log, celebrate, units, onReopen, history }: { log: WorkoutLog; celebrate: boolean; units: { weight: "lb" | "kg"; height: "imperial" | "metric" }; onReopen: () => void; history: WorkoutLog[] }) {
  const done = log.sets.filter((s) => s.done);
  const volume = done.reduce((s, x) => s + x.weightKg * x.reps, 0);
  const minutes = log.completedAt ? Math.max(1, Math.round((new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime()) / 60000)) : 0;
  const prs = groupSets(done)
    .map((g) => {
      const best = Math.max(...g.sets.map((s) => e1rm(s.weightKg, s.reps)));
      const prev = Math.max(0, ...exerciseHistory(history, g.exerciseId).map((p) => p.bestE1rm));
      return { name: g.name, best, isPr: prev > 0 && best > prev + 0.1 };
    })
    .filter((p) => p.isPr);

  return (
    <motion.div initial={celebrate ? { scale: 0.96, opacity: 0 } : false} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
      <Card className="overflow-hidden">
        <div className="bg-brand px-5 py-7 text-center text-chalk sm:px-8">
          <motion.div
            initial={celebrate ? { scale: 0, rotate: -40 } : false}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 14, delay: 0.1 }}
            className="mx-auto grid size-14 place-items-center rounded-full bg-chalk text-brand"
          >
            <Check className="size-7" strokeWidth={3} />
          </motion.div>
          <h2 className="mt-4 font-display text-[34px] leading-tight">{log.dayName} — done.</h2>
          <p className="mt-1 text-[15px] text-chalk-dim">That's another session in the bank.</p>
        </div>
        <div className="grid grid-cols-3 divide-x divide-line">
          {[
            { l: "Sets", v: done.length, s: "" },
            { l: "Volume", v: Math.round(displayWeight(volume, units, 0)), s: units.weight },
            { l: "Time", v: minutes, s: "min" },
          ].map((x) => (
            <div key={x.l} className="px-3 py-4 text-center">
              <p className="text-[12px] text-muted">{x.l}</p>
              <p className="mt-0.5 text-xl font-semibold">
                <AnimatedNumber value={x.v} /> <span className="text-[13px] font-normal text-muted">{x.s}</span>
              </p>
            </div>
          ))}
        </div>
        {prs.length > 0 && (
          <div className="border-t border-line px-5 py-4">
            {prs.map((p) => (
              <p key={p.name} className="flex items-center gap-2 text-[14px]">
                <Trophy className="size-4 text-honey" /> New estimated best on <span className="font-medium">{p.name}</span> · {displayWeight(p.best, units, 0)} {units.weight} e1RM
              </p>
            ))}
          </div>
        )}
        <div className="border-t border-line px-5 py-3 text-right">
          <button onClick={onReopen} className="text-[13px] text-muted hover:text-ink">
            Edit this workout
          </button>
        </div>
      </Card>
    </motion.div>
  );
}

export function groupSets(sets: SetLog[]) {
  const out: { exerciseId: string; name: string; sets: SetLog[] }[] = [];
  for (const s of sets) {
    let g = out.find((x) => x.exerciseId === s.exerciseId);
    if (!g) out.push((g = { exerciseId: s.exerciseId, name: s.exerciseName, sets: [] }));
    g.sets.push(s);
  }
  return out;
}
