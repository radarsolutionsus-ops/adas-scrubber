type UsageResetMode = "calendar" | "billing";

function normalizeResetMode(value?: string): UsageResetMode {
  return value?.toLowerCase() === "billing" ? "billing" : "calendar";
}

export function getUsageResetMode(): UsageResetMode {
  return normalizeResetMode(process.env.USAGE_RESET_MODE);
}

export function getUsageWindowStart(billingCycleStart: Date, now = new Date()): Date {
  const mode = getUsageResetMode();

  if (mode === "calendar") {
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const cycleDay = billingCycleStart.getDate();
  let monthStart = new Date(now.getFullYear(), now.getMonth(), cycleDay);
  if (monthStart > now) {
    monthStart = new Date(now.getFullYear(), now.getMonth() - 1, cycleDay);
  }
  return monthStart;
}
