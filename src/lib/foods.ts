/** Macros per 100 g: [kcal, protein, carbs, fat] */
type Macro = [number, number, number, number];

export interface FoodItem {
  id: string;
  name: string;
  aliases: string[];
  /** Cooked / ready-to-eat values. */
  per100: Macro;
  /** Raw / dry values for foods whose weight changes a lot when cooked. */
  raw?: Macro;
  /** Gram weights for household units. */
  units: Partial<Record<"unit" | "cup" | "tbsp" | "tsp" | "slice" | "scoop" | "serving", number>>;
  /** Default unit when the user gives a bare count ("2 eggs"). */
  countUnit?: "unit" | "slice" | "scoop" | "serving";
  /** Cooking fat / sauces meaningfully change the estimate. */
  prepMatters?: boolean;
  category: "protein" | "carb" | "fat" | "produce" | "dairy" | "condiment" | "drink" | "snack" | "meal";
}

export const FOODS: FoodItem[] = [
  { id: "chicken_breast", name: "Chicken breast", aliases: ["chicken breast", "chicken breasts", "grilled chicken", "chicken"], per100: [165, 31, 0, 3.6], raw: [120, 22.5, 0, 2.6], units: { unit: 170, serving: 120 }, prepMatters: true, category: "protein" },
  { id: "chicken_thigh", name: "Chicken thigh", aliases: ["chicken thigh", "chicken thighs"], per100: [209, 26, 0, 10.9], raw: [144, 19.7, 0, 6.6], units: { unit: 115 }, prepMatters: true, category: "protein" },
  { id: "ground_beef", name: "Ground beef 90/10", aliases: ["ground beef", "beef mince", "lean beef"], per100: [217, 26, 0, 11.7], raw: [176, 20, 0, 10], units: { serving: 113 }, category: "protein" },
  { id: "steak", name: "Sirloin steak", aliases: ["steak", "sirloin", "beef steak", "ribeye"], per100: [206, 30, 0, 9], raw: [160, 21, 0, 8], units: { unit: 225 }, prepMatters: true, category: "protein" },
  { id: "salmon", name: "Salmon", aliases: ["salmon", "salmon fillet"], per100: [206, 22, 0, 12.4], raw: [208, 20, 0, 13], units: { unit: 150 }, prepMatters: true, category: "protein" },
  { id: "tuna_can", name: "Canned tuna (in water)", aliases: ["tuna", "canned tuna"], per100: [116, 25.5, 0, 0.8], units: { unit: 142, serving: 85 }, countUnit: "unit", category: "protein" },
  { id: "shrimp", name: "Shrimp", aliases: ["shrimp", "prawns"], per100: [99, 24, 0.2, 0.3], raw: [85, 20, 0, 0.5], units: { serving: 85 }, prepMatters: true, category: "protein" },
  { id: "turkey_ground", name: "Ground turkey 93/7", aliases: ["ground turkey", "turkey mince", "turkey"], per100: [213, 27, 0, 11.6], raw: [150, 19, 0, 8], units: { serving: 113 }, category: "protein" },
  { id: "tofu", name: "Firm tofu", aliases: ["tofu"], per100: [144, 17.3, 2.8, 8.7], units: { serving: 126 }, prepMatters: true, category: "protein" },
  { id: "egg", name: "Egg", aliases: ["eggs", "egg", "fried egg", "scrambled eggs", "boiled egg"], per100: [143, 12.6, 0.7, 9.5], units: { unit: 50 }, countUnit: "unit", prepMatters: true, category: "protein" },
  { id: "egg_white", name: "Egg whites", aliases: ["egg whites", "egg white"], per100: [52, 10.9, 0.7, 0.2], units: { unit: 33, cup: 243 }, countUnit: "unit", category: "protein" },
  { id: "whey", name: "Whey protein", aliases: ["protein shake", "whey", "protein powder", "scoop of protein", "scoops of protein", "scoop protein"], per100: [400, 80, 10, 5], units: { scoop: 30 }, countUnit: "scoop", category: "protein" },
  { id: "greek_yogurt", name: "Greek yogurt (nonfat)", aliases: ["greek yogurt", "greek yoghurt", "yogurt", "yoghurt"], per100: [59, 10.3, 3.6, 0.4], units: { cup: 245, unit: 170 }, countUnit: "unit", category: "dairy" },
  { id: "cottage_cheese", name: "Cottage cheese (2%)", aliases: ["cottage cheese"], per100: [84, 11, 4.3, 2.3], units: { cup: 226 }, category: "dairy" },
  { id: "milk", name: "Milk (2%)", aliases: ["milk"], per100: [50, 3.3, 4.8, 2], units: { cup: 244 }, countUnit: "serving", category: "dairy" },
  { id: "cheese", name: "Cheddar cheese", aliases: ["cheese", "cheddar"], per100: [403, 23, 3.1, 33], units: { slice: 21, cup: 113 }, countUnit: "slice", category: "dairy" },
  { id: "white_rice", name: "White rice", aliases: ["white rice", "jasmine rice", "basmati rice", "rice"], per100: [130, 2.7, 28.2, 0.3], raw: [365, 7.1, 80, 0.7], units: { cup: 158 }, category: "carb" },
  { id: "brown_rice", name: "Brown rice", aliases: ["brown rice"], per100: [123, 2.7, 25.6, 1], raw: [370, 7.9, 77, 2.9], units: { cup: 195 }, category: "carb" },
  { id: "pasta", name: "Pasta", aliases: ["pasta", "spaghetti", "penne", "noodles"], per100: [158, 5.8, 30.9, 0.9], raw: [371, 13, 75, 1.5], units: { cup: 140 }, category: "carb" },
  { id: "oats", name: "Rolled oats", aliases: ["oats", "oatmeal", "rolled oats", "porridge"], per100: [71, 2.5, 12, 1.5], raw: [389, 16.9, 66, 6.9], units: { cup: 81 }, category: "carb" },
  { id: "potato", name: "Potato", aliases: ["potato", "potatoes", "baked potato"], per100: [93, 2.5, 21, 0.1], units: { unit: 170 }, countUnit: "unit", prepMatters: true, category: "carb" },
  { id: "sweet_potato", name: "Sweet potato", aliases: ["sweet potato", "sweet potatoes"], per100: [90, 2, 20.7, 0.2], units: { unit: 150 }, countUnit: "unit", prepMatters: true, category: "carb" },
  { id: "bread", name: "Whole wheat bread", aliases: ["toast", "bread", "slice of bread", "slices of bread"], per100: [247, 13, 41, 3.4], units: { slice: 32 }, countUnit: "slice", category: "carb" },
  { id: "bagel", name: "Bagel", aliases: ["bagel", "bagels"], per100: [257, 10, 50, 1.6], units: { unit: 105 }, countUnit: "unit", category: "carb" },
  { id: "tortilla", name: "Flour tortilla", aliases: ["tortilla", "tortillas", "wrap", "wraps"], per100: [306, 8, 51, 8], units: { unit: 45 }, countUnit: "unit", category: "carb" },
  { id: "cereal", name: "Breakfast cereal", aliases: ["cereal", "cheerios", "corn flakes"], per100: [375, 8, 80, 3], units: { cup: 30 }, countUnit: "serving", category: "carb" },
  { id: "granola", name: "Granola", aliases: ["granola"], per100: [471, 10, 64, 20], units: { cup: 122 }, category: "carb" },
  { id: "black_beans", name: "Black beans", aliases: ["black beans", "beans"], per100: [132, 8.9, 23.7, 0.5], units: { cup: 172 }, category: "carb" },
  { id: "banana", name: "Banana", aliases: ["banana", "bananas"], per100: [89, 1.1, 22.8, 0.3], units: { unit: 118 }, countUnit: "unit", category: "produce" },
  { id: "apple", name: "Apple", aliases: ["apple", "apples"], per100: [52, 0.3, 13.8, 0.2], units: { unit: 182 }, countUnit: "unit", category: "produce" },
  { id: "orange", name: "Orange", aliases: ["orange", "oranges"], per100: [47, 0.9, 11.8, 0.1], units: { unit: 131 }, countUnit: "unit", category: "produce" },
  { id: "berries", name: "Mixed berries", aliases: ["berries", "blueberries", "strawberries", "raspberries"], per100: [50, 0.8, 12, 0.3], units: { cup: 148 }, category: "produce" },
  { id: "broccoli", name: "Broccoli", aliases: ["broccoli"], per100: [35, 2.4, 7.2, 0.4], units: { cup: 156 }, prepMatters: true, category: "produce" },
  { id: "salad", name: "Mixed greens", aliases: ["salad", "mixed greens", "spinach", "lettuce", "greens"], per100: [20, 1.8, 3.5, 0.3], units: { cup: 40 }, category: "produce" },
  { id: "mixed_veg", name: "Mixed vegetables", aliases: ["vegetables", "veggies", "mixed veg", "mixed vegetables"], per100: [65, 2.9, 13, 0.5], units: { cup: 182 }, prepMatters: true, category: "produce" },
  { id: "avocado", name: "Avocado", aliases: ["avocado", "avocados"], per100: [160, 2, 8.5, 14.7], units: { unit: 150 }, countUnit: "unit", category: "fat" },
  { id: "olive_oil", name: "Olive oil", aliases: ["olive oil", "oil", "cooking oil", "vegetable oil", "avocado oil"], per100: [884, 0, 0, 100], units: { tbsp: 13.5, tsp: 4.5 }, category: "fat" },
  { id: "butter", name: "Butter", aliases: ["butter"], per100: [717, 0.9, 0.1, 81], units: { tbsp: 14, tsp: 4.7 }, category: "fat" },
  { id: "peanut_butter", name: "Peanut butter", aliases: ["peanut butter", "pb"], per100: [588, 25, 20, 50], units: { tbsp: 16, tsp: 5.3 }, category: "fat" },
  { id: "almonds", name: "Almonds", aliases: ["almonds", "nuts"], per100: [579, 21, 21.6, 49.9], units: { cup: 143, serving: 28 }, category: "fat" },
  { id: "hummus", name: "Hummus", aliases: ["hummus"], per100: [166, 7.9, 14.3, 9.6], units: { tbsp: 15 }, category: "condiment" },
  { id: "mayo", name: "Mayonnaise", aliases: ["mayo", "mayonnaise"], per100: [680, 1, 0.6, 75], units: { tbsp: 13.8, tsp: 4.6 }, category: "condiment" },
  { id: "ketchup", name: "Ketchup", aliases: ["ketchup"], per100: [101, 1, 27, 0.1], units: { tbsp: 17 }, category: "condiment" },
  { id: "bbq_sauce", name: "BBQ sauce", aliases: ["bbq sauce", "barbecue sauce"], per100: [172, 0.8, 41, 0.6], units: { tbsp: 17 }, category: "condiment" },
  { id: "soy_sauce", name: "Soy sauce", aliases: ["soy sauce"], per100: [53, 8, 4.9, 0.6], units: { tbsp: 16 }, category: "condiment" },
  { id: "ranch", name: "Ranch dressing", aliases: ["ranch", "dressing"], per100: [430, 1, 6, 44], units: { tbsp: 15 }, category: "condiment" },
  { id: "honey", name: "Honey", aliases: ["honey"], per100: [304, 0.3, 82, 0], units: { tbsp: 21, tsp: 7 }, category: "condiment" },
  { id: "pizza", name: "Pizza (slice)", aliases: ["pizza", "slice of pizza", "slices of pizza"], per100: [266, 11, 33, 10], units: { slice: 107 }, countUnit: "slice", category: "meal" },
  { id: "burrito", name: "Burrito", aliases: ["burrito"], per100: [190, 8.5, 22, 7.5], units: { unit: 400 }, countUnit: "unit", category: "meal" },
  { id: "protein_bar", name: "Protein bar", aliases: ["protein bar", "bar"], per100: [350, 33, 38, 11], units: { unit: 60 }, countUnit: "unit", category: "snack" },
  { id: "dark_chocolate", name: "Dark chocolate", aliases: ["chocolate", "dark chocolate"], per100: [546, 4.9, 61, 31], units: { serving: 28 }, category: "snack" },
  { id: "coffee_latte", name: "Latte", aliases: ["latte", "cappuccino"], per100: [56, 3.4, 5.5, 2.2], units: { unit: 360 }, countUnit: "unit", category: "drink" },
  { id: "orange_juice", name: "Orange juice", aliases: ["orange juice", "oj", "juice"], per100: [45, 0.7, 10.4, 0.2], units: { cup: 248 }, category: "drink" },
];

