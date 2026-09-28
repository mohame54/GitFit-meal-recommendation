import { z } from "@hono/zod-openapi";
import type { ZodType } from "zod";
import { HttpCodes } from "../types/https-codes.js";

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

/** Shared OpenAPI responses for JWT / identity failures. */
export const authErrorResponses = {
  [HttpCodes.UNAUTHORIZED]: jsonContent(ErrorResponseBodySchema, "Unauthorized"),
  [HttpCodes.FORBIDDEN]: jsonContent(ErrorResponseBodySchema, "Forbidden"),
} as const;
