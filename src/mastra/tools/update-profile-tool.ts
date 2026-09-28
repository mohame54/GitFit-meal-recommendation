import { z } from "zod";
import { conversationStateService } from "../../services/conversation.js";
import { updateProfile } from "../../services/profiles.js";
import { BaseTool } from "./base-tool.js";

const inputSchema = z
  .object({
    displayName: z.string().trim().min(1).optional(),
    email: z.string().email().nullable().optional(),
    confirmed: z
      .boolean()
      .describe(
        "True only after the user explicitly confirmed these exact displayName and email values in the latest turn.",
      ),
  })
  .refine((v) => v.displayName !== undefined || v.email !== undefined, {
    message: "At least one of displayName or email is required",
  });

const outputSchema = z.object({
  status: z.string(),
  display_name: z.string().optional(),
  email: z.string().nullable().optional(),
});

const UpdateProfileDesc= `
Update the signed-in user's profile (display name and/or email). 
MUST only be called after the user explicitly confirms the exact proposed changes 
in the latest conversation turn. Set confirmed to true only when that confirmation 
is present. Do not invent fields beyond displayName and email.
`;

class UpdateProfileTool extends BaseTool<typeof inputSchema, typeof outputSchema> {
  readonly id = "update-profile";

  constructor() {
    super({
      description:UpdateProfileDesc,
      inputSchema,
      outputSchema,
      run: async ({ displayName, email, confirmed }, actor) => {
        if (!confirmed) {
          throw new Error("Profile update requires confirmed to be true");
        }
        const result = await updateProfile(actor.userId, { displayName, email });
        if (!result.profile) {
          throw new Error(result.status);
        }
        conversationStateService.ensureSession({
          sessionId: actor.sessionId,
          userId: actor.userId,
          authUserId: actor.authUserId,
          displayName: result.profile.display_name,
        });
        return {
          status: result.status,
          display_name: result.profile.display_name,
          email: result.profile.email,
        };
      },
    });
  }
}

export const updateProfileTool = new UpdateProfileTool().tool;
