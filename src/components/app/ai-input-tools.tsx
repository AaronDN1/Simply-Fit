"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Mic, Square, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type AiAttachment = {
  type: "image" | "audio";
  dataUrl: string;
  name: string;
};

export function AiInputTools({
  attachments,
  onChange,
  disabled,
}: {
  attachments: AiAttachment[];
  onChange: (attachments: AiAttachment[]) => void;
  disabled?: boolean;
}) {
  const imageRef = useRef<HTMLInputElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => recorder.current?.stop(), []);

  async function addImages(files: FileList | null) {
    if (!files) return;
    setError(null);
    const next: AiAttachment[] = [];
    for (const file of Array.from(files).slice(0, 3)) {
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 8 * 1024 * 1024) {
        setError("Images must be 8 MB or smaller.");
        continue;
      }
      next.push({ type: "image", dataUrl: await readDataUrl(file), name: file.name });
    }
    onChange([...attachments, ...next]);
    if (imageRef.current) imageRef.current.value = "";
  }

  async function toggleRecording() {
    setError(null);
    if (recording) {
      recorder.current?.stop();
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Voice recording isn't available in this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const r = new MediaRecorder(stream);
      recorder.current = r;
      chunks.current = [];
      r.ondataavailable = (event) => event.data.size && chunks.current.push(event.data);
      r.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunks.current, { type: r.mimeType || "audio/webm" });
        if (blob.size > 15 * 1024 * 1024) {
          setError("Recordings must be 15 MB or smaller.");
        } else {
          onChange([...attachments, { type: "audio", dataUrl: await readDataUrl(blob), name: "voice-note.webm" }]);
        }
        setRecording(false);
      };
      r.start();
      setRecording(true);
    } catch {
      setError("Microphone access was declined. You can still type or attach a photo.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <input ref={imageRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addImages(e.target.files)} />
      <button
        type="button"
        onClick={() => imageRef.current?.click()}
        disabled={disabled || recording}
        className="grid size-8 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink disabled:opacity-30"
        aria-label="Attach image"
        title="Attach image"
      >
        <ImagePlus className="size-4" />
      </button>
      <button
        type="button"
        onClick={toggleRecording}
        disabled={disabled}
        className={cn("grid size-8 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink disabled:opacity-30", recording && "bg-clay-soft text-clay")}
        aria-label={recording ? "Stop recording" : "Record voice note"}
        title={recording ? "Stop recording" : "Record voice note"}
      >
        {recording ? <Square className="size-3.5" fill="currentColor" /> : <Mic className="size-4" />}
      </button>
      {attachments.map((attachment, index) => (
        <span key={`${attachment.name}-${index}`} className="flex items-center gap-1 rounded-full bg-sunken px-2 py-1 text-[11px] text-muted">
          {attachment.type === "image" ? "Image" : "Voice note"}
          <button type="button" onClick={() => onChange(attachments.filter((_, i) => i !== index))} aria-label={`Remove ${attachment.type}`} className="text-faint hover:text-ink">
            <X className="size-3" />
          </button>
        </span>
      ))}
      {error && <span className="basis-full text-[11px] text-clay">{error}</span>}
    </div>
  );
}

function readDataUrl(value: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Couldn't read that file."));
    reader.readAsDataURL(value);
  });
}
