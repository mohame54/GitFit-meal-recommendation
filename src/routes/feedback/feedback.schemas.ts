import { z } from "@hono/zod-openapi";

export const SubmitFeedbackRequestBodySchema = z
  .object({
    userId: z.string().trim().min(1).optional(),
    recipeId: z.string().trim().min(1),
    rating: z.number().min(1).max(5).optional(),
    liked: z.boolean().optional(),
    comment: z.string().trim().min(1).optional(),
  })
  .openapi("SubmitFeedbackRequestBody");

export const SubmitFeedbackSuccessResponseBodySchema = z
  .object({
    status: z.literal("ok"),
  })
  .openapi("SubmitFeedbackSuccessResponseBody");

export const SubmitFeedbackErrorResponseBodySchema = z.object({
  error: z.string(),
});

export type SubmitFeedbackRequestBody = z.infer<typeof SubmitFeedbackRequestBodySchema>;
export type SubmitFeedbackSuccessResponseBody = z.infer<
  typeof SubmitFeedbackSuccessResponseBodySchema
>;
export type SubmitFeedbackErrorResponseBody = z.infer<
  typeof SubmitFeedbackErrorResponseBodySchema
>;

export const submitFeedbackRequestBodyExample: SubmitFeedbackRequestBody = {
  userId: "00000000-0000-0000-0000-000000000001",
  recipeId: "b1000000-0000-0000-0000-000000000001",
  rating: 4,
  liked: true,
  comment: "I liked the flavor, but it was too spicy.",
};

export const submitFeedbackSuccessResponseBodyExample: SubmitFeedbackSuccessResponseBody = {
  status: "ok",
};
