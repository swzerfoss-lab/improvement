import type { Baseline, ChallengeTarget, TierId } from "./types";

/** Most minutes one day can earn. A safety limit and an anti-cheat limit. */
export const DAILY_CREDIT_CAP = 90;
/** Credited minutes that make a day count as active. */
export const ACTIVE_DAY_MINUTES = 20;
/** Targets never ask for more active days than this, so rest days are free. */
export const MAX_ACTIVE_DAYS_TARGET = 5;
/**
 * Lowest average heart rate that corroborates recorded activity.
 * A placeholder threshold: it should be tuned on real data.
 */
export const MIN_CORROBORATING_HR = 90;

export type Tier = {
  id: TierId;
  name: string;
  summary: string;
  /** Highest retail value this tier may reward, or null for no limit. */
  maxRetailCents: number | null;
  weeks: number;
  /** Weeks that must be met. Fewer than `weeks` leaves room for an off week. */
  weeksRequired: number;
  minutesMultiplier: number;
  /** Lowest weekly target, however low the baseline. Blunts baseline gaming. */
  minutesFloor: number;
  /** Highest weekly target, so already-active members earn by sustaining. */
  minutesCeiling: number;
  activeDaysFloor: number;
  requiresHeartRate: boolean;
  requiresReview: boolean;
};

export const TIERS: Record<TierId, Tier> = {
  1: {
    id: 1,
    name: "Starter",
    summary: "Two consistent weeks",
    maxRetailCents: 40_00,
    weeks: 2,
    weeksRequired: 2,
    minutesMultiplier: 1,
    minutesFloor: 60,
    minutesCeiling: 150,
    activeDaysFloor: 3,
    requiresHeartRate: false,
    requiresReview: false,
  },
  2: {
    id: 2,
    name: "Builder",
    summary: "Six weeks above your baseline",
    maxRetailCents: 120_00,
    weeks: 6,
    weeksRequired: 5,
    minutesMultiplier: 1.15,
    minutesFloor: 90,
    minutesCeiling: 240,
    activeDaysFloor: 3,
    requiresHeartRate: true,
    requiresReview: false,
  },
  3: {
    id: 3,
    name: "Elite",
    summary: "Twelve weeks well above your baseline",
    maxRetailCents: null,
    weeks: 12,
    weeksRequired: 10,
    minutesMultiplier: 1.3,
    minutesFloor: 150,
    minutesCeiling: 300,
    activeDaysFloor: 4,
    requiresHeartRate: true,
    requiresReview: true,
  },
};

export const TIER_IDS: TierId[] = [1, 2, 3];

export function isTierId(n: number): n is TierId {
  return n === 1 || n === 2 || n === 3;
}

/** The easiest tier allowed to reward an item of this retail value. */
export function minTierForValue(retailValueCents: number): TierId {
  for (const id of TIER_IDS) {
    const max = TIERS[id].maxRetailCents;
    if (max === null || retailValueCents <= max) return id;
  }
  return 3;
}

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

/** A personal target: the member's own baseline, scaled by the tier. */
export function buildTarget(tierId: TierId, baseline: Baseline): ChallengeTarget {
  const tier = TIERS[tierId];
  const scaled = Math.ceil((baseline.weeklyMinutes * tier.minutesMultiplier) / 5) * 5;
  return {
    tier: tierId,
    weeks: tier.weeks,
    weeksRequired: tier.weeksRequired,
    weeklyMinutes: clamp(scaled, tier.minutesFloor, tier.minutesCeiling),
    activeDaysPerWeek: clamp(
      Math.ceil(baseline.activeDaysPerWeek),
      tier.activeDaysFloor,
      MAX_ACTIVE_DAYS_TARGET,
    ),
    requiresHeartRate: tier.requiresHeartRate,
  };
}
