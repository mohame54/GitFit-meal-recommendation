import type { SpoonacularNutrient, SpoonacularRecipe } from "../lib/spoonacular.js";

export type NormalizedRecipe = {
  external_id: string;
  source_api: "spoonacular";
  title: string;
  image_url: string | null;
  ready_in_minutes: number | null;
  servings: number | null;
  calories: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  vegan: boolean;
  vegetarian: boolean;
  gluten_free: boolean;
  dairy_free: boolean;
  attributes: Array<{ attribute_type: string; attribute_value: string }>;
  ingredients: Array<{ name: string; amount: string | null }>;
  categoryLinks: Array<{ type: string; name: string }>;
};

function nutrientAmount(
  nutrients: SpoonacularNutrient[] | undefined,
  name: string,
): number | null {
  if (!nutrients) return null;
  const hit = nutrients.find((n) => n.name.toLowerCase() === name.toLowerCase());
  return hit ? Number(hit.amount) : null;
}

function prepTimeBucket(minutes: number | null | undefined): string | null {
  if (minutes == null || Number.isNaN(minutes)) return null;
  if (minutes <= 20) return "quick";
  if (minutes <= 45) return "medium";
  return "long";
}

function normalizeToken(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function mapDishTypeToMealType(dishType: string): string | null {
  const t = dishType.toLowerCase();
  if (t.includes("breakfast")) return "breakfast";
  if (t.includes("lunch") || t.includes("salad") || t.includes("soup")) return "lunch";
  if (
    t.includes("dinner") ||
    t.includes("main") ||
    t.includes("side") ||
    t.includes("entree")
  ) {
    return "dinner";
  }
  if (t.includes("dessert") || t.includes("snack") || t.includes("appetizer")) {
    return t.includes("dessert") ? "dessert" : "snack";
  }
  return null;
}

/**
 * Map a Spoonacular recipe payload into our relational shape.
 * Pure / side-effect free — easy to unit test.
 */
export function normalizeSpoonacularRecipe(raw: SpoonacularRecipe): NormalizedRecipe {
  const nutrients = raw.nutrition?.nutrients;
  const attributes: NormalizedRecipe["attributes"] = [];
  const categoryLinks: NormalizedRecipe["categoryLinks"] = [];
  const seenAttr = new Set<string>();

  const pushAttr = (type: string, value: string) => {
    const v = normalizeToken(value);
    if (!v) return;
    const key = `${type}:${v}`;
    if (seenAttr.has(key)) return;
    seenAttr.add(key);
    attributes.push({ attribute_type: type, attribute_value: v });
  };

  for (const cuisine of raw.cuisines ?? []) {
    pushAttr("cuisine", cuisine);
    categoryLinks.push({ type: "cuisine", name: normalizeToken(cuisine) });
  }

  for (const dish of raw.dishTypes ?? []) {
    const meal = mapDishTypeToMealType(dish);
    if (meal) pushAttr("meal_type", meal);
    categoryLinks.push({ type: "meal_type", name: normalizeToken(dish) });
  }

  for (const diet of raw.diets ?? []) {
    const name = normalizeToken(diet);
    pushAttr("diet", name);
    categoryLinks.push({ type: "diet", name });
  }

  if (raw.vegan) {
    pushAttr("diet", "vegan");
    categoryLinks.push({ type: "diet", name: "vegan" });
  }
  if (raw.vegetarian) {
    pushAttr("diet", "vegetarian");
    categoryLinks.push({ type: "diet", name: "vegetarian" });
  }
  if (raw.glutenFree) {
    pushAttr("diet", "gluten_free");
    categoryLinks.push({ type: "diet", name: "gluten_free" });
  }
  if (raw.dairyFree) {
    pushAttr("diet", "dairy_free");
    categoryLinks.push({ type: "diet", name: "dairy_free" });
  }

  const prep = prepTimeBucket(raw.readyInMinutes);
  if (prep) pushAttr("prep_time", prep);

  for (const ing of raw.extendedIngredients ?? []) {
    if (ing.name) pushAttr("ingredient", ing.name);
  }

  const ingredients = (raw.extendedIngredients ?? [])
    .filter((ing) => ing.name?.trim())
    .map((ing) => ({
      name: ing.name.trim().toLowerCase(),
      amount:
        ing.original?.trim() ||
        (ing.amount != null
          ? `${ing.amount}${ing.unit ? ` ${ing.unit}` : ""}`.trim()
          : null),
    }));

  // Dedupe ingredients by name (keep first amount)
  const ingredientMap = new Map<string, { name: string; amount: string | null }>();
  for (const ing of ingredients) {
    if (!ingredientMap.has(ing.name)) ingredientMap.set(ing.name, ing);
  }

  return {
    external_id: String(raw.id),
    source_api: "spoonacular",
    title: raw.title,
    image_url: raw.image ?? null,
    ready_in_minutes: raw.readyInMinutes ?? null,
    servings: raw.servings ?? null,
    calories: nutrientAmount(nutrients, "Calories"),
    protein_g: nutrientAmount(nutrients, "Protein"),
    carbs_g: nutrientAmount(nutrients, "Carbohydrates"),
    fat_g: nutrientAmount(nutrients, "Fat"),
    vegan: Boolean(raw.vegan),
    vegetarian: Boolean(raw.vegetarian),
    gluten_free: Boolean(raw.glutenFree),
    dairy_free: Boolean(raw.dairyFree),
    attributes,
    ingredients: [...ingredientMap.values()],
    categoryLinks,
  };
}
