import { z } from "zod";
import { Role } from "@prisma/client";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const signupSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(7).max(32).optional(),
  password: z.string().min(8),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(7).max(32).optional(),
  password: z.string().min(8),
  role: z.nativeEnum(Role),
});

export const updateUserSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(7).max(32).nullable().optional(),
  role: z.nativeEnum(Role).optional(),
  isFrozen: z.boolean().optional(),
  mfaEnabled: z.boolean().optional(),
});

export const paginationSchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

export const updateKycSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "MANUAL_REVIEW"]),
  reviewNotes: z.string().max(2000).nullable().optional(),
});

export const updateGiftCardSchema = z.object({
  status: z.enum(["REVIEWING", "APPROVED", "REJECTED"]),
  reviewNotes: z.string().max(2000).nullable().optional(),
  fraudFlagsJson: z.string().optional(),
});

export const upsertSettingSchema = z.object({
  valueJson: z.string().min(2),
});

export const createInventorySchema = z.object({
  brand: z.string().min(1),
  valueUsdCents: z.number().int().min(1),
  code: z.string().min(4),
});

export const updateInventorySchema = z.object({
  status: z.enum(["AVAILABLE", "SOLD", "VOID"]).optional(),
});
