import { z } from "@hono/zod-openapi";

export const IngestByIdsBodySchema = z
  .object({
    ids: z.array(z.number().int().positive()).min(1).max(50),
  })
  .openapi("IngestByIdsBody");

export const IngestRandomBodySchema = z
  .object({
    number: z.number().int().min(1).max(100).optional().default(10),
    tags: z.string().trim().min(1).optional(),
  })
  .openapi("IngestRandomBody");

export const IngestSearchBodySchema = z
  .object({
    query: z.string().trim().min(1).optional(),
    number: z.number().int().min(1).max(100).optional().default(10),
    cuisine: z.string().trim().min(1).optional(),
    diet: z.string().trim().min(1).optional(),
    type: z.string().trim().min(1).optional(),
    intolerances: z.string().trim().min(1).optional(),
  })
  .openapi("IngestSearchBody");

export const IngestResultSchema = z
  .object({
    upserted: z.number(),
    recipeIds: z.array(z.string()),
    externalIds: z.array(z.string()),
  })
  .openapi("IngestResult");
