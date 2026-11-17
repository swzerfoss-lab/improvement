import { MIN_COHORT } from "./constants";

/** Whether a member's declared profile matches a campaign's audience. */
export function isEligible(
  campaign: { audienceSports: string[]; audienceRegions: string[] },
  profile: { sports: string[]; region: string | null },
): boolean {
  const sportOk =
    campaign.audienceSports.length === 0 ||
    campaign.audienceSports.some((s) => profile.sports.includes(s));
  const regionOk =
    campaign.audienceRegions.length === 0 ||
    (profile.region !== null && campaign.audienceRegions.includes(profile.region));
  return sportOk && regionOk;
}

/** Most rewards a budget can pay for. */
export function budgetUnits(budgetCapCents: number, unitCostCents: number): number {
  return Math.floor(budgetCapCents / unitCostCents);
}

/**
 * Units of one size that can still be reserved. Both caps are hard: the
 * size's own quantity, and the campaign budget across all sizes.
 */
export function unitsLeft(input: {
  quantity: number;
  usedForSize: number;
  usedTotal: number;
  unitCostCents: number;
  budgetCapCents: number;
}): number {
  const bySize = input.quantity - input.usedForSize;
  const byBudget =
    budgetUnits(input.budgetCapCents, input.unitCostCents) - input.usedTotal;
  return Math.max(0, Math.min(bySize, byBudget));
}

/**
 * A count safe to show a brand: exact when zero or at least MIN_COHORT,
 * otherwise null, meaning "a few, too few to show".
 */
export function suppressSmall(count: number): number | null {
  return count === 0 || count >= MIN_COHORT ? count : null;
}
