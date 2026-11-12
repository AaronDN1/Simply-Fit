"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Field, Input, Segmented, UnitInput } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { macrosFor, mealForTime, searchFoods, type FoodItem } from "@/lib/foods";
import type { FoodEntry, Meal } from "@/lib/types";
import { cn, todayISO, uid } from "@/lib/utils";
import { MEAL_LABEL } from "./nutrition-chat";

interface Values {
  name: string;
  quantity: string;
  calories: number | "";
  proteinG: number | "";
  carbsG: number | "";
  fatG: number | "";
  meal: Meal;
}

const blank = (meal: Meal): Values => ({ name: "", quantity: "", calories: "", proteinG: "", carbsG: "", fatG: "", meal });

/** Manual add (with a food lookup) and edit/delete for logged entries. */
export function FoodSheet({ open, onClose, entry, date = todayISO(), defaultMeal }: { open: boolean; onClose: () => void; entry?: FoodEntry | null; date?: string; defaultMeal?: Meal }) {
  const { saveFood, deleteFood } = useStore();
  const toast = useToast();
  const [v, setV] = useState<Values>(blank(defaultMeal ?? mealForTime()));
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<FoodItem | null>(null);
  const [grams, setGrams] = useState<number | "">(100);
  const [state, setState] = useState<"cooked" | "raw">("cooked");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setPicked(null);
    setGrams(100);
    setState("cooked");
    setV(
      entry
        ? { name: entry.name, quantity: entry.quantity, calories: entry.calories, proteinG: entry.proteinG, carbsG: entry.carbsG, fatG: entry.fatG, meal: entry.meal }
        : blank(defaultMeal ?? mealForTime())
    );
  }, [open, entry, defaultMeal]);

  useEffect(() => {
    if (!picked || grams === "") return;
    const m = macrosFor(picked, grams, state);
    setV((s) => ({ ...s, name: `${picked.name}${picked.raw ? (state === "raw" ? " (uncooked)" : " (cooked)") : ""}`, quantity: `${grams} g`, ...m }));
  }, [picked, grams, state]);

  const results = useMemo(() => (query ? searchFoods(query, 6) : []), [query]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!v.name.trim() || v.calories === "") return;
    setSaving(true);
    try {
      await saveFood({
        id: entry?.id ?? uid(),
        date: entry?.date ?? date,
        meal: v.meal,
        name: v.name.trim(),
        quantity: v.quantity.trim(),
        calories: Math.round(Number(v.calories)),
        proteinG: Number(v.proteinG) || 0,
        carbsG: Number(v.carbsG) || 0,
        fatG: Number(v.fatG) || 0,
        source: entry?.source ?? "manual",
        createdAt: entry?.createdAt ?? new Date().toISOString(),
      });
      toast(entry ? "Entry updated" : `Added to ${MEAL_LABEL[v.meal]}`);
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!entry) return;
    try {
      await deleteFood(entry.id);
      toast("Entry deleted");
      onClose();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't delete", "error");
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={entry ? "Edit entry" : "Add food manually"} description={entry ? undefined : "Look up a common food, or enter the numbers from a label."}>
      <form onSubmit={submit} className="space-y-4">
        {!entry && (
          <div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search foods (e.g. oats, salmon)" className="pl-10" aria-label="Search foods" />
            </div>
            {results.length > 0 && !picked && (
              <ul className="mt-2 overflow-hidden rounded-xl border border-line">
                {results.map((f) => (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(f);
                        setQuery(f.name);
                        const unitG = f.countUnit ? f.units[f.countUnit] : undefined;
                        setGrams(unitG ? Math.round(unitG) : 100);
                      }}
                      className="flex w-full items-center justify-between px-3.5 py-2.5 text-left text-[14px] hover:bg-canvas"
                    >
                      <span>{f.name}</span>
                      <span className="text-[12px] tabular text-muted">{f.per100[0]} kcal / 100 g</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {picked && (
              <div className="mt-3 grid grid-cols-[1fr_auto] items-end gap-3 rounded-xl bg-canvas p-3">
                <Field label="Amount">
                  <UnitInput value={grams} onChange={setGrams} unit="g" />
                </Field>
                {picked.raw ? (
                  <Segmented
                    size="sm"
                    className="mb-1"
                    value={state}
                    onChange={setState}
                    options={[
                      { value: "cooked", label: "Cooked" },
                      { value: "raw", label: "Uncooked" },
                    ]}
                  />
                ) : (
                  <button type="button" onClick={() => { setPicked(null); setQuery(""); }} className="mb-3 text-[13px] text-muted hover:text-ink">
                    Change
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <Field label="Name">
          <Input value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} placeholder="e.g. Turkey sandwich" required />
        </Field>
        <Field label="Amount" hint="Optional">
          <Input value={v.quantity} onChange={(e) => setV({ ...v, quantity: e.target.value })} placeholder="e.g. 1 sandwich" />
        </Field>
        <div className="grid grid-cols-4 gap-2">
          {(
            [
              ["calories", "kcal", "Calories"],
              ["proteinG", "g", "Protein"],
              ["carbsG", "g", "Carbs"],
              ["fatG", "g", "Fat"],
            ] as const
          ).map(([k, unit, label]) => (
            <Field key={k} label={label}>
              <UnitInput value={v[k]} onChange={(n) => setV({ ...v, [k]: n })} unit={unit} />
            </Field>
          ))}
        </div>
        <Field label="Meal">
          <div className="grid grid-cols-4 gap-1.5">
            {(Object.keys(MEAL_LABEL) as Meal[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setV({ ...v, meal: m })}
                className={cn("h-10 rounded-xl border text-[13px] font-medium transition-colors", v.meal === m ? "border-accent bg-accent-tint text-accent-strong" : "border-line bg-surface text-ink-soft")}
              >
                {MEAL_LABEL[m]}
              </button>
            ))}
          </div>
        </Field>
        <div className="flex gap-2 pt-1">
          {entry && (
            <Button type="button" variant="secondary" onClick={remove} className="h-11 text-clay" aria-label="Delete entry">
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
          <Button type="submit" className="h-11 flex-1" loading={saving} disabled={!v.name.trim() || v.calories === ""}>
            {entry ? "Save changes" : "Add food"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}