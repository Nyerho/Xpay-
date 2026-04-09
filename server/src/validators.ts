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

export const consumerSwapRequestSchema = z.object({
  fromAsset: z.enum(["BTC", "ETH", "USDT"]),
  toAsset: z.enum(["BTC", "ETH", "USDT"]),
  amount: z.string().min(1).max(64),
});

export const consumerDepositRequestSchema = z.object({
  asset: z.enum(["USD", "USDT", "BTC", "ETH"]),
  rail: z.enum(["BANK", "BTC", "ETH", "TRC20", "ERC20"]),
  amount: z.string().min(1).max(64),
  txid: z.string().min(6).max(2000).optional(),
  reference: z.string().min(2).max(128).optional(),
});

export const consumerWithdrawalRequestSchema = z.object({
  asset: z.enum(["USDT", "BTC", "ETH"]),
  rail: z.enum(["BTC", "ETH", "TRC20", "ERC20"]),
  amount: z.string().min(1).max(64),
  address: z.string().min(12).max(256),
  memo: z.string().min(1).max(128).optional(),
});

export const consumerCryptoBuySchema = z.object({
  asset: z.enum(["USDT", "BTC", "ETH"]),
  usdCents: z.number().int().min(100),
  quoteUpdatedAt: z.string().min(10).max(64).optional(),
});

export const consumerCryptoSellSchema = z.object({
  asset: z.enum(["USDT", "BTC", "ETH"]),
  amount: z.string().min(1).max(64),
  quoteUpdatedAt: z.string().min(10).max(64).optional(),
});

export const consumerUsdcWithdrawalSchema = z.object({
  usdCents: z.number().int().min(100),
  address: z.string().min(12).max(256),
});

export const consumerConvertSchema = z.object({
  from: z.enum(["USD", "NGN", "USDT", "BTC", "ETH"]),
  to: z.enum(["USD", "NGN", "USDT", "BTC", "ETH"]),
  amount: z.string().min(1).max(64),
  quoteUpdatedAt: z.string().min(10).max(64).optional(),
  fxUpdatedAt: z.string().min(10).max(64).optional(),
});

export const consumerGiftCardSubmitSchema = z.object({
  brand: z.string().min(2).max(64),
  valueUsdCents: z.number().int().min(100),
  frontImageUrl: z.string().min(10).max(2000),
  backImageUrl: z.string().min(10).max(2000).optional(),
});
