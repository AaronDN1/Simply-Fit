"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, ArrowUp, ChevronDown, Plus, RotateCcw, Search, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge, Card } from "@/components/ui/card";
import { Input, Textarea, Toggle } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { AiInputTools, type AiAttachment } from "@/components/app/ai-input-tools";
import { WorkoutCheckoff } from "@/components/app/workout-checkoff";
import { useStore } from "@/lib/store";
import { apiPost } from "@/lib/api";
import type { PlannedExercise, Split, WorkoutDay } from "@/lib/types";
import { BASIC_TEMPLATES, EXERCISES, plannedFrom, recommendedSplit, templateSplit, TOOLS_FOR } from "@/lib/workouts";
import { cn, uid, weekdayIndex, todayISO, WEEKDAYS } from "@/lib/utils";

export function SplitEditor() {
  const { data, updateProfile } = useStore();
  const toast = useToast();
  const intake = data.profile.intake!;
  const saved = useMemo(
    () => data.profile.split ?? recommendedSplit(intake, data.profile.plan!.levers.liftingDays),
    [data.profile.split, intake, data.profile.plan?.levers.liftingDays]
  );
  const [split, setSplit] = useState<Split>(saved);
  const [openDay, setOpenDay] = useState<number | null>(weekdayIndex(todayISO()));
  const [picker, setPicker] = useState<number | null>(null);
  const [ai, setAi] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    setSplit(saved);
  }, [saved]);
  const dirty = JSON.stringify(split) !== JSON.stringify(saved);

  const setDay = (i: number, patch: Partial<WorkoutDay>) => setSplit((s) => ({ ...s, source: s.source === "recommended" ? "custom" : s.source, days: s.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) }));
  const setEx = (i: number, exId: string, patch: Partial<PlannedExercise>) => setDay(i, { exercises: split.days[i].exercises.map((e) => (e.id === exId ? { ...e, ...patch } : e)) });
  const move = (i: number, idx: number, dir: -1 | 1) => {
    const list = [...split.days[i].exercises];
    const [x] = list.splice(idx, 1);
    list.splice(idx + dir, 0, x);
    setDay(i, { exercises: list });
  };

  async function save() {
    setSaving(true);
    try {
      await updateProfile({ split });
      toast("Training week saved");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't save", "error");
    } finally {
      setSaving(false);
    }
  }

  const trainingDays = split.days.filter((d) => !d.isRest).length;
  const todayDay = split.days[weekdayIndex(todayISO())];
  const todayLog = data.workouts.find((w) => w.date === todayISO());

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="flex items-center gap-2 text-[17px] font-semibold tracking-tight">
            {split.name}
            <Badge tone={split.source === "ai" ? "sky" : split.source === "custom" ? "honey" : "accent"}>{split.source === "ai" ? "AI-built" : split.source === "custom" ? "Custom" : "Recommended"}</Badge>
          </p>
          <p className="text-[13px] text-muted">
            {split.rotation ? `${trainingDays} training-day rotation · rest as needed` : `${trainingDays} training days · ${7 - trainingDays} rest`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {todayDay && !todayDay.isRest && <WorkoutCheckoff day={todayDay} log={todayLog} compact />}
          <Button variant="secondary" size="sm" onClick={() => setSplit(recommendedSplit(intake, data.profile.plan!.levers.liftingDays))}>
            <RotateCcw className="size-3.5" /> Recommended
          </Button>
          <Button variant="quiet" size="sm" onClick={() => setAi(true)}>
            <Sparkles className="size-3.5" /> Build or revise with AI
          </Button>
        </div>
      </div>

      <div className="mb-5 rounded-2xl border border-line bg-canvas p-3.5">
        <p className="mb-2 text-[12px] font-medium uppercase tracking-[0.1em] text-muted">Start from a template</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {BASIC_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => setSplit(templateSplit(intake, template.id))}
              className="rounded-xl border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-line-strong"
            >
              <span className="block text-[13px] font-medium">{template.label}</span>
              <span className="block text-[11px] text-muted">{template.description}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {split.days.map((d, i) => {
          const isOpen = openDay === i;
          return (
            <Card key={d.id} className="overflow-hidden">
              <button onClick={() => setOpenDay(isOpen ? null : i)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left sm:px-5" aria-expanded={isOpen}>
                <span className="w-10 text-[12px] font-medium uppercase tracking-wide text-muted">{split.rotation ? `Day ${i + 1}` : WEEKDAYS[i]?.slice(0, 3)}</span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate text-[15px] font-medium", d.isRest && "text-muted")}>{d.isRest ? "Rest" : d.name}</span>
                  {!d.isRest && <span className="block truncate text-[12px] text-muted">{d.exercises.length} exercises · {d.focus}</span>}
                </span>
                <ChevronDown className={cn("size-4 text-faint transition-transform", isOpen && "rotate-180")} />
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 380, damping: 38 }} className="overflow-hidden">
                    <div className="space-y-3 border-t border-line px-4 py-4 sm:px-5">
                      <div className="rounded-xl border border-line px-3">
                        <Toggle checked={d.isRest} onChange={(v) => setDay(i, { isRest: v, name: v ? "Rest" : d.name === "Rest" ? "Training day" : d.name })} label="Rest day" />
                      </div>
                      {!d.isRest && (
                        <>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <Input value={d.name} onChange={(e) => setDay(i, { name: e.target.value })} aria-label="Day name" placeholder="Day name" />
                            <Input value={d.focus} onChange={(e) => setDay(i, { focus: e.target.value })} aria-label="Focus" placeholder="Focus (e.g. Chest & back)" />
                          </div>
                          <ul className="space-y-2">
                            {d.exercises.map((e, idx) => (
                              <li key={e.id} className="rounded-xl border border-line p-3">
                                <div className="flex items-center gap-2">
                                  <Input value={e.name} onChange={(ev) => setEx(i, e.id, { name: ev.target.value })} className="h-9 flex-1 text-[14px] font-medium" aria-label="Exercise name" />
                                  <button disabled={idx === 0} onClick={() => move(i, idx, -1)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunken disabled:opacity-30" aria-label="Move up">
                                    <ArrowUp className="size-3.5" />
                                  </button>
                                  <button disabled={idx === d.exercises.length - 1} onClick={() => move(i, idx, 1)} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunken disabled:opacity-30" aria-label="Move down">
                                    <ArrowDown className="size-3.5" />
                                  </button>
                                  <button onClick={() => setDay(i, { exercises: d.exercises.filter((x) => x.id !== e.id) })} className="grid size-8 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-clay" aria-label="Remove exercise">
                                    <Trash2 className="size-3.5" />
                                  </button>
                                </div>
                                <div className="mt-2 grid grid-cols-5 gap-1.5">
                                  {(
                                    [
                                      ["sets", "Sets"],
                                      ["repsMin", "Min reps"],
                                      ["repsMax", "Max reps"],
                                      ["rpe", "RPE"],
                                      ["restSec", "Rest s"],
                                    ] as const
                                  ).map(([k, l]) => (
                                    <label key={k} className="block">
                                      <span className="mb-0.5 block text-[10px] uppercase tracking-wide text-faint">{l}</span>
                                      <input
                                        type="number"
                                        inputMode="decimal"
                                        value={e[k]}
                                        onChange={(ev) => setEx(i, e.id, { [k]: Number(ev.target.value) || 0 })}
                                        className="h-9 w-full rounded-lg border border-line bg-surface text-center text-[14px] tabular outline-none focus:border-accent"
                                      />
                                    </label>
                                  ))}
                                </div>
                                <Input value={e.notes} onChange={(ev) => setEx(i, e.id, { notes: ev.target.value })} placeholder="Notes (optional)" className="mt-2 h-9 text-[13px]" aria-label="Notes" />
                              </li>
                            ))}
                          </ul>
                          <Button variant="secondary" size="sm" onClick={() => setPicker(i)}>
                            <Plus className="size-3.5" /> Add exercise
                          </Button>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>

      <AnimatePresence>
        {dirty && (
          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 30, opacity: 0 }} className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-20 mt-4 flex justify-end gap-2 lg:bottom-6">
            <Button variant="secondary" onClick={() => setSplit(saved)}>
              Cancel
            </Button>
            <Button onClick={save} loading={saving} className="shadow-[var(--shadow-lift)]">
              Save training week
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <ExercisePicker
        open={picker != null}
        onClose={() => setPicker(null)}
        equipment={intake.equipment}
        onPick={(exId, custom) => {
          if (picker == null) return;
          const lib = EXERCISES.find((e) => e.id === exId);
          const pe: PlannedExercise = lib
            ? plannedFrom(lib, intake.trainingStyle)
            : { id: uid(), exerciseId: `custom:${custom!.toLowerCase().replace(/[^a-z0-9]+/g, "_")}`, name: custom!, sets: 3, repsMin: 8, repsMax: 12, rpe: 8, restSec: 90, weightKg: null, notes: "" };
          setDay(picker, { exercises: [...split.days[picker].exercises, pe] });
          setPicker(null);
        }}
      />
      <AiSplitSheet
        open={ai}
        onClose={() => setAi(false)}
        current={split}
        onApply={async (s) => {
          const next = s.rotation ? { ...s, rotation: { ...s.rotation, startDate: todayISO(), days: s.days } } : s;
          setSplit(next);
          await updateProfile({ split: next });
          toast("AI plan saved for your rotation");
        }}
      />
    </div>
  );
}

function ExercisePicker({ open, onClose, onPick, equipment }: { open: boolean; onClose: () => void; onPick: (id: string | null, custom?: string) => void; equipment: keyof typeof TOOLS_FOR }) {
  const [q, setQ] = useState("");
  const tools = TOOLS_FOR[equipment];
  const list = EXERCISES.filter((e) => e.name.toLowerCase().includes(q.toLowerCase())).sort(
    (a, b) => Number(b.tools.every((t) => tools.includes(t))) - Number(a.tools.every((t) => tools.includes(t)))
  );
  return (
    <Sheet open={open} onClose={onClose} title="Add exercise">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-faint" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search exercises" className="pl-10" autoFocus />
      </div>
      <ul className="mt-3 max-h-[50dvh] space-y-1 overflow-y-auto">
        {q.trim() && !list.some((e) => e.name.toLowerCase() === q.trim().toLowerCase()) && (
          <li>
            <button onClick={() => onPick(null, q.trim())} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-[14px] text-accent hover:bg-canvas">
              <Plus className="size-4" /> Add “{q.trim()}” as a custom exercise
            </button>
          </li>
        )}
        {list.map((e) => {
          const ok = e.tools.every((t) => tools.includes(t));
          return (
            <li key={e.id}>
              <button onClick={() => onPick(e.id)} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-canvas">
                <span className={cn("text-[14px]", !ok && "text-muted")}>{e.name}</span>
                <span className="text-[11px] capitalize text-faint">{e.pattern.replace("_", " ")}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}

function AiSplitSheet({ open, onClose, current, onApply }: { open: boolean; onClose: () => void; current: Split; onApply: (s: Split) => Promise<void> | void }) {
  const { data } = useStore();
  const toast = useToast();
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<AiAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ reply: string; split: Split; engine: string } | null>(null);
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const intake = data.profile.intake!;

  async function ask() {
    if (loading) return;
    setLoading(true);
    const currentAttachments = attachments;
    setAttachments([]);
    try {
      const summary = current.days.map((d, i) => `${WEEKDAYS[i]}: ${d.isRest ? "Rest" : `${d.name} — ${d.exercises.map((e) => `${e.name} ${e.sets}x${e.repsMin}-${e.repsMax}`).join(", ")}`}`).join("\n");
      const userMessage = text.trim() || "Please review the attached workout input.";
      const conversation = [...messages, { role: "user" as const, content: userMessage }]
        .slice(-6)
        .map((m) => `${m.role === "user" ? "User" : "Coach"}: ${m.content}`)
        .join("\n");
      const res = await apiPost<{ reply: string; split: Split; engine: string }>("/api/ai/coach", {
        request: conversation.slice(-780),
        attachments: currentAttachments,
        profile: {
          goal: intake.goal,
          experience: intake.experience,
          equipment: intake.equipment,
          trainingStyle: intake.trainingStyle,
          liftingDays: data.profile.plan!.levers.liftingDays,
          sessionMinutes: intake.liftingSessionMinutes,
        },
        currentSplit: summary,
      });
      setResult(res);
      setMessages((m) => [...m, { role: "user", content: userMessage }, { role: "assistant", content: res.reply }]);
      setText("");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't reach the coach", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={() => {
        onClose();
        setResult(null);
      setMessages([]);
      setText("");
      }}
      title="Build or revise with AI"
      description="Describe what you want. You'll review the result before anything changes."
      wide
    >
      <div className="space-y-3">
        {messages.length > 0 && (
          <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl bg-canvas p-3">
            {messages.map((m, i) => (
              <div key={`${m.role}-${i}`} className={cn("rounded-xl px-3 py-2 text-[13px] leading-relaxed", m.role === "user" ? "ml-6 bg-surface" : "mr-6 bg-accent-tint text-accent-strong")}>
                <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wide text-muted">{m.role === "user" ? "You" : "Coach"}</span>
                {m.content}
              </div>
            ))}
          </div>
        )}
        <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={messages.length ? "Ask a follow-up, like “Can you detail today's exercises?”" : "e.g. 4 days a week, 45 minutes max, more focus on legs. I only have dumbbells on Fridays."} rows={3} />
          <AiInputTools attachments={attachments} onChange={setAttachments} disabled={loading} />
          <div className="flex flex-wrap gap-1.5">
            {(messages.length ? ["Make the sessions shorter", "Detail today's exercises", "Add warm-up guidance", "Change the weekly schedule"] : ["Make it 4 days a week", "Shorter sessions, 45 minutes", "More upper-body focus", "I'm traveling — no gym this week"]).map((s) => (
              <button key={s} onClick={() => setText(s)} className="rounded-full border border-line px-3 py-1 text-[12px] text-ink-soft hover:border-line-strong">
                {s}
              </button>
            ))}
          </div>
          <Button className="w-full" onClick={ask} loading={loading} disabled={text.trim().length < 3 && !attachments.length}>
            <Sparkles className="size-4" /> {messages.length ? "Continue with coach" : "Build split"}
          </Button>
        {result && (
          <div className="border-t border-line pt-4">
          <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-muted">Current split preview</p>
          <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
            {result.split.days.map((d, i) => (
              <li key={d.id} className="flex gap-3 px-4 py-2.5 text-[13px]">
                <span className="w-9 font-medium uppercase text-muted">{result.split.rotation ? `D${i + 1}` : WEEKDAYS[i]?.slice(0, 3)}</span>
                <span className="flex-1">{d.isRest ? <span className="text-muted">Rest</span> : <><span className="font-medium">{d.name}</span> <span className="text-muted">· {d.exercises.map((e) => e.name).join(", ")}</span></>}</span>
              </li>
            ))}
          </ul>
          {result.engine === "offline" && <p className="mt-2 text-[12px] text-muted">Built with the offline planner. Add an OpenAI key for fully custom revisions.</p>}
          <div className="mt-4 flex gap-2">
            <Button variant="secondary" onClick={() => setText("Help me dig deeper into today's exercises")}>
              Dig deeper
            </Button>
            <Button
              className="flex-1"
              loading={applying}
              disabled={applying}
              onClick={() => {
                setApplying(true);
                void Promise.resolve(onApply(result.split))
                  .then(() => {
                    onClose();
                    setResult(null);
                  })
                  .catch((e) => toast(e instanceof Error ? e.message : "Couldn't save the plan", "error"))
                  .finally(() => setApplying(false));
              }}
            >
              Use this split
            </Button>
          </div>
          </div>
        )}
      </div>
    </Sheet>
  );
}
