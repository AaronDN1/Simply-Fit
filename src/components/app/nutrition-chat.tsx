"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Check, Pencil, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { AiInputTools, type AiAttachment } from "@/components/app/ai-input-tools";
import { useStore } from "@/lib/store";
import { apiPost } from "@/lib/api";
import { mealForTime, type EstimateItem, type EstimateResult } from "@/lib/foods";
import type { Meal, SavedMeal } from "@/lib/types";
import { cn, todayISO, uid } from "@/lib/utils";
import { AI_OFF_COPY, AI_ON_COPY } from "@/lib/legal";
import Link from "next/link";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = ["2 eggs and a slice of toast for breakfast", "150g white rice and 8 oz chicken breast for lunch", "A banana and a scoop of whey"];

export const MEAL_LABEL: Record<Meal, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };

export function NutritionChat({ date = todayISO(), remaining }: { date?: string; remaining: number }) {
  const { data, mode, saveFood, updateProfile } = useStore();
  const toast = useToast();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const [thinking, setThinking] = useState(false);
  const [estimate, setEstimate] = useState<{ items: EstimateItem[]; meal: Meal; mealName?: string; engine: string } | null>(null);
  const [logged, setLogged] = useState<{ calories: number; meal: Meal } | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingMeal, setSavingMeal] = useState(false);
  const wantsCloud = data.profile.settings.privacy.aiUsesHistory;
  const cloud = wantsCloud && mode !== "demo";
  const aiNote = mode === "demo" ? "This browser demo uses the built-in estimator and does not send meals to OpenAI." : wantsCloud ? AI_ON_COPY : AI_OFF_COPY;
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, estimate, thinking]);

  async function send(text: string) {
    const content = text.trim();
    if ((!content && !attachments.length) || thinking) return;
    if (!cloud && attachments.length) {
      toast("Turn on cloud AI in Settings to send a photo or voice note.", "error");
      return;
    }
    setLogged(null);
    const attachmentNote = attachments.length ? ` [${attachments.map((a) => a.type).join(", ")} attached]` : "";
    const next = [...messages, { id: uid(), role: "user" as const, content: content || "Please review the attached input." }];
    const currentAttachments = attachments;
    setMessages(next);
    setInput("");
    setAttachments([]);
    setEstimate(null);
    setThinking(true);
    try {
      const res = await apiPost<EstimateResult & { engine: string }>("/api/ai/nutrition", {
        messages: next.map(({ role, content }, index) => ({ role, content: index === next.length - 1 ? `${content}${attachmentNote}` : content })),
        attachments: cloud ? currentAttachments : undefined,
        useCloud: cloud,
        context: {
          remainingCalories: remaining,
          localTime: new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
        },
      }, 70_000);
      setMessages((m) => [...m, { id: uid(), role: "assistant", content: res.reply }]);
      if (res.status === "ready" && res.items.length) setEstimate({ items: res.items, meal: res.meal ?? mealForTime(), mealName: res.mealName, engine: res.engine });
    } catch (e) {
      setMessages((m) => [...m, { id: uid(), role: "assistant", content: e instanceof Error ? e.message : "Something went wrong." }]);
    } finally {
      setThinking(false);
      inputRef.current?.focus();
    }
  }

  async function confirm() {
    if (!estimate) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      for (const it of estimate.items)
        await saveFood({
          id: uid(),
          date,
          meal: estimate.meal,
          name: it.name,
          quantity: it.quantity,
          calories: Math.round(it.calories),
          proteinG: it.proteinG,
          carbsG: it.carbsG,
          fatG: it.fatG,
          source: "ai",
          createdAt: now,
        });
      const total = estimate.items.reduce((s, i) => s + i.calories, 0);
      setLogged({ calories: Math.round(total), meal: estimate.meal });
      setEstimate(null);
      setMessages([]);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't log that", "error");
    } finally {
      setSaving(false);
    }
  }

  async function saveMeal() {
    if (!estimate) return;
    setSavingMeal(true);
    try {
      const saved: SavedMeal = {
        id: uid(),
        name: estimate.mealName?.trim() || estimate.items.map((item) => item.name).slice(0, 2).join(" + ") || MEAL_LABEL[estimate.meal],
        meal: estimate.meal,
        items: estimate.items.map(({ name, quantity, calories, proteinG, carbsG, fatG }) => ({ name, quantity, calories, proteinG, carbsG, fatG })),
        createdAt: new Date().toISOString(),
      };
      await updateProfile({ settings: { ...data.profile.settings, savedMeals: [...data.profile.settings.savedMeals, saved] } });
      toast("Meal saved for next time");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save meal", "error");
    } finally {
      setSavingMeal(false);
    }
  }

  function reset() {
    setMessages([]);
    setEstimate(null);
    setLogged(null);
    setInput("");
  }

  const empty = messages.length === 0 && !logged;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <p className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
          <Sparkles className="size-4 text-accent" /> Log with a sentence
        </p>
        {messages.length > 0 && (
          <button onClick={reset} className="flex items-center gap-1 text-[13px] text-muted hover:text-ink">
            <RotateCcw className="size-3.5" /> Start over
          </button>
        )}
      </div>

      <div ref={scroller} className="min-h-[220px] flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:max-h-[460px] sm:px-5">
        {empty && (
          <div className="py-4">
            <p className="text-[15px] text-ink-soft">Tell me what you ate, like you'd text a friend. I'll ask if anything's unclear, then you confirm before it's logged.</p>
            <div className="mt-4 flex flex-col items-start gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-canvas px-3.5 py-1.5 text-left text-[13px] text-ink-soft transition-colors hover:border-line-strong hover:text-ink">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((m) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
            >
              <div className={cn("max-w-[86%] rounded-[18px] px-3.5 py-2 text-[15px] leading-snug", m.role === "user" ? "rounded-br-md bg-ink text-canvas" : "rounded-bl-md bg-sunken/70 text-ink")}>{m.content}</div>
            </motion.div>
          ))}
        </AnimatePresence>

        {thinking && (
          <div className="flex gap-1 px-1 py-2" aria-label="Thinking">
            {[0, 1, 2].map((i) => (
              <motion.span key={i} className="size-1.5 rounded-full bg-faint" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }} />
            ))}
          </div>
        )}

        <AnimatePresence>
          {estimate && <EstimateCard key="est" estimate={estimate} setEstimate={setEstimate} onConfirm={confirm} onSave={saveMeal} saving={saving} savingMeal={savingMeal} />}
          {logged && (
            <motion.div
              key="logged"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 22 }}
              className="flex items-center gap-3 rounded-2xl bg-accent-tint px-4 py-3.5"
            >
              <motion.span initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 500, damping: 18, delay: 0.05 }} className="grid size-8 place-items-center rounded-full bg-accent text-on-accent">
                <Check className="size-4" strokeWidth={3} />
              </motion.span>
              <div>
                <p className="text-[15px] font-medium text-accent-strong">
                  Logged to {MEAL_LABEL[logged.meal]} · {logged.calories.toLocaleString()} kcal
                </p>
                <p className="text-[13px] text-accent">Your totals are updated. What else did you have?</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <form
        className="relative border-t border-line p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="flex items-end gap-2 rounded-[22px] border border-line bg-canvas p-1.5 pl-4 transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--color-accent-soft)]">
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            placeholder={messages.length ? "Reply…" : "What did you eat?"}
            aria-label="Describe what you ate"
            className="max-h-32 min-h-[36px] flex-1 resize-none bg-transparent py-2 text-[15px] outline-none placeholder:text-faint"
          />
          {cloud && (
            <div className="absolute -translate-y-11">
              <AiInputTools attachments={attachments} onChange={setAttachments} disabled={thinking} />
            </div>
          )}
          <button type="submit" disabled={(!input.trim() && !attachments.length) || thinking} className="grid size-9 shrink-0 place-items-center rounded-full bg-ink text-canvas transition-opacity disabled:opacity-30" aria-label="Send">
            <ArrowUp className="size-4" />
          </button>
        </div>
        <p className="px-1 pt-2 text-[12px] leading-relaxed text-muted">
          {aiNote}{" "}
          <Link href="/settings" className="font-medium text-ink underline-offset-4 hover:underline">
            Settings
          </Link>
        </p>
      </form>
    </div>
  );
}

