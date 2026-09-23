import { z } from "@hono/zod-openapi";

export const ProfileSchema = z
  .object({
    id: z.string().uuid(),
    display_name: z.string(),
    email: z.string().email().nullable(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .openapi("Profile");

export const CreateProfileBodySchema = z
  .object({
    displayName: z.string().trim().min(1),
    email: z.string().email().optional(),
  })
  .openapi("CreateProfileBody");

export const UpdateProfileBodySchema = z
  .object({
    displayName: z.string().trim().min(1).optional(),
    email: z.string().email().nullable().optional(),
  })
  .openapi("UpdateProfileBody");

export const UserIdParamSchema = z.object({
  userId: z.string().uuid(),
});

export type CreateProfileBody = z.infer<typeof CreateProfileBodySchema>;
export type UpdateProfileBody = z.infer<typeof UpdateProfileBodySchema>;
export type ProfileResponse = z.infer<typeof ProfileSchema>;
