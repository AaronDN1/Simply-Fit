"use client";

import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import type { Meal, SavedMeal } from "@/lib/types";
import { MEAL_LABEL } from "@/components/app/nutrition-chat";
import { uid } from "@/lib/utils";

const MEALS: Meal[] = ["breakfast", "lunch", "dinner", "snack"];

export function SavedMeals({ date }: { date: string }) {
  const { data, saveFood, updateProfile } = useStore();
  const toast = useToast();
  const meals = data.profile.settings.savedMeals;
  const [editing, setEditing] = useState<SavedMeal | null>(null);
  const [saving, setSaving] = useState(false);

  async function add(meal: SavedMeal) {
    try {
      await Promise.all(meal.items.map((item) => saveFood({ ...item, id: uid(), date, meal: meal.meal, source: "manual", createdAt: new Date().toISOString() })));
      toast(`${meal.name} added to ${MEAL_LABEL[meal.meal]}`);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't add saved meal", "error");
    }
  }

  async function saveEdit() {
    if (!editing) return;
    setSaving(true);
    try {
      const savedMeals = meals.map((meal) => (meal.id === editing.id ? editing : meal));
      await updateProfile({ settings: { ...data.profile.settings, savedMeals } });
      setEditing(null);
      toast("Saved meal updated");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't update saved meal", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    await updateProfile({ settings: { ...data.profile.settings, savedMeals: meals.filter((meal) => meal.id !== id) } });
    toast("Saved meal removed");
  }

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-surface p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold tracking-tight">Saved meals</h2>
          <p className="mt-0.5 text-[12px] text-muted">Add frequent meals without estimating them again.</p>
        </div>
      </div>
      {meals.length === 0 ? (
        <p className="mt-4 rounded-xl bg-canvas px-3.5 py-3 text-[13px] text-muted">Save an AI estimate and it will appear here.</p>
      ) : (
        <ul className="mt-3 divide-y divide-line">
          {meals.map((meal) => {
            const totals = meal.items.reduce((sum, item) => ({ calories: sum.calories + item.calories, proteinG: sum.proteinG + item.proteinG, carbsG: sum.carbsG + item.carbsG, fatG: sum.fatG + item.fatG }), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
            return (
              <li key={meal.id} className="flex items-center gap-3 py-3">
                <button onClick={() => setEditing(meal)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate text-[14px] font-medium">{meal.name}</span>
                  <span className="block truncate text-[12px] text-muted">{MEAL_LABEL[meal.meal]} · {Math.round(totals.calories)} kcal · {Math.round(totals.proteinG)}P {Math.round(totals.carbsG)}C {Math.round(totals.fatG)}F</span>
                </button>
                <Button variant="secondary" size="sm" onClick={() => add(meal)}>
                  <Plus className="size-3.5" /> Add
                </Button>
                <button onClick={() => setEditing(meal)} className="grid size-8 place-items-center rounded-full text-faint hover:bg-sunken hover:text-ink" aria-label={`Edit ${meal.name}`}>
                  <Pencil className="size-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <Sheet open={!!editing} onClose={() => setEditing(null)} title="Edit saved meal" description="Update the name, meal slot, or nutrition values.">
        {editing && <SavedMealForm meal={editing} onChange={setEditing} onSave={saveEdit} onDelete={() => { void remove(editing.id); setEditing(null); }} saving={saving} />}
      </Sheet>
    </div>
  );
}

function SavedMealForm({ meal, onChange, onSave, onDelete, saving }: { meal: SavedMeal; onChange: (meal: SavedMeal) => void; onSave: () => void; onDelete: () => void; saving: boolean }) {
  const totals = useMemo(() => meal.items.reduce((sum, item) => ({ calories: sum.calories + item.calories, proteinG: sum.proteinG + item.proteinG, carbsG: sum.carbsG + item.carbsG, fatG: sum.fatG + item.fatG }), { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }), [meal.items]);
  return (
    <div className="space-y-4">
      <input value={meal.name} onChange={(e) => onChange({ ...meal, name: e.target.value })} className="h-11 w-full rounded-xl border border-line bg-canvas px-3 text-[15px] outline-none focus:border-accent" aria-label="Saved meal name" />
      <Segmented value={meal.meal} onChange={(value) => onChange({ ...meal, meal: value })} options={MEALS.map((value) => ({ value, label: MEAL_LABEL[value] }))} />
      <div className="divide-y divide-line rounded-2xl border border-line">
        {meal.items.map((item, index) => (
          <div key={index} className="space-y-2 p-3">
            <div className="flex items-center gap-2">
              <input value={item.name} onChange={(e) => onChange({ ...meal, items: meal.items.map((x, i) => (i === index ? { ...x, name: e.target.value } : x)) })} className="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-2.5 py-1.5 text-[13px]" aria-label="Saved food name" />
              <button onClick={() => onChange({ ...meal, items: meal.items.filter((_, i) => i !== index) })} className="grid size-7 place-items-center rounded-full text-faint hover:bg-sunken hover:text-clay" aria-label={`Remove ${item.name}`}>
                <Trash2 className="size-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {([["quantity", "Amount"], ["calories", "kcal"], ["proteinG", "P"], ["carbsG", "C"], ["fatG", "F"]] as const).map(([key, label]) => (
                <label key={key} className="relative">
                  <input value={item[key]} onChange={(e) => onChange({ ...meal, items: meal.items.map((x, i) => (i === index ? { ...x, [key]: key === "quantity" ? e.target.value : Number(e.target.value) || 0 } : x)) })} className="w-full rounded-lg border border-line bg-canvas px-2 py-1.5 text-[12px] tabular" aria-label={label} />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted">{label}</span>
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-right text-[13px] font-medium tabular">{Math.round(totals.calories)} kcal · {Math.round(totals.proteinG)}P {Math.round(totals.carbsG)}C {Math.round(totals.fatG)}F</p>
      <div className="flex gap-2">
        <Button variant="danger" size="sm" onClick={onDelete}>Delete</Button>
        <Button className="flex-1" size="sm" loading={saving} onClick={onSave}>Save changes</Button>
      </div>
    </div>
  );
}