const SORTED_ALIASES = FOODS.flatMap((f) => f.aliases.map((a) => ({ alias: a, food: f }))).sort(
  (a, b) => b.alias.length - a.alias.length
);

export function searchFoods(q: string, limit = 8) {
  const s = q.trim().toLowerCase();
  if (!s) return FOODS.slice(0, limit);
  return FOODS.filter((f) => f.name.toLowerCase().includes(s) || f.aliases.some((a) => a.includes(s))).slice(0, limit);
}

export function macrosFor(food: FoodItem, grams: number, state: "cooked" | "raw" = "cooked") {
  const m = state === "raw" && food.raw ? food.raw : food.per100;
  const k = grams / 100;
  return {
    calories: Math.round(m[0] * k),
    proteinG: Math.round(m[1] * k * 10) / 10,
    carbsG: Math.round(m[2] * k * 10) / 10,
    fatG: Math.round(m[3] * k * 10) / 10,
  };
}

/* ------------------------------------------------------------------ */
/* Offline natural-language estimator                                  */
/* ------------------------------------------------------------------ */

export interface EstimateItem {
  name: string;
  quantity: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface EstimateResult {
  status: "needs_info" | "ready" | "unknown";
  reply: string;
  mealName?: string;
  items: EstimateItem[];
  meal: "breakfast" | "lunch" | "dinner" | "snack" | null;
}

const WORD_NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, half: 0.5, "a half": 0.5, couple: 2, "a couple": 2 };

