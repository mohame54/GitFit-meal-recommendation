import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { updateProfile } from "../../services/profiles.js";

export const updateProfileTool = createTool({
  id: "update-profile",
  description:
    "Update the user's profile (display name and/or email). " +
    "MUST only be called after the user explicitly confirms the exact proposed changes " +
    "in the latest conversation turn. Set confirmed to true only when that confirmation " +
    "is present. Do not invent fields beyond displayName and email.",
  inputSchema: z
    .object({
      userId: z.string().uuid().describe("The user's UUID"),
      confirmed: z
        .literal(true)
        .describe("Must be true; only set after explicit user confirmation"),
      displayName: z.string().trim().min(1).optional(),
      email: z.string().email().nullable().optional(),
    })
    .refine(
      (v) => v.displayName !== undefined || v.email !== undefined,
      { message: "At least one of displayName or email is required" },
    ),
  outputSchema: z.object({
    id: z.string().uuid(),
    display_name: z.string(),
    email: z.string().nullable(),
  }),
  execute: async ({ userId, confirmed, displayName, email }) => {
    if (confirmed !== true) {
      throw new Error("Profile update requires confirmed: true");
    }
    const profile = await updateProfile(userId, { displayName, email });
    return {
      id: profile.id,
      display_name: profile.display_name,
      email: profile.email,
    };
  },
});