function EstimateCard({
  estimate,
  setEstimate,
  onConfirm,
  onSave,
  saving,
  savingMeal,
}: {
  estimate: { items: EstimateItem[]; meal: Meal; mealName?: string; engine: string };
  setEstimate: (e: { items: EstimateItem[]; meal: Meal; mealName?: string; engine: string } | null) => void;
  onConfirm: () => void;
  onSave: () => void;
  saving: boolean;
  savingMeal: boolean;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const total = estimate.items.reduce(
    (s, i) => ({ c: s.c + i.calories, p: s.p + i.proteinG, cb: s.cb + i.carbsG, f: s.f + i.fatG }),
    { c: 0, p: 0, cb: 0, f: 0 }
  );
  const update = (i: number, patch: Partial<EstimateItem>) => setEstimate({ ...estimate, items: estimate.items.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
  const remove = (i: number) => {
    const items = estimate.items.filter((_, j) => j !== i);
    setEstimate(items.length ? { ...estimate, items } : null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 360, damping: 30 }}
      className="rounded-2xl border border-line bg-surface p-4 shadow-[var(--shadow-soft)]"
    >
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-muted">Review estimate</p>
        <span className="rounded-full bg-sunken px-2 py-0.5 text-[11px] text-muted">{estimate.engine === "offline" ? "Built-in estimator" : "OpenAI estimate"}</span>
      </div>
      <ul className="mt-2 divide-y divide-line">
        {estimate.items.map((it, i) => (
          <li key={i} className="py-2.5">
            {editing === i ? (
              <div className="space-y-2">
                <input value={it.name} onChange={(e) => update(i, { name: e.target.value })} className="w-full rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[14px]" aria-label="Name" />
                <div className="grid grid-cols-4 gap-1.5">
                  {(
                    [
                      ["calories", "kcal"],
                      ["proteinG", "P"],
                      ["carbsG", "C"],
                      ["fatG", "F"],
                    ] as const
                  ).map(([k, l]) => (
                    <label key={k} className="relative">
                      <input
                        type="number"
                        inputMode="decimal"
                        value={it[k]}
                        onChange={(e) => update(i, { [k]: Number(e.target.value) || 0 })}
                        className="w-full rounded-lg border border-line bg-canvas py-1.5 pl-2 pr-7 text-[13px] tabular"
                        aria-label={l}
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted">{l}</span>
                    </label>
                  ))}
                </div>
                <button onClick={() => setEditing(null)} className="text-[13px] font-medium text-accent">
                  Done
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium">{it.name}</p>
                  <p className="truncate text-[12px] text-muted">
                    {it.quantity} · {Math.round(it.proteinG)}P {Math.round(it.carbsG)}C {Math.round(it.fatG)}F
                  </p>
                </div>
                <span className="text-[14px] tabular">{Math.round(it.calories)}</span>
                <button onClick={() => setEditing(i)} className="grid size-7 place-items-center rounded-full text-faint hover:bg-sunken hover:text-ink" aria-label={`Edit ${it.name}`}>
                  <Pencil className="size-3.5" />
                </button>
                <button onClick={() => remove(i)} className="grid size-7 place-items-center rounded-full text-faint hover:bg-sunken hover:text-clay" aria-label={`Remove ${it.name}`}>
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex items-baseline justify-between border-t border-line pt-3">
        <span className="text-[13px] text-muted">
          {Math.round(total.p)} P · {Math.round(total.cb)} C · {Math.round(total.f)} F
        </span>
        <span className="text-lg font-semibold tabular">{Math.round(total.c).toLocaleString()} kcal</span>
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          size="sm"
          value={estimate.meal}
          onChange={(meal) => setEstimate({ ...estimate, meal })}
          options={(Object.keys(MEAL_LABEL) as Meal[]).map((m) => ({ value: m, label: MEAL_LABEL[m] }))}
        />
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onSave} loading={savingMeal} size="sm" className="h-9">
            Save meal
          </Button>
          <Button onClick={onConfirm} loading={saving} size="sm" className="h-9">
            <Check className="size-4" /> Log meal
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
