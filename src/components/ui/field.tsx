"use client";

import { forwardRef, useId } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-11 w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink placeholder:text-faint outline-none transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--color-accent-soft)]";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(inputClass, className)} {...props} />;
});

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string | null; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-[13px] font-medium text-ink-soft">{label}</span>
      {children}
      {error ? <span className="mt-1.5 block text-[13px] text-clay">{error}</span> : hint ? <span className="mt-1.5 block text-[13px] text-muted">{hint}</span> : null}
    </label>
  );
}

/** Number input with a trailing unit label. */
export function UnitInput({
  value,
  onChange,
  unit,
  placeholder,
  min,
  max,
  step,
  className,
  ariaLabel,
}: {
  value: number | "" | null;
  onChange: (v: number | "") => void;
  unit: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <input
        type="number"
        inputMode="decimal"
        aria-label={ariaLabel}
        className={cn(inputClass, "pr-12 tabular")}
        value={value ?? ""}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3.5 flex items-center text-sm text-muted">{unit}</span>
    </div>
  );
}

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

/** Large tappable options (single or multi select). */
export function Choices<T extends string>({
  options,
  value,
  onChange,
  multiple,
  columns = 2,
  size = "md",
}: {
  options: ChoiceOption<T>[];
  value: T | T[] | null;
  onChange: (v: T) => void;
  multiple?: boolean;
  columns?: 1 | 2 | 3 | 4;
  size?: "sm" | "md";
}) {
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  const cols = { 1: "grid-cols-1", 2: "grid-cols-1 sm:grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4" }[columns];
  return (
    <div className={cn("grid gap-2", cols)} role={multiple ? "group" : "radiogroup"}>
      {options.map((o) => {
        const on = selected(o.value);
        return (
          <button
            key={o.value}
            type="button"
            role={multiple ? "checkbox" : "radio"}
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "group relative flex items-start gap-3 rounded-2xl border text-left transition-colors",
              size === "sm" ? "px-3.5 py-2.5" : "px-4 py-3.5",
              on ? "border-accent bg-accent-tint" : "border-line bg-surface hover:border-line-strong"
            )}
          >
            {o.icon && <span className={cn("mt-0.5 shrink-0", on ? "text-accent" : "text-muted")}>{o.icon}</span>}
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium text-ink">{o.label}</span>
              {o.description && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{o.description}</span>}
            </span>
            <span
              className={cn(
                "mt-1 grid size-4 shrink-0 place-items-center border transition-colors",
                multiple ? "rounded-[5px]" : "rounded-full",
                on ? "border-accent bg-accent" : "border-line-strong"
              )}
            >
              {on && (
                <motion.svg initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} viewBox="0 0 12 12" className="size-2.5 text-white">
                  <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </motion.svg>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Compact segmented control with a sliding indicator. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  const id = useId();
  return (
    <div className={cn("inline-flex rounded-full bg-sunken p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "relative rounded-full font-medium transition-colors",
            size === "sm" ? "px-3 py-1 text-[13px]" : "px-4 py-1.5 text-sm",
            value === o.value ? "text-ink" : "text-muted hover:text-ink"
          )}
        >
          {value === o.value && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-surface shadow-[var(--shadow-soft)]" />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

export function Slider({
  value,
  onChange,
  min,
  max,
  step = 1,
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  ariaLabel: string;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <input
      type="range"
      className="sf-range"
      aria-label={ariaLabel}
      min={min}
      max={max}
      step={step}
      value={value}
      style={{ ["--fill" as string]: `${pct}%` }}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex w-full items-center justify-between gap-4 py-3 text-left">
      <span>
        <span className="block text-[15px] text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-muted">{description}</span>}
      </span>
      <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", checked ? "bg-accent" : "bg-line-strong")}>
        <motion.span layout className={cn("absolute top-0.5 size-5 rounded-full bg-white shadow", checked ? "right-0.5" : "left-0.5")} />
      </span>
    </button>
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(inputClass, "h-auto min-h-[88px] py-3", props.className)} />;
}
