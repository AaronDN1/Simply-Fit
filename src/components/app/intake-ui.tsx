"use client";

import { motion } from "motion/react";
import { Slider } from "@/components/ui/field";
import { cn } from "@/lib/utils";

const spring = (i: number) => ({
  initial: { opacity: 0, y: 14, scale: 0.96 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { type: "spring" as const, stiffness: 480, damping: 32, mass: 0.7, delay: 0.05 + i * 0.055 },
});

export function Instrument({ children }: { children: React.ReactNode }) {
  return <div className="divide-y divide-line overflow-hidden rounded-[24px] border border-line bg-surface shadow-[var(--shadow-soft)]">{children}</div>;
}

export function InstrumentRow({ children }: { children: React.ReactNode }) {
  return <div className="px-4 py-4 sm:px-5">{children}</div>;
}

export function ScaleSlider({
  label,
  hint,
  value,
  display,
  min,
  max,
  step = 1,
  onChange,
  ticks,
  muted = false,
}: {
  label: string;
  hint?: string;
  value: number;
  display: string;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  ticks: { value: number; label: string }[];
  muted?: boolean;
}) {
  const clamped = Math.min(max, Math.max(min, value));
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink-soft">{label}</p>
          {hint && <p className="mt-0.5 text-[12px] text-muted">{hint}</p>}
        </div>
        <p className={cn("font-display text-[32px] leading-none tracking-tight tabular sm:text-[36px]", muted && "text-faint")}>{display}</p>
      </div>
      <Slider className="sf-scale mt-3" ariaLabel={label} value={clamped} min={min} max={max} step={step} onChange={onChange} />
      {ticks.length > 1 && (
        <div className="mt-0.5 flex justify-between text-[11px] tabular text-faint">
          <span>{ticks[0].label}</span>
          <span>{ticks[ticks.length - 1].label}</span>
        </div>
      )}
    </div>
  );
}

const DAY_NOTES = [
  "No lifting. Walking and cardio can carry the week.",
  "One full-body session. Make it count.",
  "Two days. Enough to stay in the habit.",
  "Three days. A classic, sustainable week.",
  "Four days. A strong rhythm for most goals.",
  "Five days. Keep each session focused.",
  "Six days. Leave one real rest day.",
  "Every day. Recovery becomes the skill.",
];

export function DayScale({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-4">
        <p className="text-[13px] font-medium text-ink-soft">Lifting days per week</p>
        <p className="font-display text-[32px] leading-none tracking-tight tabular sm:text-[36px]">{value === 1 ? "1 day" : `${value} days`}</p>
      </div>
      <div className="mt-4 grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="Lifting days per week">
        {Array.from({ length: 8 }, (_, n) => {
          const on = n === value;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(n)}
              className={cn(
                "grid h-11 place-items-center rounded-xl text-[15px] font-medium tabular transition-colors",
                on ? "bg-accent text-white" : n < value ? "bg-accent-soft text-accent-strong" : "bg-sunken text-muted hover:text-ink"
              )}
            >
              {n}
            </button>
          );
        })}
      </div>
      <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{DAY_NOTES[value] ?? DAY_NOTES[0]}</p>
    </div>
  );
}

const MEALS: { value: "three_meals" | "three_plus_snacks" | "two_meals" | "flexible"; label: string; note: string; dots: ("meal" | "snack")[] }[] = [
  { value: "three_meals", label: "Three meals", note: "Breakfast, lunch, and dinner", dots: ["meal", "meal", "meal"] },
  { value: "three_plus_snacks", label: "Meals and snacks", note: "Three meals, with bites between", dots: ["meal", "snack", "meal", "snack", "meal"] },
  { value: "two_meals", label: "Two bigger meals", note: "A longer gap between them", dots: ["meal", "meal"] },
  { value: "flexible", label: "It varies", note: "We'll keep the targets loose", dots: ["meal", "snack", "meal"] },
];

export function MealRhythm<T extends string>({ value, onChange }: { value: T; onChange: (v: T) => void }) {
  return (
    <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Meal rhythm">
      {MEALS.map((o, i) => {
        const on = value === o.value;
        return (
          <motion.button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value as T)}
            className={cn("rounded-2xl border px-4 py-3.5 text-left transition-colors", on ? "border-accent bg-accent-tint" : "border-line bg-surface hover:border-line-strong")}
            {...spring(i)}
          >
            <span className="flex h-4 items-center gap-1.5" aria-hidden>
              {o.dots.map((kind, j) => (
                <span key={j} className={cn("rounded-full", kind === "meal" ? "size-2.5" : "size-1.5", on ? "bg-accent" : "bg-line-strong")} />
              ))}
            </span>
            <span className="mt-2.5 block text-[15px] font-medium">{o.label}</span>
            <span className="mt-0.5 block text-[13px] text-muted">{o.note}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export function DietPicks({ options, value, onToggle }: { options: string[]; value: string[]; onToggle: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((x, i) => {
        const on = value.includes(x);
        return (
          <motion.button
            key={x}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(x)}
            className={cn(
              "rounded-full border px-3.5 py-2 text-sm transition-colors",
              on ? "border-accent bg-accent-tint font-medium text-accent-strong" : "border-line bg-surface text-ink-soft hover:border-line-strong"
            )}
            {...spring(i)}
          >
            {x}
          </motion.button>
        );
      })}
    </div>
  );
}

export function PaceCards({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string; figure: string; description: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Pace">
      {options.map((o, i) => {
        const on = value === o.id;
        return (
          <motion.button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={cn("rounded-2xl border px-4 py-4 text-left transition-colors", on ? "border-accent bg-accent-tint" : "border-line bg-surface hover:border-line-strong")}
            {...spring(i)}
          >
            <span className="block text-[12px] font-medium uppercase tracking-[0.12em] text-muted">{o.label}</span>
            <span className="mt-2 block font-display text-[26px] leading-none tracking-tight tabular">{o.figure}</span>
            <span className="mt-2 block text-[13px] leading-snug text-muted">{o.description}</span>
            <span className="mt-3 flex gap-1" aria-hidden>
              {options.map((mark, markIndex) => (
                <span key={mark.id} className={cn("h-1 flex-1 rounded-full", markIndex <= i ? (on ? "bg-accent" : "bg-line-strong") : "bg-sunken")} />
              ))}
            </span>
          </motion.button>
        );
      })}
    </div>
  );
}
