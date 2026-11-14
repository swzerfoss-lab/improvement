import { addDays } from "@/engine/days";
import type { DailyActivity, Day } from "@/engine/types";

/**
 * The parts of a Google Health API v4 `exercise` data point that we read.
 * Field names follow the published discovery document
 * (https://health.googleapis.com/$discovery/rest?version=v4).
 */
export type ExercisePoint = {
  name: string;
  exercise?: {
    exerciseType?: string;
    /** A google-duration such as "1800s". Excludes pauses. */
    activeDuration?: string;
    interval?: {
      startTime?: string;
      endTime?: string;
      civilStartTime?: { date?: { year: number; month: number; day: number } };
    };
    metricsSummary?: { averageHeartRateBeatsPerMinute?: string };
  };
};

/** Logged "exercises" that are not physical training. */
const NOT_TRAINING = new Set([
  "MEDITATE",
  "MOTORCYCLE",
  "ELECTRIC_SCOOTER",
  "SNOWMOBILING",
]);

const pad = (n: number) => String(n).padStart(2, "0");

/** The member's local calendar day the session started on. */
function dayOf(point: ExercisePoint): Day | null {
  const civil = point.exercise?.interval?.civilStartTime?.date;
  if (civil) return `${civil.year}-${pad(civil.month)}-${pad(civil.day)}`;
  return point.exercise?.interval?.startTime?.slice(0, 10) ?? null;
}

function minutesOf(point: ExercisePoint): number {
  const exercise = point.exercise;
  const active = exercise?.activeDuration?.match(/^(\d+(?:\.\d+)?)s$/);
  if (active) return Math.floor(Number(active[1]) / 60);
  const { startTime, endTime } = exercise?.interval ?? {};
  if (!startTime || !endTime) return 0;
  return Math.max(0, Math.floor((Date.parse(endTime) - Date.parse(startTime)) / 60_000));
}

/**
 * Reduces exercise sessions to one record per day.
 *
 * `wearable` is the list returned for the `google-wearables` data source
 * family, which Google documents as tracker and watch data with manual logs
 * excluded: those minutes are device-recorded. `all` is the list for every
 * source. Anything in `all` that is not in `wearable` (typed in by hand, or
 * written by another app) is kept as manual minutes and never credited.
 */
export function toDailyActivity(
  wearable: ExercisePoint[],
  all: ExercisePoint[],
): DailyActivity[] {
  type Totals = { device: number; manual: number; hrSum: number; hrMinutes: number };
  const byDay = new Map<Day, Totals>();
  const totals = (day: Day) => {
    const t = byDay.get(day) ?? { device: 0, manual: 0, hrSum: 0, hrMinutes: 0 };
    byDay.set(day, t);
    return t;
  };
  const countable = (p: ExercisePoint) =>
    !NOT_TRAINING.has(p.exercise?.exerciseType ?? "");

  for (const point of wearable.filter(countable)) {
    const day = dayOf(point);
    const minutes = minutesOf(point);
    if (!day || minutes === 0) continue;
    const t = totals(day);
    t.device += minutes;
    const hr = Number(point.exercise?.metricsSummary?.averageHeartRateBeatsPerMinute);
    if (hr > 0) {
      t.hrSum += hr * minutes;
      t.hrMinutes += minutes;
    }
  }

  const fromWearable = new Set(wearable.map((p) => p.name));
  for (const point of all.filter(countable)) {
    if (fromWearable.has(point.name)) continue;
    const day = dayOf(point);
    const minutes = minutesOf(point);
    if (!day || minutes === 0) continue;
    totals(day).manual += minutes;
  }

  return [...byDay]
    .map(([date, t]) => ({
      date,
      activeMinutes: t.device,
      manualMinutes: t.manual,
      avgHeartRate: t.hrMinutes > 0 ? Math.round(t.hrSum / t.hrMinutes) : null,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * One record for every day from `from` to `to`, with zeros where nothing was
 * logged, so a day whose sessions were later deleted is overwritten on sync.
 */
export function fillDays(days: DailyActivity[], from: Day, to: Day): DailyActivity[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const filled: DailyActivity[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) {
    filled.push(
      byDate.get(date) ?? { date, activeMinutes: 0, manualMinutes: 0, avgHeartRate: null },
    );
  }
  return filled;
}
