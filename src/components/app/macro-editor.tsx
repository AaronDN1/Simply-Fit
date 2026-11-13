"use client";

import { useEffect, useMemo, useState } from "react";
import { PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { applyMacroTargets, caloriesForMacros, calorieFloor, KCAL_PER_KG, rateBounds } from "@/lib/plan";
import { formatRate } from "@/lib/units";
import type { Intake, Plan, Settings } from "@/lib/types";

export function MacroEditor({
  plan,
  intake,
  units,
  onApply,
}: {
  plan: Plan;
  intake: Intake;
  units: Settings["units"];
  onApply: (plan: Plan) => Promise<void> | void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({ proteinG: plan.proteinG, carbsG: plan.carbsG, fatG: plan.fatG });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) setValues({ proteinG: plan.proteinG, carbsG: plan.carbsG, fatG: plan.fatG });
  }, [open, plan.proteinG, plan.carbsG, plan.fatG]);

  const calories = useMemo(() => caloriesForMacros(values), [values]);
  const preview = useMemo(() => applyMacroTargets(intake, plan, values, units), [intake, plan, units, values]);
  const floor = calorieFloor(intake);
  const maxCalories = plan.maintenanceCalories + (rateBounds(intake).maxGain * KCAL_PER_KG) / 7;
  const invalid =
    !Object.values(values).every((value) => Number.isFinite(value) && value >= 0) ||
    calories < floor ||
    calories > maxCalories;

  async function apply() {
    if (invalid) return;
    setSaving(true);
    try {
      await onApply(preview);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <PencilLine className="size-3.5" /> Edit macros
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Edit macro targets"
        description="Set the grams you want. Calories and the projected pace update automatically."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <MacroInput label="Protein" value={values.proteinG} onChange={(proteinG) => setValues((v) => ({ ...v, proteinG }))} />
            <MacroInput label="Carbs" value={values.carbsG} onChange={(carbsG) => setValues((v) => ({ ...v, carbsG }))} />
            <MacroInput label="Fat" value={values.fatG} onChange={(fatG) => setValues((v) => ({ ...v, fatG }))} />
          </div>
          <div className="rounded-2xl bg-canvas p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">New daily calories</span>
              <span className="font-semibold tabular">{Math.round(calories).toLocaleString()} kcal</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-muted">Estimated pace</span>
              <span className="font-semibold tabular">{formatRate(preview.levers.weeklyRateKg, units)} / week</span>
            </div>
          </div>
          <p className="text-[12px] leading-relaxed text-muted">
            Calories use 4 kcal/g for protein and carbs, and 9 kcal/g for fat. This changes your projected rate while your activity stays the same.
          </p>
          {invalid && (
            <p className="rounded-xl bg-honey-soft px-3 py-2 text-[12px] text-[#7a5a17]">
              Keep the macro total between {Math.round(floor).toLocaleString()} and {Math.round(maxCalories).toLocaleString()} kcal so the plan stays within its safe projected rate.
            </p>
          )}
          <Button className="w-full" size="lg" disabled={invalid} loading={saving} onClick={apply}>
            Save macro targets
          </Button>
        </div>
      </Sheet>
    </>
  );
}

function MacroInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] text-muted">{label} (g)</span>
      <input
        type="number"
        min={0}
        max={1000}
        step={1}
        value={Number.isFinite(value) ? value : ""}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-11 w-full rounded-xl border border-line bg-surface px-3 text-[15px] tabular outline-none focus:border-accent"
      />
    </label>
  );
}
