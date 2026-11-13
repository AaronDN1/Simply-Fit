"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useStore } from "@/lib/store";
import { emptySets } from "@/lib/workouts";
import type { WorkoutDay, WorkoutLog } from "@/lib/types";
import { todayISO, uid } from "@/lib/utils";

export function WorkoutCheckoff({ day, log, date = todayISO(), compact = false }: { day: WorkoutDay; log?: WorkoutLog; date?: string; compact?: boolean }) {
  const { data, saveWorkout } = useStore();
  const toast = useToast();
  const completed = log?.completedAt != null;

  async function toggle() {
    try {
      if (log) {
        await saveWorkout({ ...log, completedAt: completed ? null : new Date().toISOString() });
      } else {
        const now = new Date().toISOString();
        await saveWorkout({
          id: uid(),
          date,
          dayId: day.id,
          dayName: day.name,
          sets: emptySets(day, data.workouts),
          notes: "Marked complete without logging sets.",
          startedAt: now,
          completedAt: now,
        });
      }
      toast(completed ? "Workout reopened" : "Workout marked complete");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't update workout", "error");
    }
  }

  return (
    <Button variant={completed ? "quiet" : "secondary"} size={compact ? "sm" : "md"} onClick={toggle}>
      <Check className="size-3.5" strokeWidth={completed ? 3 : 2} />
      {completed ? "Workout completed" : "Mark workout complete"}
    </Button>
  );
}
