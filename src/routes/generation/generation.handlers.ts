import type { ApiRouterHandler } from "../../lib/create-router.js";
import { HttpCodes } from "../../types/https-codes.js";
import {
  MissingUserIdError,
  UserIdMismatchError,
  resolveUserId,
} from "../../middlewares/auth.js";
import {
  generateRecipeForUser,
  listGeneratedRecipes,
} from "../../services/generation.js";
import {
  GenerateRecipeRoute,
  ListGeneratedRecipesRoute,
} from "./generation.routes.js";

export const generateRecipeHandler: ApiRouterHandler<typeof GenerateRecipeRoute> = async (c) => {
  const body = c.req.valid("json");
  try {
    const userId = resolveUserId(c.get("userId"), body.userId);
    const recipe = await generateRecipeForUser({ userId, prompt: body.prompt });
    return c.json(recipe, HttpCodes.CREATED);
  } catch (err) {
    if (err instanceof MissingUserIdError || err instanceof UserIdMismatchError) {
      return c.json({ error: err.message }, HttpCodes.BAD_REQUEST);
    }
    c.var.logger.error({ err }, "Failed to generate recipe");
    return c.json(
      { error: err instanceof Error ? err.message : "Failed to generate recipe" },
      HttpCodes.INTERNAL_SERVER_ERROR,
    );
  }
};

export const listGeneratedRecipesHandler: ApiRouterHandler<
  typeof ListGeneratedRecipesRoute
> = async (c) => {
  const query = c.req.valid("query");
  try {
    const userId = resolveUserId(c.get("userId"), query.userId);
    const recipes = await listGeneratedRecipes(userId, query.limit ?? 20);
    return c.json(recipes, HttpCodes.OK);
  } catch (err) {
    if (err instanceof MissingUserIdError || err instanceof UserIdMismatchError) {
      return c.json({ error: err.message }, HttpCodes.BAD_REQUEST);
    }
    c.var.logger.error({ err }, "Failed to list generated recipes");
    return c.json(
      { error: "Failed to list generated recipes" },
      HttpCodes.INTERNAL_SERVER_ERROR,
    );
  }
};