const UNIT_RE =
  "(g|grams?|gr|kg|oz|ounces?|lbs?|pounds?|cups?|tbsps?|tablespoons?|tsps?|teaspoons?|slices?|scoops?|pieces?|servings?|ml|large|medium|small|whole)";
const NUM_QTY_RE = new RegExp(`\\b(\\d+\\/\\d+|\\d+(?:\\.\\d+)?)\\s*(?:${UNIT_RE}\\b)?`, "i");
const WORD_QTY_RE = new RegExp(`\\b(a couple|a half|half|an?|one|two|three|four|five|six|couple)\\s+(?:${UNIT_RE}\\b)?`, "i");

function matchQty(text: string) {
  return text.match(NUM_QTY_RE) ?? text.match(WORD_QTY_RE);
}

type UnitKey = "g" | "unit" | "cup" | "tbsp" | "tsp" | "slice" | "scoop" | "serving" | "ml";

function normalizeUnit(u?: string): { key: UnitKey; factor: number } | null {
  if (!u) return null;
  const s = u.toLowerCase();
  if (/^(g|grams?|gr)$/.test(s)) return { key: "g", factor: 1 };
  if (s === "kg") return { key: "g", factor: 1000 };
  if (/^(oz|ounces?)$/.test(s)) return { key: "g", factor: 28.3495 };
  if (/^(lbs?|pounds?)$/.test(s)) return { key: "g", factor: 453.592 };
  if (s === "ml") return { key: "ml", factor: 1 };
  if (/^cups?$/.test(s)) return { key: "cup", factor: 1 };
  if (/^(tbsps?|tablespoons?)$/.test(s)) return { key: "tbsp", factor: 1 };
  if (/^(tsps?|teaspoons?)$/.test(s)) return { key: "tsp", factor: 1 };
  if (/^slices?$/.test(s)) return { key: "slice", factor: 1 };
  if (/^scoops?$/.test(s)) return { key: "scoop", factor: 1 };
  if (/^servings?$/.test(s)) return { key: "serving", factor: 1 };
  if (/^(pieces?|large|medium|small|whole)$/.test(s)) return { key: "unit", factor: s === "large" ? 1.15 : s === "small" ? 0.8 : 1 };
  return null;
}

