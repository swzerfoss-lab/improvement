import { describe, expect, it } from "vitest";
import { addDays } from "./days";
import {
  computeBaseline,
  creditedMinutes,
  evaluateChallenge,
  GRACE_DAYS,
  MAX_PAUSE_DAYS,
} from "./evaluate";
import {
  buildTarget,
  DAILY_CREDIT_CAP,
  minTierForValue,
  TIER_IDS,
  TIERS,
} from "./tiers";
import type { ChallengeTarget, DailyActivity, Day } from "./types";

const START = "2026-03-02";

const day = (date: Day, over: Partial<DailyActivity> = {}): DailyActivity => ({
  date,
  activeMinutes: 0,
  manualMinutes: 0,
  avgHeartRate: 130,
  ...over,
});

/** `count` consecutive days from `from`, built by `make(dayIndex)`. */
function span(
  from: Day,
  count: number,
  make: (i: number) => Partial<DailyActivity>,
): DailyActivity[] {
  return Array.from({ length: count }, (_, i) => day(addDays(from, i), make(i)));
}

/** A week pattern: 40 device minutes on the first `activeDays` days of each week. */
const steady = (activeDays: number, minutes = 40) => (i: number) =>
  i % 7 < activeDays ? { activeMinutes: minutes } : {};

const target = (over: Partial<ChallengeTarget> = {}): ChallengeTarget => ({
  tier: 1,
  weeks: 2,
  weeksRequired: 2,
  weeklyMinutes: 100,
  activeDaysPerWeek: 3,
  requiresHeartRate: false,
  ...over,
});

describe("creditedMinutes", () => {
  it("credits device minutes up to the daily cap", () => {
    expect(creditedMinutes(day(START, { activeMinutes: 45 }), false)).toBe(45);
    expect(creditedMinutes(day(START, { activeMinutes: 400 }), false)).toBe(DAILY_CREDIT_CAP);
  });

  it("never credits manual entries", () => {
    expect(creditedMinutes(day(START, { manualMinutes: 300 }), false)).toBe(0);
  });

  it("needs a corroborating heart rate when the tier asks for one", () => {
    expect(creditedMinutes(day(START, { activeMinutes: 45, avgHeartRate: null }), true)).toBe(0);
    expect(creditedMinutes(day(START, { activeMinutes: 45, avgHeartRate: 70 }), true)).toBe(0);
    expect(creditedMinutes(day(START, { activeMinutes: 45, avgHeartRate: 120 }), true)).toBe(45);
    expect(creditedMinutes(day(START, { activeMinutes: 45, avgHeartRate: null }), false)).toBe(45);
  });
});

describe("computeBaseline", () => {
  it("averages the 28 days before the given day", () => {
    const days = span(addDays(START, -28), 28, steady(3, 40));
    expect(computeBaseline(days, START)).toEqual({
      weeklyMinutes: 120,
      activeDaysPerWeek: 3,
      daysWithData: 28,
    });
  });

  it("ignores the given day itself and anything older than the window", () => {
    const days = [
      day(addDays(START, -29), { activeMinutes: 60 }),
      day(START, { activeMinutes: 60 }),
    ];
    expect(computeBaseline(days, START)).toEqual({
      weeklyMinutes: 0,
      activeDaysPerWeek: 0,
      daysWithData: 0,
    });
  });

  it("applies the daily cap and excludes manual minutes", () => {
    const days = [day(addDays(START, -1), { activeMinutes: 500, manualMinutes: 500 })];
    expect(computeBaseline(days, START).weeklyMinutes).toBe(Math.round(DAILY_CREDIT_CAP / 4));
  });
});

describe("buildTarget", () => {
  const baseline = (weeklyMinutes: number, activeDaysPerWeek = 3) => ({
    weeklyMinutes,
    activeDaysPerWeek,
    daysWithData: 28,
  });

  it("uses the tier floor when there is no history to inflate", () => {
    expect(buildTarget(2, baseline(0, 0))).toMatchObject({
      weeklyMinutes: TIERS[2].minutesFloor,
      activeDaysPerWeek: TIERS[2].activeDaysFloor,
    });
  });

  it("scales the member's own baseline, rounded up to five minutes", () => {
    expect(buildTarget(2, baseline(100)).weeklyMinutes).toBe(115);
    expect(buildTarget(2, baseline(101)).weeklyMinutes).toBe(120);
  });

  it("stops at the tier ceiling for already-active members", () => {
    expect(buildTarget(3, baseline(600, 7))).toMatchObject({
      weeklyMinutes: TIERS[3].minutesCeiling,
      activeDaysPerWeek: 5,
    });
  });

  it("always leaves at least two rest days and stays reachable under the daily cap", () => {
    for (const tier of TIER_IDS) {
      for (let minutes = 0; minutes <= 700; minutes += 35) {
        for (let days = 0; days <= 7; days++) {
          const t = buildTarget(tier, baseline(minutes, days));
          expect(t.activeDaysPerWeek).toBeLessThanOrEqual(5);
          expect(t.activeDaysPerWeek * DAILY_CREDIT_CAP).toBeGreaterThanOrEqual(t.weeklyMinutes);
        }
      }
    }
  });
});

