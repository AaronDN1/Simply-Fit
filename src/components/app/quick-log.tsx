"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented, UnitInput } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useStore, useUnits } from "@/lib/store";
import { displayWeight, inputWeightToKg } from "@/lib/units";
import { readinessAdvice, readinessScore } from "@/lib/plan";
import type { Intensity, Readiness } from "@/lib/types";
import { cn, todayISO, uid } from "@/lib/utils";

function useSaver() {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  return {
    saving,
    run: async (fn: () => Promise<void>, msg: string, done?: () => void) => {
      setSaving(true);
      try {
        await fn();
        toast(msg);
        done?.();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Couldn't save", "error");
      } finally {
        setSaving(false);
      }
    },
  };
}

export function StepsForm({ date = todayISO(), onDone }: { date?: string; onDone?: () => void }) {
  const { data, saveDaily } = useStore();
  const cur = data.daily.find((d) => d.date === date)?.steps ?? null;
  const [v, setV] = useState<number | "">(cur ?? "");
  const { saving, run } = useSaver();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (v === "") return;
        run(() => saveDaily(date, { steps: Math.round(v), stepsSource: "manual" }), "Steps updated", onDone);
      }}
    >
      <UnitInput ariaLabel="Steps" value={v} onChange={setV} unit="steps" placeholder="8000" className="flex-1" />
      <Button type="submit" loading={saving} className="h-11">
        Save
      </Button>
    </form>
  );
}

export function WeightForm({ date = todayISO(), onDone }: { date?: string; onDone?: () => void }) {
  const { data, saveDaily } = useStore();
  const units = useUnits();
  const cur = data.daily.find((d) => d.date === date)?.weightKg;
  const [v, setV] = useState<number | "">(cur ? displayWeight(cur, units) : "");
  const { saving, run } = useSaver();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (v === "") return;
        run(() => saveDaily(date, { weightKg: Math.round(inputWeightToKg(v, units) * 100) / 100 }), "Weight logged", onDone);
      }}
    >
      <UnitInput ariaLabel="Weight" value={v} onChange={setV} unit={units.weight} step={0.1} className="flex-1" />
      <Button type="submit" loading={saving} className="h-11">
        Save
      </Button>
    </form>
  );
}

export function SleepForm({ date = todayISO(), onDone }: { date?: string; onDone?: () => void }) {
  const { data, saveDaily } = useStore();
  const cur = data.daily.find((d) => d.date === date);
  const [h, setH] = useState<number | "">(cur?.sleepHours != null ? Math.floor(cur.sleepHours) : "");
  const [m, setM] = useState<number | "">(cur?.sleepHours != null ? Math.round((cur.sleepHours % 1) * 60) : "");
  const [q, setQ] = useState<number | null>(cur?.sleepQuality ?? null);
  const { saving, run } = useSaver();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (h === "") return;
        run(() => saveDaily(date, { sleepHours: Math.round((Number(h) + Number(m || 0) / 60) * 100) / 100, sleepQuality: q }), "Sleep logged", onDone);
      }}
    >
      <div className="grid grid-cols-2 gap-2">
        <UnitInput ariaLabel="Hours" value={h} onChange={setH} unit="h" placeholder="7" />
        <UnitInput ariaLabel="Minutes" value={m} onChange={setM} unit="min" placeholder="30" />
      </div>
      <div>
        <p className="mb-1.5 text-[13px] font-medium text-ink-soft">How did you sleep? <span className="font-normal text-muted">Optional</span></p>
        <Scale value={q} onChange={setQ} labels={["Rough", "Great"]} />
      </div>
      <Button type="submit" loading={saving} className="w-full">
        Save sleep
      </Button>
    </form>
  );
}

function Scale({ value, onChange, labels }: { value: number | null; onChange: (v: number) => void; labels: [string, string] }) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-pressed={value === n}
            className={cn("h-10 rounded-xl border text-[15px] font-medium tabular transition-colors", value === n ? "border-accent bg-accent text-on-accent" : "border-line bg-surface text-ink-soft hover:border-line-strong")}
          >
            {n}
          </button>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-faint">
        <span>{labels[0]}</span>
        <span>{labels[1]}</span>
      </div>
    </div>
  );
}

