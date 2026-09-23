export interface Recipe {
  id: string;
  external_id: string | null;
  source_api: string;
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
}

export interface RecipeAttribute {
  attribute_type: string;
  attribute_value: string;
}

export interface UserPreference {
  preference_type: string;
  value: string;
  weight: number;
}

export interface UserConstraint {
  id?: string;
  constraint_type: "allergy" | "diet" | "excluded_ingredient";
  value: string;
}

export interface Profile {
  id: string;
  display_name: string;
  email: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ScoredRecipe {
  recipe: Recipe;
  score: number;
}

export interface FeedbackInput {
  userId: string;
  recipeId: string;
  rating?: number;
  liked?: boolean;
  comment?: string;
}

export interface ExtractedFeedbackAttribute {
  preference_type: string;
  value: string;
  polarity: -1 | 0 | 1;
}

export interface ExtractedFeedback {
  sentiment: "positive" | "negative" | "mixed" | "neutral";
  attributes: ExtractedFeedbackAttribute[];
}

export interface GeneratedRecipePayload {
  title: string;
  ingredients: Array<{ name: string; amount?: string }>;
  steps: string[];
  tags: Array<{ type: string; value: string }>;
  calories?: number | null;
  ready_in_minutes?: number | null;
  servings?: number | null;
}

export interface GeneratedRecipeRecord extends GeneratedRecipePayload {
  id: string;
  user_id: string;
  is_valid: boolean;
  created_at: string;
}

export interface RecommendationHistoryItem {
  id: string;
  recipe_id: string;
  context: string;
  score: number;
  shown_at: string;
  recipe?: Recipe | null;
}

export interface FeedbackHistoryItem {
  id: string;
  recipe_id: string;
  rating: number | null;
  liked: boolean | null;
  comment: string | null;
  created_at: string;
}
