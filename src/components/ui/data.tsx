"use client";

import { useEffect, useId, useRef } from "react";
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

/** Restrained count-up for numbers that change as the user logs things. */
export function AnimatedNumber({ value, digits = 0, className }: { value: number; digits?: number; className?: string }) {
  const reduce = useReducedMotion();
  const mv = useMotionValue(value);
  const text = useTransform(mv, (v) => v.toLocaleString("en-US", { maximumFractionDigits: digits, minimumFractionDigits: digits }));
  const first = useRef(true);
  useEffect(() => {
    if (reduce || first.current) {
      mv.set(value);
      first.current = false;
      return;
    }
    const c = animate(mv, value, { duration: 0.6, ease: [0.22, 1, 0.36, 1] });
    return () => c.stop();
  }, [value, mv, reduce]);
  return <motion.span className={cn("tabular", className)}>{text}</motion.span>;
}

export function Ring({
  value,
  size = 64,
  stroke = 6,
  color = "var(--color-accent)",
  track = "var(--color-sunken)",
  children,
  className,
}: {
  value: number;
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ type: "spring", stiffness: 90, damping: 22 }}
        />
      </svg>
      {children && <div className="absolute inset-0 grid place-items-center">{children}</div>}
    </div>
  );
}

export function Bar({ value, color = "bg-accent", className, height = "h-1.5" }: { value: number; color?: string; className?: string; height?: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-sunken", height, className)}>
      <motion.div className={cn("h-full rounded-full", color)} initial={{ width: 0 }} animate={{ width: `${v * 100}%` }} transition={{ type: "spring", stiffness: 120, damping: 24 }} />
    </div>
  );
}

/** Tiny trend line. Nulls are skipped; the last point gets a dot. */
export function Sparkline({
  values,
  width = 120,
  height = 36,
  color = "var(--color-accent)",
  fill = true,
  className,
  target,
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  className?: string;
  target?: number;
}) {
  const id = useId();
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true });
  const pts = values.map((v, i) => ({ i, v })).filter((p): p is { i: number; v: number } => p.v != null);
  if (pts.length < 2) return <svg ref={ref} width={width} height={height} className={className} />;
  const all = target != null ? [...pts.map((p) => p.v), target] : pts.map((p) => p.v);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const pad = 3;
  const x = (i: number) => pad + (i / Math.max(1, values.length - 1)) * (width - pad * 2);
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.v).toFixed(1)}`).join(" ");
  const area = `${d} L${x(pts[pts.length - 1].i).toFixed(1)},${height} L${x(pts[0].i).toFixed(1)},${height} Z`;
  const last = pts[pts.length - 1];
  return (
    <svg ref={ref} width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("overflow-visible", className)} aria-hidden>
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {target != null && <line x1={0} x2={width} y1={y(target)} y2={y(target)} stroke="var(--color-line-strong)" strokeDasharray="3 3" />}
      {fill && <motion.path d={area} fill={`url(#g${id})`} initial={{ opacity: 0 }} animate={{ opacity: inView ? 1 : 0 }} transition={{ duration: 0.6 }} />}
      <motion.path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: inView ? 1 : 0 }}
        transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
      />
      <circle cx={x(last.i)} cy={y(last.v)} r={2.75} fill={color} />
    </svg>
  );
}

/** Compact column chart for daily values against an optional target. */
export function MiniBars({
  values,
  target,
  height = 56,
  labels,
  color = "bg-accent",
  className,
}: {
  values: (number | null)[];
  target?: number;
  height?: number;
  labels?: string[];
  color?: string;
  className?: string;
}) {
  const max = Math.max(target ?? 0, ...values.map((v) => v ?? 0), 1);
  return (
    <div className={cn("w-full", className)}>
      <div className="relative flex items-end gap-1" style={{ height }}>
        {target != null && <div className="absolute inset-x-0 border-t border-dashed border-line-strong" style={{ bottom: `${(target / max) * 100}%` }} />}
        {values.map((v, i) => (
          <div key={i} className="flex h-full flex-1 items-end">
            <motion.div
              className={cn("w-full rounded-[4px]", v == null ? "bg-sunken" : target != null && v >= target ? color : `${color} opacity-45`)}
              initial={{ height: 0 }}
              animate={{ height: v == null ? 3 : `${Math.max(4, (v / max) * 100)}%` }}
              transition={{ type: "spring", stiffness: 140, damping: 22, delay: i * 0.015 }}
            />
          </div>
        ))}
      </div>
      {labels && (
        <div className="mt-1.5 flex gap-1">
          {labels.map((l, i) => (
            <span key={i} className="flex-1 text-center text-[10px] text-faint">
              {l}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
