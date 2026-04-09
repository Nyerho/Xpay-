export function paystackEstimateDepositFeeKobo(amountKobo: number) {
  if (!Number.isFinite(amountKobo) || amountKobo <= 0) return null;
  const pct = 0.015;
  const capped = 2000;
  return Math.min(capped, Math.ceil(amountKobo * pct));
}

export function paystackEstimateTransferFeeKobo(amountKobo: number) {
  if (!Number.isFinite(amountKobo) || amountKobo <= 0) return null;
  if (amountKobo <= 5000 * 100) return 10 * 100;
  if (amountKobo <= 50000 * 100) return 25 * 100;
  return 50 * 100;
}

