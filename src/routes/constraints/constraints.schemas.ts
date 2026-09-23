import { z } from "@hono/zod-openapi";

export const ConstraintSchema = z
  .object({
    id: z.string().uuid().optional(),
    constraint_type: z.enum(["allergy", "diet", "excluded_ingredient"]),
    value: z.string().min(1),
  })
  .openapi("UserConstraint");

export const UpsertConstraintBodySchema = z
  .object({
    userId: z.string().uuid().optional(),
    constraint_type: z.enum(["allergy", "diet", "excluded_ingredient"]),
    value: z.string().trim().min(1),
  })
  .openapi("UpsertConstraintBody");

export const ConstraintsQuerySchema = z.object({
  userId: z.string().uuid().optional(),
});

export const ConstraintIdParamSchema = z.object({
  constraintId: z.string().uuid(),
});

export type UpsertConstraintBody = z.infer<typeof UpsertConstraintBodySchema>;
