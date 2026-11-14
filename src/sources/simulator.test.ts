import { describe, expect, it } from "vitest";
import { addDays } from "@/engine/days";
import { computeBaseline, evaluateChallenge } from "@/engine/evaluate";
import { buildTarget, TIER_IDS } from "@/engine/tiers";
import type { TierId } from "@/engine/types";
import { simulateDay, type Persona } from "./simulator";

const CONNECTED = "2026-03-02";

function history(persona: Persona, from: string, to: string) {
  const days = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    days.push(simulateDay(persona, "member-1", CONNECTED, d));
  }
  return days;
}

/** Outcome of a challenge committed on the connect day and run to its end. */
function outcome(persona: Persona, tier: TierId) {
  const days = history(persona, addDays(CONNECTED, -35), addDays(CONNECTED, 120));
  const target = buildTarget(tier, computeBaseline(days, CONNECTED));
  return evaluateChallenge({
    target,
    startDate: CONNECTED,
    pause: null,
    days,
    today: addDays(CONNECTED, 120),
  }).status;
}

describe("simulateDay", () => {
  it("returns the same day for the same inputs", () => {
    expect(simulateDay("regular", "seed", CONNECTED, "2026-03-10")).toEqual(
      simulateDay("regular", "seed", CONNECTED, "2026-03-10"),
    );
  });

  it("gives the cheater manual minutes and no heart rate", () => {
    const days = history("cheater", CONNECTED, addDays(CONNECTED, 13));
    expect(days.every((d) => d.manualMinutes === 120)).toBe(true);
    expect(days.every((d) => d.avgHeartRate === null)).toBe(true);
  });

  it("gives the beginner a low baseline that then rises", () => {
    const before = computeBaseline(history("beginner", addDays(CONNECTED, -35), CONNECTED), CONNECTED);
    const later = addDays(CONNECTED, 28);
    const after = computeBaseline(history("beginner", CONNECTED, later), later);
    expect(before.weeklyMinutes).toBeLessThan(30);
    expect(after.weeklyMinutes).toBeGreaterThan(before.weeklyMinutes * 3);
  });
});

describe("personas against the goal engine", () => {
  it("lets the beginner earn the first two tiers but not the third", () => {
    expect(TIER_IDS.map((t) => outcome("beginner", t))).toEqual([
      "achieved",
      "achieved",
      "failed",
    ]);
  });

  it("lets the regular earn every tier", () => {
    expect(TIER_IDS.map((t) => outcome("regular", t))).toEqual([
      "achieved",
      "achieved",
      "achieved",
    ]);
  });

  it("never rewards the cheater", () => {
    expect(TIER_IDS.map((t) => outcome("cheater", t))).toEqual([
      "failed",
      "failed",
      "failed",
    ]);
  });
});
