"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useMotionValue, useReducedMotion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";
import { ArrowRight, Check, Dumbbell, Footprints, Moon, Scale, Soup, Timer, Wheat } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

interface Fragment {
  icon: React.ReactNode;
  title: string;
  detail: string;
  value: string;
  tone: string;
  done?: boolean;
  /** scattered offset from the card's top-left, and rotation */
  from: { x: number; y: number; r: number };
}

const ROW_H = 58;
const CARD_W = 360;
const ROWS_TOP = 132;

const FRAGMENTS: Fragment[] = [
  { icon: <Soup className="size-4" />, title: "Breakfast", detail: "Oats, whey, berries", value: "540 kcal", tone: "bg-honey-soft text-[#8a6519]", done: true, from: { x: -250, y: -40, r: -9 } },
  { icon: <Moon className="size-4" />, title: "Sleep", detail: "Target 8h", value: "7h 50m", tone: "bg-sky-soft text-sky", done: true, from: { x: 200, y: -70, r: 7 } },
  { icon: <Dumbbell className="size-4" />, title: "Upper body", detail: "6 exercises · 55 min", value: "5:30 pm", tone: "bg-accent-soft text-accent", from: { x: -300, y: 210, r: 6 } },
  { icon: <Footprints className="size-4" />, title: "Steps", detail: "Goal 10,000", value: "6,420", tone: "bg-accent-soft text-accent", from: { x: 220, y: 170, r: -5 } },
  { icon: <Timer className="size-4" />, title: "Incline walk", detail: "Easy pace", value: "30 min", tone: "bg-clay-soft text-clay", from: { x: -200, y: 420, r: -4 } },
  { icon: <Scale className="size-4" />, title: "Weight trend", detail: "7-day average", value: "−0.9 lb/wk", tone: "bg-sunken text-ink-soft", from: { x: 180, y: 400, r: 9 } },
];

/** How far fragments scatter: narrow screens have no room beside the card, so the mess stays compact and below the CTAs. */
function useSpread() {
  const [spread, setSpread] = useState({ x: 1, y: 1, dy: 0 });
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      setSpread(w < 640 ? { x: 0.32, y: 0.75, dy: 60 } : w < 1024 ? { x: 0.6, y: 0.85, dy: 30 } : { x: 1, y: 1, dy: 0 });
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);
  return spread;
}

