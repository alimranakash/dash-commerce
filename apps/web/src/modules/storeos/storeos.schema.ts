import { z } from "zod";

export const storeOSChatSchema = z.object({
  message: z.string().trim().min(1, "Message is required.").max(1000)
});

export type StoreOSChatInput = z.infer<typeof storeOSChatSchema>;
