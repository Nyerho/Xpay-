import crypto from "node:crypto";
import { prisma } from "./prisma";

function makeCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 8; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]!;
  return out;
}

export async function ensureUserReferralCode(userId: string) {
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u) return null;
  if (u.referralCode) return u.referralCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = makeCode();
    try {
      const updated = await prisma.user.update({ where: { id: userId }, data: { referralCode: code } });
      return updated.referralCode;
    } catch {
      continue;
    }
  }
  const fallback = `X${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  try {
    const updated = await prisma.user.update({ where: { id: userId }, data: { referralCode: fallback } });
    return updated.referralCode;
  } catch {
    return null;
  }
}

export async function findReferrerByCode(code: string) {
  const c = code.trim().toUpperCase();
  if (!c) return null;
  const u = await prisma.user.findUnique({ where: { referralCode: c } });
  if (!u) return null;
  return u;
}

