import { z } from "zod";

export const signupInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  phone: z.string().trim().min(3).max(30).optional(),
  password: z.string().min(8).max(128),
  currency: z.string().trim().toUpperCase().length(3).default("NPR"),
  otpEnabled: z.boolean().default(false),
});

export const loginInput = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()),
  password: z.string().min(1).max(128),
  deviceLabel: z.string().trim().max(100).optional(),
});