const CHECKIN: { key: keyof Readiness; label: string; labels: [string, string] }[] = [
  { key: "energy", label: "Energy", labels: ["Drained", "Energized"] },
  { key: "soreness", label: "Soreness", labels: ["None", "Very sore"] },
  { key: "stress", label: "Stress", labels: ["Calm", "Very stressed"] },
  { key: "motivation", label: "Motivation", labels: ["Low", "Fired up"] },
];

export function CheckInForm({ date = todayISO(), onDone }: { date?: string; onDone?: () => void }) {
  const { data, saveDaily } = useStore();
  const cur = data.daily.find((d) => d.date === date)?.readiness;
  const [r, setR] = useState<Partial<Readiness>>(cur ?? {});
  const complete = CHECKIN.every((c) => r[c.key] != null);
  const advice = complete ? readinessAdvice(readinessScore(r as Readiness)) : null;
  const { saving, run } = useSaver();
  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!complete) return;
        run(() => saveDaily(date, { readiness: r as Readiness }), "Check-in saved", onDone);
      }}
    >
      {CHECKIN.map((c) => (
        <div key={c.key}>
          <p className="mb-1.5 text-[14px] font-medium">{c.label}</p>
          <Scale value={r[c.key] ?? null} onChange={(v) => setR((s) => ({ ...s, [c.key]: v }))} labels={c.labels} />
        </div>
      ))}
      {advice && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("rounded-2xl px-4 py-3 text-[14px] leading-relaxed", advice.tone === "good" ? "bg-accent-tint text-accent-strong" : advice.tone === "ok" ? "bg-honey-soft text-honey" : "bg-clay-soft text-clay")}
        >
          <span className="font-semibold">{advice.label}.</span> {advice.advice}
        </motion.div>
      )}
      <Button type="submit" className="w-full" disabled={!complete} loading={saving}>
        Save check-in
      </Button>
    </form>
  );
}

const ACTIVITIES = ["Walk", "Incline walk", "Run", "Cycling", "Rower", "Elliptical", "Swim", "Sport", "Other"];

export function CardioForm({ date = todayISO(), onDone }: { date?: string; onDone?: () => void }) {
  const { saveCardio } = useStore();
  const [activity, setActivity] = useState("Incline walk");
  const [custom, setCustom] = useState("");
  const [minutes, setMinutes] = useState<number | "">(30);
  const [intensity, setIntensity] = useState<Intensity>("moderate");
  const { saving, run } = useSaver();
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!minutes || minutes <= 0) return;
        const name = activity === "Other" ? custom.trim() || "Cardio" : activity;
        run(
          () => saveCardio({ id: uid(), date, activity: name, minutes: Math.round(minutes), intensity, source: "manual", createdAt: new Date().toISOString() }),
          `${minutes} min ${name.toLowerCase()} logged`,
          onDone
        );
      }}
    >
      <div className="flex flex-wrap gap-1.5">
        {ACTIVITIES.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setActivity(a)}
            className={cn("rounded-full border px-3 py-1.5 text-[13px] transition-colors", activity === a ? "border-accent bg-accent-tint text-accent-strong" : "border-line bg-surface text-ink-soft")}
          >
            {a}
          </button>
        ))}
      </div>
      {activity === "Other" && (
        <Field label="Activity">
          <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. Hiking" />
        </Field>
      )}
      <div className="grid grid-cols-[1fr_auto] items-end gap-3">
        <Field label="Duration">
          <UnitInput value={minutes} onChange={setMinutes} unit="min" />
        </Field>
        <Segmented
          value={intensity}
          onChange={setIntensity}
          options={[
            { value: "easy", label: "Easy" },
            { value: "moderate", label: "Moderate" },
            { value: "hard", label: "Hard" },
          ]}
          size="sm"
          className="mb-1"
        />
      </div>
      <Button type="submit" className="w-full" loading={saving}>
        Log cardio
      </Button>
    </form>
  );
}
