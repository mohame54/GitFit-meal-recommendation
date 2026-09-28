import { z } from "zod";
import { conversationStateService } from "../../services/conversation.js";
import { updateProfile } from "../../services/profiles.js";
import { BaseTool } from "./base-tool.js";

const inputSchema = z
  .object({
    // Boolean, not z.literal(true): Gemini enum values must be strings,
    // and a boolean literal is sent as enum: [true].
    confirmed: z
      .boolean()
      .describe("Must be true; only set after explicit user confirmation"),
    displayName: z.string().trim().min(1).optional(),
    email: z.string().email().nullable().optional(),
  })
  .refine((v) => v.displayName !== undefined || v.email !== undefined, {
    message: "At least one of displayName or email is required",
  });

const outputSchema = z.object({
  display_name: z.string(),
  email: z.string().nullable(),
});

export const updateProfileTool = new BaseTool({
  id: "update-profile",
  description:
    "Update the signed-in user's profile (display name and/or email). " +
    "MUST only be called after the user explicitly confirms the exact proposed changes " +
    "in the latest conversation turn. Set confirmed to true only when that confirmation " +
    "is present. Do not invent fields beyond displayName and email.",
  inputSchema,
  outputSchema,
  run: async ({ confirmed, displayName, email }, actor) => {
    if (confirmed !== true) {
      throw new Error("Profile update requires confirmed: true");
    }
    const profile = await updateProfile(actor.userId, { displayName, email });
    conversationStateService.ensureSession({
      sessionId: actor.sessionId,
      userId: actor.userId,
      authUserId: actor.authUserId,
      displayName: profile.display_name,
    });
    return {
      display_name: profile.display_name,
      email: profile.email,
    };
  },
}).tool;
