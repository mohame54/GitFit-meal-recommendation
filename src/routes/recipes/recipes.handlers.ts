import type { ApiRouterHandler } from "../../lib/create-router.js";
import { HttpCodes } from "../../types/https-codes.js";
import { getRecipe, listRecipes } from "../../services/recipes.js";
import { GetRecipeRoute, ListRecipesRoute } from "./recipes.routes.js";

export const listRecipesHandler: ApiRouterHandler<typeof ListRecipesRoute> = async (c) => {
  const query = c.req.valid("query");
  try {
    const recipes = await listRecipes(query.limit ?? 50, query.offset ?? 0);
    return c.json(recipes, HttpCodes.OK);
  } catch (err) {
    c.var.logger.error({ err }, "Failed to list recipes");
    return c.json({ error: "Failed to list recipes" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
};

export const getRecipeHandler: ApiRouterHandler<typeof GetRecipeRoute> = async (c) => {
  const { recipeId } = c.req.valid("param");
  try {
    const detail = await getRecipe(recipeId);
    if (!detail) {
      return c.json({ error: "Recipe not found" }, HttpCodes.NOT_FOUND);
    }
    return c.json(detail, HttpCodes.OK);
  } catch (err) {
    c.var.logger.error({ err, recipeId }, "Failed to get recipe");
    return c.json({ error: "Failed to get recipe" }, HttpCodes.INTERNAL_SERVER_ERROR);
  }
};
