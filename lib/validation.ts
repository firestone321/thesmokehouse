import { z } from "zod";

export const statusSchema = z.enum(["new", "confirmed", "in_prep", "on_smoker", "ready", "completed", "cancelled"]);

export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        menu_item_id: z.coerce.number().int().positive(),
        qty: z.number().int().min(1).max(20)
      })
    )
    .min(1)
    .max(50),
  pickup_time: z.enum(["ASAP", "30", "45", "60"]),
  name: z.string().trim().min(2).max(80),
  phone: z
    .string()
    .trim()
    .min(7)
    .max(30)
    .regex(/^[0-9+()\-\s]+$/, "Invalid phone format"),
  notes: z.string().trim().max(300).optional().or(z.literal(""))
});

export function getClientIp(headerValue: string | null): string {
  if (!headerValue) return "unknown";
  return headerValue.split(",")[0]?.trim() || "unknown";
}
