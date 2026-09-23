import { z } from "@hono/zod-openapi";

export const RootResponseBodySchema = z
  .object({
    message: z.string(),
  })
  .openapi("RootResponseBody");

export const HealthResponseBodySchema = z
  .object({
    status: z.literal("ok"),
  })
  .openapi("HealthResponseBody");

export type RootResponseBody = z.infer<typeof RootResponseBodySchema>;
export type HealthResponseBody = z.infer<typeof HealthResponseBodySchema>;

export const rootResponseBodyExample: RootResponseBody = {
  message: "Meals personalization engine",
};

export const healthResponseBodyExample: HealthResponseBody = {
  status: "ok",
};
