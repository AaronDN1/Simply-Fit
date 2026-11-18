"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { THEME_COLOR, THEME_KEY } from "@/lib/theme-boot";
import { cn } from "@/lib/utils";

export type ThemeChoice = "light" | "dark" | "system";

type ThemeValue = {
  choice: ThemeChoice;
  resolved: "light" | "dark";
  setChoice: (choice: ThemeChoice) => void;
};

const ThemeContext = createContext<ThemeValue>({
  choice: "light",
  resolved: "light",
  setChoice: () => {},
});

function resolve(choice: ThemeChoice) {
  if (choice === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  return choice;
}

function apply(choice: ThemeChoice) {
  const resolved = resolve(choice);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLOR[resolved]);
  return resolved;
}

function readChoice(): ThemeChoice {
  const stored = localStorage.getItem(THEME_KEY);
  return stored === "dark" || stored === "system" || stored === "light" ? stored : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [choice, setChoiceState] = useState<ThemeChoice>("light");
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const initial = readChoice();
    setChoiceState(initial);
    setResolved(apply(initial));
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (localStorage.getItem(THEME_KEY) === "system") setResolved(apply("system"));
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setChoice = (next: ThemeChoice) => {
    localStorage.setItem(THEME_KEY, next);
    setChoiceState(next);
    setResolved(apply(next));
  };

  return <ThemeContext.Provider value={{ choice, resolved, setChoice }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function ThemeSwitch({ className, labelled = true }: { className?: string; labelled?: boolean }) {
  const { choice, setChoice } = useTheme();
  return (
    <div className={cn("grid grid-cols-3 gap-0.5 rounded-full bg-sunken p-0.5", labelled ? "gap-1 p-1" : "min-w-[7.5rem]", className)} role="radiogroup" aria-label="Appearance">
      {OPTIONS.map((o) => {
        const on = choice === o.value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={o.label}
            onClick={() => setChoice(o.value)}
            className={cn(
              "flex min-h-8 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-medium transition-colors",
              on ? "bg-surface text-ink shadow-[var(--shadow-soft)]" : "text-muted hover:text-ink"
            )}
          >
            <Icon className="size-3.5" />
            {labelled && o.label}
          </button>
        );
      })}
    </div>
  );
}