function parseNumber(s: string) {
  const t = s.toLowerCase();
  if (t in WORD_NUM) return WORD_NUM[t];
  if (t.includes("/")) {
    const [a, b] = t.split("/").map(Number);
    return b ? a / b : NaN;
  }
  return Number(t);
}

interface ParsedChunk {
  food: FoodItem | null;
  raw: string;
  grams: number | null;
  qtyLabel: string;
  weighed: boolean;
  state: "cooked" | "raw" | null;
}

function findFood(text: string) {
  const t = ` ${text.toLowerCase()} `;
  for (const { alias, food } of SORTED_ALIASES) {
    const re = new RegExp(`[^a-z]${alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z]`);
    if (re.test(t)) return food;
  }
  return null;
}

function detectState(text: string): "cooked" | "raw" | null {
  const t = text.toLowerCase();
  if (/\b(uncooked|raw|dry|dried)\b/.test(t)) return "raw";
  if (/\b(cooked|grilled|baked|roasted|boiled|steamed|fried|seared|air[- ]?fried|after cooking)\b/.test(t)) return "cooked";
  return null;
}

function quantityFor(food: FoodItem | null, chunk: string) {
  const m = matchQty(chunk);
  let grams: number | null = null;
  let qtyLabel = "";
  let weighed = false;
  if (m) {
    const n = parseNumber(m[1]);
    const unit = normalizeUnit(m[2]);
    const num = Number.isInteger(n) ? String(n) : n === 0.5 ? "½" : String(Math.round(n * 100) / 100);
    if (!Number.isNaN(n) && n > 0) {
      if (unit?.key === "g") {
        grams = n * unit.factor;
        weighed = true;
        qtyLabel = `${num} ${m[2]}`;
      } else if (unit?.key === "ml") {
        grams = n;
        qtyLabel = `${num} ml`;
      } else if (food) {
        const key = unit ? unit.key : food.countUnit ?? "unit";
        const per = food.units[key as keyof FoodItem["units"]] ?? food.units.unit ?? food.units.serving;
        if (per) {
          grams = n * per * (unit?.factor ?? 1);
          const unitWord = unit ? m[2].toLowerCase() : key === "unit" ? "" : key;
          const plural = n > 1 && ["slice", "scoop", "serving", "cup"].includes(unitWord) ? "s" : "";
          qtyLabel = `${num}${unitWord ? ` ${unitWord}${plural}` : ""}`;
        }
      }
    }
  }
  return { grams, qtyLabel, weighed };
}