describe("minTierForValue", () => {
  it("reserves higher-value items for harder tiers", () => {
    expect(minTierForValue(40_00)).toBe(1);
    expect(minTierForValue(40_01)).toBe(2);
    expect(minTierForValue(120_00)).toBe(2);
    expect(minTierForValue(120_01)).toBe(3);
  });
});

describe("evaluateChallenge", () => {
  const run = (
    days: DailyActivity[],
    today: Day,
    t = target(),
    pause: { start: Day; end: Day | null } | null = null,
  ) => evaluateChallenge({ target: t, startDate: START, pause, days, today });

  it("is achieved once enough weeks are met", () => {
    const result = run(span(START, 14, steady(3)), addDays(START, 13));
    expect(result.status).toBe("achieved");
    expect(result.weeks.map((w) => w.creditedMinutes)).toEqual([120, 120]);
    expect(result.endDate).toBe(addDays(START, 13));
  });

  it("is in progress while weeks are still open", () => {
    const result = run(span(START, 7, steady(3)), addDays(START, 8));
    expect(result.status).toBe("in_progress");
    expect(result.weeksMet).toBe(1);
  });

  it("does not count a week that has the minutes but too few active days", () => {
    const result = run(span(START, 14, steady(2, 80)), addDays(START, 30));
    expect(result.weeks.map((w) => w.creditedMinutes)).toEqual([160, 160]);
    expect(result.status).toBe("failed");
  });

  it("ignores manual entries entirely", () => {
    const days = span(START, 14, () => ({ manualMinutes: 180 }));
    const result = run(days, addDays(START, 30));
    expect(result.status).toBe("failed");
    expect(result.flags.manualMinutesExcluded).toBe(14 * 180);
  });

  it("stops one enormous day from carrying a week", () => {
    const days = span(START, 14, (i) => (i % 7 === 0 ? { activeMinutes: 600 } : {}));
    const result = run(days, addDays(START, 30));
    expect(result.weeks[0].creditedMinutes).toBe(DAILY_CREDIT_CAP);
    expect(result.status).toBe("failed");
    expect(result.flags.daysOverCap).toBe(2);
  });

  it("credits nothing without heart rate when the tier requires it", () => {
    const days = span(START, 14, (i) => ({ ...steady(3)(i), avgHeartRate: null }));
    expect(run(days, addDays(START, 30)).status).toBe("achieved");
    const strict = run(days, addDays(START, 30), target({ requiresHeartRate: true }));
    expect(strict.status).toBe("failed");
    expect(strict.flags.daysWithoutHeartRate).toBe(6);
  });

  it("tolerates an off week when the tier allows one", () => {
    const sixWeeks = target({ weeks: 6, weeksRequired: 5 });
    const days = span(START, 42, (i) => (i >= 14 && i < 21 ? {} : steady(3)(i)));
    const result = run(days, addDays(START, 41), sixWeeks);
    expect(result.weeks.map((w) => w.met)).toEqual([true, true, false, true, true, true]);
    expect(result.status).toBe("achieved");
  });

  it("fails once the goal is out of reach", () => {
    const sixWeeks = target({ weeks: 6, weeksRequired: 5 });
    // Two empty weeks leave only four that can still be met.
    const result = run([], addDays(START, 14 + GRACE_DAYS), sixWeeks);
    expect(result.status).toBe("failed");
  });

  it("waits out the grace period before a missed week counts", () => {
    const lastDayOfGrace = addDays(START, 6 + GRACE_DAYS);
    expect(run([], lastDayOfGrace).status).toBe("in_progress");
    expect(run([], addDays(lastDayOfGrace, 1)).status).toBe("failed");
  });

  it("counts activity that syncs late, during the grace period", () => {
    const days = span(START, 14, steady(3));
    expect(run(days, addDays(START, 13 + GRACE_DAYS)).status).toBe("achieved");
  });

  it("does not credit days that have not happened yet", () => {
    const result = run(span(START, 14, steady(3)), addDays(START, 1));
    expect(result.weeks[0].creditedMinutes).toBe(80);
    expect(result.status).toBe("in_progress");
  });

  describe("pause", () => {
    it("skips paused days and pushes the schedule later", () => {
      const pause = { start: addDays(START, 7), end: addDays(START, 12) };
      const days = [
        ...span(START, 7, steady(3)),
        // Activity during the pause must not count.
        ...span(addDays(START, 7), 5, () => ({ activeMinutes: 60 })),
        ...span(addDays(START, 12), 7, steady(3)),
      ];
      const result = run(days, addDays(START, 18), target(), pause);
      expect(result.weeks[1]).toMatchObject({
        start: addDays(START, 12),
        end: addDays(START, 18),
        creditedMinutes: 120,
      });
      expect(result.status).toBe("achieved");
    });

    it("reports an open pause and cannot fail during it", () => {
      const pause = { start: addDays(START, 2), end: null };
      const result = run([], addDays(START, 12), target(), pause);
      expect(result.paused).toBe(true);
      expect(result.status).toBe("in_progress");
    });

    it("ends by itself after the maximum pause", () => {
      const pause = { start: addDays(START, 2), end: null };
      const result = run([], addDays(START, 2 + MAX_PAUSE_DAYS), target(), pause);
      expect(result.paused).toBe(false);
      expect(result.weeks[0].end).toBe(addDays(START, 6 + MAX_PAUSE_DAYS));
    });
  });
});