function FragmentRow({ f, i, progress, spread }: { f: Fragment; i: number; progress: MotionValue<number>; spread: { x: number; y: number; dy: number } }) {
  const start = 0.08 + i * 0.07;
  const end = start + 0.38;
  const t = useTransform(progress, [start, end], [0, 1], { clamp: true });
  const x = useTransform(t, [0, 1], [f.from.x * spread.x, 0]);
  const fromY = spread.dy ? Math.max(0, f.from.y) * spread.y + spread.dy : f.from.y;
  const y = useTransform(t, [0, 1], [fromY, ROWS_TOP + i * ROW_H]);
  const rotate = useTransform(t, [0, 1], [f.from.r, 0]);
  const scale = useTransform(t, [0, 0.6, 1], [0.94, 1.02, 1]);
  const shadow = useTransform(t, [0, 1], ["0 18px 40px -18px rgba(29,28,25,0.28)", "0 0px 0px 0px rgba(29,28,25,0)"]);
  const border = useTransform(t, [0, 1], ["rgba(213,207,195,1)", "rgba(228,223,213,0)"]);
  const checkOpacity = useTransform(progress, [0.72, 0.8], [0, 1]);
  return (
    <motion.div
      style={{ x, y, rotate, scale, boxShadow: shadow, borderColor: border, width: CARD_W - 32 }}
      className="absolute left-4 top-0 flex h-[50px] items-center gap-3 rounded-2xl border bg-surface px-3"
    >
      <span className={`grid size-8 shrink-0 place-items-center rounded-xl ${f.tone}`}>{f.icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-medium leading-tight text-ink">{f.title}</span>
        <span className="block truncate text-[12px] text-muted">{f.detail}</span>
      </span>
      <span className="text-[13px] font-medium tabular text-ink-soft">{f.value}</span>
      {f.done && (
        <motion.span style={{ opacity: checkOpacity }} className="grid size-5 place-items-center rounded-full bg-accent text-white">
          <Check className="size-3" strokeWidth={3} />
        </motion.span>
      )}
    </motion.div>
  );
}

function TodayStage({ progress }: { progress: MotionValue<number> }) {
  const frame = useTransform(progress, [0.25, 0.55], [0, 1]);
  const frameScale = useTransform(frame, [0, 1], [0.96, 1]);
  const ringOffset = useTransform(progress, [0.55, 0.9], [113, 113 * 0.38]);
  const nextOpacity = useTransform(progress, [0.78, 0.9], [0, 1]);
  const nextY = useTransform(progress, [0.78, 0.9], [12, 0]);
  const cardHeight = ROWS_TOP + FRAGMENTS.length * ROW_H + 92;
  const spread = useSpread();

  return (
    <div className="relative mx-auto origin-top scale-[0.78] sm:scale-90 lg:scale-100" style={{ width: CARD_W, height: cardHeight }}>
      <motion.div
        style={{ opacity: frame, scale: frameScale }}
        className="absolute inset-0 rounded-[28px] border border-line bg-surface/80 shadow-[var(--shadow-lift)] backdrop-blur-sm"
      />
      <motion.div style={{ opacity: frame }} className="absolute inset-x-5 top-5 flex items-start justify-between">
        <div>
          <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">Today</p>
          <p className="mt-1 font-display text-[30px] leading-none">Wednesday</p>
          <p className="mt-2 text-[13px] text-muted">1,280 of 2,360 kcal · 96 g protein</p>
        </div>
        <svg width="44" height="44" className="-rotate-90">
          <circle cx="22" cy="22" r="18" fill="none" stroke="var(--color-sunken)" strokeWidth="5" />
          <motion.circle cx="22" cy="22" r="18" fill="none" stroke="var(--color-accent)" strokeWidth="5" strokeLinecap="round" strokeDasharray={113} style={{ strokeDashoffset: ringOffset }} />
        </svg>
      </motion.div>
      <motion.div style={{ opacity: frame }} className="absolute inset-x-5 top-[112px] h-px bg-line" />
      {FRAGMENTS.map((f, i) => (
        <FragmentRow key={f.title} f={f} i={i} progress={progress} spread={spread} />
      ))}
      <motion.div
        style={{ opacity: nextOpacity, y: nextY, top: ROWS_TOP + FRAGMENTS.length * ROW_H + 14 }}
        className="absolute inset-x-4 flex items-center justify-between rounded-2xl bg-ink px-4 py-3 text-canvas"
      >
        <span className="flex items-center gap-2.5 text-[14px]">
          <Wheat className="size-4 text-[#b9d3c5]" />
          <span>
            <span className="block text-[11px] uppercase tracking-[0.12em] text-[#b7b2a8]">Next up</span>
            Log lunch in one sentence
          </span>
        </span>
        <ArrowRight className="size-4" />
      </motion.div>
    </div>
  );
}

const CAPTIONS = ["Your food, training, steps, and sleep live in five different places.", "Simply Fit puts them into one day.", "And tells you the one thing to do next."];

function Caption({ progress, i }: { progress: MotionValue<number>; i: number }) {
  const ranges = [
    [0, 0.05, 0.25, 0.35],
    [0.3, 0.4, 0.62, 0.72],
    [0.7, 0.8, 1, 1.01],
  ][i];
  const opacity = useTransform(progress, ranges, [i === 0 ? 1 : 0, 1, 1, i === 2 ? 1 : 0]);
  const y = useTransform(progress, [ranges[0], ranges[1]], [8, 0]);
  return (
    <motion.p style={{ opacity, y }} className="absolute inset-x-0 top-0 text-center text-[15px] text-muted lg:text-left">
      {CAPTIONS[i]}
    </motion.p>
  );
}

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const reduce = mounted && Boolean(prefersReduced);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const smooth = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 });
  const settled = useMotionValue(1);
  const progress = reduce ? settled : smooth;
  const hintOpacity = useTransform(scrollYProgress, [0, 0.08], [1, 0]);

  return (
    <section ref={ref} className="relative h-[260vh]">
      <div className="sticky top-0 flex min-h-[100svh] items-center overflow-hidden pt-20 lg:pt-16">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-6 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-12">
          <div className="text-center lg:text-left">
            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="font-display text-[56px] leading-[0.95] tracking-[-0.02em] text-ink sm:text-[80px] lg:text-[96px]"
            >
              Plan less.
              <br />
              <span className="italic text-accent">Do more.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              className="mx-auto mt-5 max-w-md text-[17px] leading-relaxed text-ink-soft sm:text-lg lg:mx-0"
            >
              Simply Fit brings your nutrition, workouts, activity, recovery, and goals into one clear plan.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start"
            >
              <ButtonLink href="/signup" size="lg">
                Build My Plan <ArrowRight className="size-4" />
              </ButtonLink>
              <ButtonLink href="#how-it-works" variant="secondary" size="lg">
                See How It Works
              </ButtonLink>
            </motion.div>
            <div className="relative mt-8 hidden h-6 lg:block">
              {CAPTIONS.map((_, i) => (
                <Caption key={i} i={i} progress={progress} />
              ))}
            </div>
          </div>
          <div className="relative h-[470px] sm:h-[540px] lg:h-[620px]">
            <div className="absolute inset-x-0 top-2 sm:top-6">
              <TodayStage progress={progress} />
            </div>
          </div>
        </div>
        {!reduce && (
          <motion.div style={{ opacity: hintOpacity }} className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
            <span className="flex items-center gap-2 rounded-full border border-line bg-surface/80 px-3 py-1.5 text-[12px] text-muted backdrop-blur">
              <span className="relative block h-4 w-2.5 rounded-full border border-faint">
                <motion.span
                  className="absolute left-1/2 top-0.5 h-1 w-0.5 -translate-x-1/2 rounded-full bg-muted"
                  animate={{ y: [0, 5, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
                />
              </span>
              Scroll to organize your day
            </span>
          </motion.div>
        )}
      </div>
    </section>
  );
}
