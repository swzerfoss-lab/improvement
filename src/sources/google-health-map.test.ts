import { describe, expect, it } from "vitest";
import { fillDays, toDailyActivity, type ExercisePoint } from "./google-health-map";

/** A data point shaped like the v4 `exercise` schema. */
function session(
  name: string,
  day: [number, number, number],
  minutes: number,
  over: Partial<NonNullable<ExercisePoint["exercise"]>> = {},
  heartRate?: number,
): ExercisePoint {
  const [year, month, date] = day;
  return {
    name: `users/123/dataTypes/exercise/dataPoints/${name}`,
    exercise: {
      exerciseType: "RUNNING",
      activeDuration: `${minutes * 60}s`,
      interval: {
        startTime: "2026-03-02T23:30:00Z",
        endTime: "2026-03-03T00:10:00Z",
        civilStartTime: { date: { year, month, day: date } },
      },
      metricsSummary:
        heartRate === undefined
          ? {}
          : { averageHeartRateBeatsPerMinute: String(heartRate) },
      ...over,
    },
  };
}

describe("toDailyActivity", () => {
  it("sums device sessions per local day with a minutes-weighted heart rate", () => {
    const wearable = [
      session("a", [2026, 3, 2], 30, {}, 120),
      session("b", [2026, 3, 2], 10, {}, 160),
      session("c", [2026, 3, 4], 45, {}, 140),
    ];
    expect(toDailyActivity(wearable, wearable)).toEqual([
      { date: "2026-03-02", activeMinutes: 40, manualMinutes: 0, avgHeartRate: 130 },
      { date: "2026-03-04", activeMinutes: 45, manualMinutes: 0, avgHeartRate: 140 },
    ]);
  });

  it("treats sessions outside the wearable family as manual minutes", () => {
    const device = session("a", [2026, 3, 2], 30, {}, 120);
    const typedIn = session("b", [2026, 3, 2], 90);
    const otherApp = session("c", [2026, 3, 3], 60, {}, 150);
    expect(toDailyActivity([device], [device, typedIn, otherApp])).toEqual([
      { date: "2026-03-02", activeMinutes: 30, manualMinutes: 90, avgHeartRate: 120 },
      { date: "2026-03-03", activeMinutes: 0, manualMinutes: 60, avgHeartRate: null },
    ]);
  });

  it("uses the local start day, not the UTC timestamp", () => {
    // startTime is 23:30 UTC on Mar 2, but the member's local day is Mar 3.
    const point = session("a", [2026, 3, 3], 40, {}, 130);
    expect(toDailyActivity([point], [point])[0].date).toBe("2026-03-03");
  });

  it("reports no heart rate when the device recorded none", () => {
    const point = session("a", [2026, 3, 2], 40);
    expect(toDailyActivity([point], [point])[0].avgHeartRate).toBeNull();
  });

  it("falls back to the interval when there is no active duration", () => {
    const point = session("a", [2026, 3, 2], 0, { activeDuration: undefined }, 130);
    expect(toDailyActivity([point], [point])[0].activeMinutes).toBe(40);
  });

  it("ignores logged activities that are not training", () => {
    const ride = session("a", [2026, 3, 2], 120, { exerciseType: "MOTORCYCLE" }, 95);
    expect(toDailyActivity([ride], [ride])).toEqual([]);
  });
});

describe("fillDays", () => {
  it("returns every day in the range, with zeros for days without sessions", () => {
    const day = { date: "2026-03-02", activeMinutes: 40, manualMinutes: 0, avgHeartRate: 130 };
    expect(fillDays([day], "2026-03-01", "2026-03-03")).toEqual([
      { date: "2026-03-01", activeMinutes: 0, manualMinutes: 0, avgHeartRate: null },
      day,
      { date: "2026-03-03", activeMinutes: 0, manualMinutes: 0, avgHeartRate: null },
    ]);
  });
});