function parseChunk(chunk: string): ParsedChunk {
  const food = findFood(chunk);
  return { food, raw: chunk.trim(), ...quantityFor(food, chunk), state: detectState(chunk) };
}

function splitChunks(text: string) {
  return text
    .replace(/\b(for|at)\s+(breakfast|lunch|dinner|a snack|snack)\b/gi, " ")
    .split(/,|;|\+|\band\b|\bwith\b|\bplus\b|\balso\b|\n/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function detectMeal(text: string): EstimateResult["meal"] {
  const t = text.toLowerCase();
  if (/\bbreakfast\b/.test(t)) return "breakfast";
  if (/\blunch\b/.test(t)) return "lunch";
  if (/\bdinner|supper\b/.test(t)) return "dinner";
  if (/\bsnack\b/.test(t)) return "snack";
  return null;
}

export function mealForTime(d = new Date()): "breakfast" | "lunch" | "dinner" | "snack" {
  const h = d.getHours();
  if (h < 11) return "breakfast";
  if (h < 15) return "lunch";
  if (h < 17) return "snack";
  if (h < 21) return "dinner";
  return "snack";
}

const PREP_ANSWERED = /\b(no oil|without oil|no butter|plain|dry|nothing|none|no sauce|nope|no\b|air[- ]?fried|boiled|steamed|poached|grilled|baked|roasted|oil|butter|sauce|dressing)\b/i;

/**
 * Deterministic estimator used when no AI key is configured. It reads the whole
 * conversation, asks at most one bundled follow-up per turn, and only returns
 * numbers when every item has a quantity and a known cooked/raw state.
 */
export function estimateFromConversation(messages: { role: "user" | "assistant"; content: string }[]): EstimateResult {
  const userMsgs = messages.filter((m) => m.role === "user").map((m) => m.content);
  if (!userMsgs.length) return { status: "needs_info", reply: "What did you eat?", items: [], meal: null };

  const items: ParsedChunk[] = [];
  const unknown: string[] = [];
  userMsgs.forEach((msg, i) => {
    for (const chunk of splitChunks(msg)) {
      const p = parseChunk(chunk);
      if (!p.food) {
        const waiting = items.find((x) => !x.grams);
        if (i > 0 && waiting) {
          const q = quantityFor(waiting.food, chunk);
          if (q.grams) Object.assign(waiting, q, { state: waiting.state ?? p.state });
          continue;
        }
        if (i === 0 && /[a-z]{3,}/i.test(chunk) && !/^(i|i had|had|ate|i ate|just)$/i.test(chunk)) unknown.push(chunk);
        continue;
      }
      if (!p.grams && /\b(no|without|zero|hold the)\b/i.test(chunk)) continue;
      const existing = items.find((x) => x.food?.id === p.food!.id);
      if (existing && !p.grams) {
        if (p.state) existing.state = p.state;
        continue;
      }
      if (i > 0 && !p.grams && existing === undefined && p.food.category !== "fat" && p.food.category !== "condiment") continue;
      items.push(p);
    }
  });

  const followUps = userMsgs.slice(1).join(" ");
  const globalState = detectState(followUps);
  for (const it of items) if (!it.state && globalState) it.state = globalState;

  const meal = detectMeal(userMsgs.join(" "));

  if (!items.length) {
    return {
      status: "unknown",
      reply:
        "I couldn't match that to foods I know well enough to estimate. Try describing it with amounts (e.g. “2 eggs and a slice of toast”), or use manual entry if you know the calories.",
      items: [],
      meal,
    };
  }

  const questions: string[] = [];
  const missingQty = items.filter((it) => !it.grams);
  if (missingQty.length) questions.push(`About how much ${listNames(missingQty)}? Grams, ounces, or cups all work.`);

  const needsState = items.filter((it) => it.weighed && it.food?.raw && !it.state);
  if (needsState.length) questions.push(`${needsState.length > 1 ? "Were" : "Was"} the ${listNames(needsState)} weighed cooked or uncooked?`);

  const prepItems = items.filter((it) => it.food?.prepMatters);
  const allText = userMsgs.join(" ");
  if (prepItems.length && !PREP_ANSWERED.test(allText) && userMsgs.length < 3)
    questions.push(`Any oil, butter, or sauce on the ${listNames(prepItems)}?`);

  if (questions.length) {
    return { status: "needs_info", reply: questions.slice(0, 2).join(" "), items: [], meal };
  }

  const out: EstimateItem[] = items.map((it) => {
    const state = it.state === "raw" ? "raw" : "cooked";
    const m = macrosFor(it.food!, it.grams!, state);
    const label = it.weighed ? `${it.qtyLabel}${it.food!.raw ? (state === "raw" ? " (uncooked)" : " (cooked)") : ""}` : it.qtyLabel || `${Math.round(it.grams!)} g`;
    return { name: it.food!.name, quantity: label, ...m };
  });

  const total = out.reduce((s, x) => s + x.calories, 0);
  let reply = `Here's my estimate — about ${total} calories. Review it and log when it looks right.`;
  if (unknown.length) reply += ` I left out “${unknown.slice(0, 2).join("”, “")}” since I couldn't estimate it reliably — you can add it manually.`;
  return { status: "ready", reply, items: out, meal };
}

function listNames(items: ParsedChunk[]) {
  const names = Array.from(new Set(items.map((i) => i.food!.name.toLowerCase())));
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}
