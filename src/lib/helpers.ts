import { z } from "@hono/zod-openapi";
import type { ZodType } from "zod";

export const jsonContent = <T extends ZodType>(schema: T, description: string) => ({
  content: {
    "application/json": {
      schema,
    },
  },
  description,
});

export const jsonContentRequired = <T extends ZodType>(schema: T, description: string) => ({
  content: {
    "application/json": {
      schema,
    },
  },
  description,
  required: true,
});

export const ErrorResponseBodySchema = z
  .object({
    error: z.string(),
  })
  .openapi("ErrorResponseBody");
