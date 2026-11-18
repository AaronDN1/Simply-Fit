"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChevronLeft, ChevronRight, Plus, Sparkles } from "lucide-react";
import { Card, PageHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedNumber, Bar, Ring } from "@/components/ui/data";
import { NutritionChat, MEAL_LABEL } from "@/components/app/nutrition-chat";
import { MacroEditor } from "@/components/app/macro-editor";
import { FoodSheet } from "@/components/app/food-sheet";
import { SavedMeals } from "@/components/app/saved-meals";
import { useStore } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { totalsFor } from "@/lib/stats";
import type { FoodEntry, Meal } from "@/lib/types";
import { addDays, relativeDayLabel, todayISO } from "@/lib/utils";

const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

export default function NutritionPage() {
  const { data, updateProfile } = useStore();
  const toast = useToast();
  const plan = data.profile.plan!;
  const [date, setDate] = useState(todayISO);
  const [sheet, setSheet] = useState<{ open: boolean; entry: FoodEntry | null; meal?: Meal }>({ open: false, entry: null });
  const totals = totalsFor(data.foods, date);
  const remaining = plan.calorieTarget - totals.calories;
  const entries = data.foods.filter((f) => f.date === date).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const isToday = date === todayISO();

  async function saveMacros(next: typeof plan) {
    await updateProfile({ plan: next });
    toast("Macro targets saved");
  }

  return (
    <div>
      <PageHeader
        title="Nutrition"
        action={
          <div className="flex flex-wrap items-center justify-end gap-2">
            <MacroEditor plan={plan} intake={data.profile.intake!} units={data.profile.settings.units} onApply={saveMacros} />
            <div className="flex items-center gap-1 rounded-full border border-line bg-surface p-1">
              <button onClick={() => setDate(addDays(date, -1))} className="grid size-8 place-items-center rounded-full hover:bg-sunken" aria-label="Previous day">
                <ChevronLeft className="size-4" />
              </button>
              <span className="min-w-[96px] text-center text-sm font-medium">{relativeDayLabel(date)}</span>
              <button onClick={() => setDate(addDays(date, 1))} disabled={isToday} className="grid size-8 place-items-center rounded-full hover:bg-sunken disabled:opacity-30" aria-label="Next day">
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        }
      />

      <Card className="mb-5 p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <Ring value={totals.calories / plan.calorieTarget} size={84} stroke={8} color={remaining < -plan.calorieTarget * 0.05 ? "var(--color-honey)" : "var(--color-accent)"}>
              <span className="text-[13px] font-semibold tabular">{Math.round((totals.calories / plan.calorieTarget) * 100)}%</span>
            </Ring>
            <div>
              <p className="text-[30px] font-semibold leading-none tracking-tight">
                <AnimatedNumber value={Math.abs(Math.round(remaining))} />
                <span className="ml-1.5 text-[15px] font-normal text-muted">{remaining >= 0 ? "kcal left" : "kcal over"}</span>
              </p>
              <p className="mt-1.5 text-sm text-muted">
                <AnimatedNumber value={Math.round(totals.calories)} /> eaten of {plan.calorieTarget.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="grid flex-1 grid-cols-3 gap-4 sm:ml-6 sm:border-l sm:border-line sm:pl-6">
            {[
              { l: "Protein", v: totals.proteinG, t: plan.proteinG, c: "bg-accent" },
              { l: "Carbs", v: totals.carbsG, t: plan.carbsG, c: "bg-honey" },
              { l: "Fat", v: totals.fatG, t: plan.fatG, c: "bg-clay" },
            ].map((m) => (
              <div key={m.l}>
                <p className="text-[12px] text-muted">{m.l}</p>
                <p className="mb-1.5 mt-0.5 text-[17px] font-semibold tabular">
                  <AnimatedNumber value={Math.round(m.v)} />
                  <span className="text-[13px] font-normal text-muted"> / {m.t} g</span>
                </p>
                <Bar value={m.v / m.t} color={m.c} />
              </div>
            ))}
          </div>
        </div>
        {remaining < -plan.calorieTarget * 0.1 && (
          <p className="mt-4 rounded-xl bg-honey-soft px-3.5 py-2.5 text-[13px] text-honey">
            A bit over today — totally normal. One day doesn't change your trend; tomorrow's plan stays the same.
          </p>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-3 lg:sticky lg:top-8 lg:self-start">
          <Card className="overflow-hidden">
            <NutritionChat key={date} date={date} remaining={remaining} />
          </Card>
          <SavedMeals date={date} />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-semibold tracking-tight">{isToday ? "Today's meals" : "Meals"}</h2>
            <Button variant="secondary" size="sm" onClick={() => setSheet({ open: true, entry: null })}>
              <Plus className="size-3.5" /> Add manually
            </Button>
          </div>
          {MEALS.map((meal) => {
            const list = entries.filter((e) => e.meal === meal);
            const kcal = list.reduce((s, e) => s + e.calories, 0);
            return (
              <Card key={meal} className="overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 sm:px-5">
                  <p className="text-[14px] font-semibold">{MEAL_LABEL[meal]}</p>
                  <div className="flex items-center gap-2">
                    {kcal > 0 && <span className="text-[13px] tabular text-muted">{kcal.toLocaleString()} kcal</span>}
                    <button onClick={() => setSheet({ open: true, entry: null, meal })} className="grid size-7 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink" aria-label={`Add to ${MEAL_LABEL[meal]}`}>
                      <Plus className="size-4" />
                    </button>
                  </div>
                </div>
                <AnimatePresence initial={false}>
                  {list.map((e) => (
                    <motion.button
                      key={e.id}
                      layout
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ type: "spring", stiffness: 400, damping: 36 }}
                      onClick={() => setSheet({ open: true, entry: e })}
                      className="block w-full overflow-hidden border-t border-line text-left hover:bg-canvas/60"
                    >
                      <div className="flex items-center gap-3 px-4 py-2.5 sm:px-5">
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-[14px]">
                            {e.name}
                            {e.source === "ai" && <Sparkles className="size-3 shrink-0 text-accent/60" aria-label="Logged with AI" />}
                          </p>
                          <p className="truncate text-[12px] text-muted">
                            {e.quantity ? `${e.quantity} · ` : ""}
                            {Math.round(e.proteinG)}P {Math.round(e.carbsG)}C {Math.round(e.fatG)}F
                          </p>
                        </div>
                        <span className="text-[14px] tabular text-ink-soft">{e.calories}</span>
                      </div>
                    </motion.button>
                  ))}
                </AnimatePresence>
                {list.length === 0 && <p className="border-t border-line px-4 py-2.5 text-[13px] text-faint sm:px-5">Nothing logged</p>}
              </Card>
            );
          })}
        </div>
      </div>

      <FoodSheet open={sheet.open} entry={sheet.entry} defaultMeal={sheet.meal} date={date} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
    </div>
  );
}
