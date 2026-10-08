import { z } from "zod";

// Shared contact validation only. Email is never proof of conversation ownership.
const guestChatProfileSchema = z.object({
  guestName: z.string({ error: "Enter your name." })
    .trim()
    .min(2, "Name must contain at least 2 characters.")
    .max(120, "Name must not exceed 120 characters.")
    .refine(
      (value) => !Array.from(value).some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127;
      }),
      "Enter a valid name.",
    ),
  guestEmail: z.string({ error: "Enter your contact email." })
    .trim()
    .toLowerCase()
    .min(1, "Enter your contact email.")
    .max(254, "Email must not exceed 254 characters.")
    .pipe(z.email({ error: "Enter a valid email address, such as name@example.com." })),
});

export type GuestChatProfileErrors = Partial<Record<"guestName" | "guestEmail", string>>;
export type GuestChatProfile = z.infer<typeof guestChatProfileSchema>;

export function validateGuestChatProfile(guestName: unknown, guestEmail: unknown) {
  const result = guestChatProfileSchema.safeParse({ guestName, guestEmail });
  if (result.success) return { success: true as const, profile: result.data };

  const errors: GuestChatProfileErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if ((field === "guestName" || field === "guestEmail") && !errors[field]) {
      errors[field] = issue.message;
    }
  }
  return { success: false as const, errors };
}
