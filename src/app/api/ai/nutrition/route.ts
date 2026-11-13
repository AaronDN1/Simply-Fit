import { NextResponse } from "next/server";
import { z } from "zod";
import { SAFETY_PRINCIPLES, clientKey, getOpenAI, modelOptions, prepareAiAttachments, rateLimited } from "@/lib/ai/server";
import { getRequestUser } from "@/lib/supabase/server";
import { estimateFromConversation, type EstimateResult } from "@/lib/foods";

const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(1200) }))
    .min(1)
    .max(16),
  context: z
    .object({
      remainingCalories: z.number().optional(),
      dietaryPreferences: z.array(z.string()).optional(),
      localTime: z.string().optional(),
    })
    .optional(),
  attachments: z
    .array(z.object({ type: z.enum(["image", "audio"]), dataUrl: z.string().max(20_000_000), name: z.string().max(120) }))
    .max(3)
    .optional(),
});

const SYSTEM = `${SAFETY_PRINCIPLES}

Your job: turn what the user says they ate into a calorie and macro estimate they can review before logging.

Rules:
- Ask a concise follow-up ONLY when the answer would change the estimate meaningfully. Bundle questions into one short message (max 2 questions).
- For rice, pasta, oats, grains, and meats given by weight, confirm whether the weight was cooked or uncooked/raw unless it's stated.
- For foods where preparation adds real calories (meats, eggs, potatoes, vegetables, stir-fries, salads), ask about oil, butter, sauces, dressings, or toppings if not mentioned. Don't ask if they said "grilled", "plain", "no oil", etc. Ask at most once.
- If a portion is missing, ask for an approximate amount (grams, ounces, cups, or a comparison like "a fist-sized portion"). For restaurant or packaged items, use typical published values and say so in the reply.
- Only return status "ready" when you're reasonably confident. Use standard USDA-style values. Round calories to whole numbers and macros to 1 decimal.
- Split the meal into separate items (e.g. rice, chicken, olive oil). Put the amount and cooked/raw state in "quantity", e.g. "150 g cooked".
- "meal" is breakfast, lunch, dinner, or snack if the user said so; otherwise null.
- If the message isn't about food the user ate, use status "not_food" and briefly say you can help log meals.
- If the user shares a photo, identify the foods and estimate portions from visual cues (plate size, utensils, hands). Treat what they say as more reliable than the photo. Ask about hidden calories (oil, butter, dressing) the photo can't show.
- Keep "reply" to 1–2 short sentences. When ready, briefly mention any assumptions. No lectures, no judgment.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["status", "reply", "meal", "items"],
  properties: {
    status: { type: "string", enum: ["needs_info", "ready", "unknown", "not_food"] },
    reply: { type: "string" },
    meal: { type: ["string", "null"], enum: ["breakfast", "lunch", "dinner", "snack", null] },
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "quantity", "calories", "proteinG", "carbsG", "fatG"],
        properties: {
          name: { type: "string" },
          quantity: { type: "string" },
          calories: { type: "number" },
          proteinG: { type: "number" },
          carbsG: { type: "number" },
          fatG: { type: "number" },
        },
      },
    },
  },
} as const;

const AiResult = z.object({
  status: z.enum(["needs_info", "ready", "unknown", "not_food"]),
  reply: z.string(),
  meal: z.enum(["breakfast", "lunch", "dinner", "snack"]).nullable(),
  items: z.array(
    z.object({
      name: z.string(),
      quantity: z.string(),
      calories: z.number().min(0).max(5000),
      proteinG: z.number().min(0).max(500),
      carbsG: z.number().min(0).max(1000),
      fatG: z.number().min(0).max(500),
    })
  ),
});

export async function POST(req: Request) {
  const auth = await getRequestUser(req);
  if (auth.configured && !auth.user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });
  if (rateLimited(clientKey(req, auth.user?.id))) return NextResponse.json({ error: "That's a lot of messages at once — try again in a minute." }, { status: 429 });

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { messages, context, attachments } = parsed.data;

  const openai = getOpenAI();
  if (!openai) {
    const fallback = estimateFromConversation(messages);
    return NextResponse.json({
      ...fallback,
      reply: attachments?.length ? `${fallback.reply} Image and voice review becomes available when an OpenAI key is configured.` : fallback.reply,
      engine: "offline",
    });
  }

  try {
    const prepared = await prepareAiAttachments(openai, attachments, "low");
    const ctx = context
      ? `Context: ${context.remainingCalories != null ? `${Math.round(context.remainingCalories)} kcal remaining today. ` : ""}${context.dietaryPreferences?.length ? `Preferences: ${context.dietaryPreferences.join(", ")}. ` : ""}${context.localTime ? `Local time ${context.localTime}.` : ""}`
      : "";
    const userMessages = messages.map((message, index) => {
      if (index !== messages.length - 1 || (!prepared.images.length && !prepared.transcripts.length)) return message;
      return {
        role: message.role,
        content: [
          { type: "text", text: `${message.content}${prepared.transcripts.length ? `\nVoice note transcript: ${prepared.transcripts.join(" ")}` : ""}` },
          ...prepared.images,
        ],
      };
    });
    const completion = await openai.chat.completions.create({
      ...modelOptions({ maxTokens: 3000, temperature: 0.2 }),
      messages: [{ role: "system", content: `${SYSTEM}\n${ctx}` }, ...userMessages] as never,
      response_format: { type: "json_schema", json_schema: { name: "meal_estimate", strict: true, schema: SCHEMA as unknown as Record<string, unknown> } },
    });
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const result = AiResult.parse(JSON.parse(raw));
    const out: EstimateResult & { engine: string } = {
      status: result.status === "not_food" ? "unknown" : result.status,
      reply: result.reply,
      meal: result.meal,
      items: result.status === "ready" ? result.items.map((i) => ({ ...i, calories: Math.round(i.calories) })) : [],
      engine: "openai",
    };
    return NextResponse.json(out);
  } catch (e) {
    console.error("nutrition ai error", e);
    return NextResponse.json(
      { error: "The AI service could not complete this estimate. Please try again." },
      { status: 502 }
    );
  }
}
