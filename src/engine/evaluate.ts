import { addDays } from "./days";
import {
  ACTIVE_DAY_MINUTES,
  DAILY_CREDIT_CAP,
  MIN_CORROBORATING_HR,
} from "./tiers";
import type {
  Baseline,
  ChallengeTarget,
  DailyActivity,
  Day,
  Evaluation,
  Pause,
  WeekResult,
} from "./types";

export const BASELINE_WINDOW_DAYS = 28;
/** Longest a challenge can be paused, so a reserved unit is not held forever. */
export const MAX_PAUSE_DAYS = 14;
/** Days after a week ends before it can count against the member. */
export const GRACE_DAYS = 3;

function hasCorroboratingHeartRate(day: DailyActivity): boolean {
  return day.avgHeartRate !== null && day.avgHeartRate >= MIN_CORROBORATING_HR;
}

/** Minutes a day earns: device-recorded only, capped, corroborated if asked. */
export function creditedMinutes(
  day: DailyActivity,
  requiresHeartRate: boolean,
): number {
  if (requiresHeartRate && !hasCorroboratingHeartRate(day)) return 0;
  return Math.min(Math.max(day.activeMinutes, 0), DAILY_CREDIT_CAP);
}

/** Average week over the 28 days before `asOf` (exclusive). */
export function computeBaseline(days: DailyActivity[], asOf: Day): Baseline {
  const from = addDays(asOf, -BASELINE_WINDOW_DAYS);
  const window = days.filter((d) => d.date >= from && d.date < asOf);
  const weeks = BASELINE_WINDOW_DAYS / 7;
  let minutes = 0;
  let activeDays = 0;
  for (const d of window) {
    const credited = creditedMinutes(d, false);
    minutes += credited;
    if (credited >= ACTIVE_DAY_MINUTES) activeDays += 1;
  }
  return {
    weeklyMinutes: Math.round(minutes / weeks),
    activeDaysPerWeek: activeDays / weeks,
    daysWithData: window.length,
  };
}

/** Whether `day` falls inside the pause, which is capped at MAX_PAUSE_DAYS. */
function isPaused(day: Day, pause: Pause | null): boolean {
  if (!pause || day < pause.start) return false;
  if (day >= addDays(pause.start, MAX_PAUSE_DAYS)) return false;
  return pause.end === null || day < pause.end;
}

export function evaluateChallenge(input: {
  target: ChallengeTarget;
  startDate: Day;
  pause: Pause | null;
  days: DailyActivity[];
  today: Day;
}): Evaluation {
  const { target, startDate, pause, today } = input;
  const byDate = new Map(input.days.map((d) => [d.date, d]));
  const flags = {
    manualMinutesExcluded: 0,
    daysOverCap: 0,
    daysWithoutHeartRate: 0,
  };

  const weeks: WeekResult[] = [];
  let cursor = startDate;
  for (let index = 0; index < target.weeks; index++) {
    // Paused days are skipped, which pushes the rest of the schedule later.
    const dates: Day[] = [];
    while (dates.length < 7) {
      if (!isPaused(cursor, pause)) dates.push(cursor);
      cursor = addDays(cursor, 1);
    }

    let minutes = 0;
    let activeDays = 0;
    for (const date of dates) {
      const d = byDate.get(date);
      if (!d || date > today) continue;
      const credited = creditedMinutes(d, target.requiresHeartRate);
      minutes += credited;
      if (credited >= ACTIVE_DAY_MINUTES) activeDays += 1;
      flags.manualMinutesExcluded += d.manualMinutes;
      if (d.activeMinutes > DAILY_CREDIT_CAP) flags.daysOverCap += 1;
      if (d.activeMinutes >= ACTIVE_DAY_MINUTES && !hasCorroboratingHeartRate(d)) {
        flags.daysWithoutHeartRate += 1;
      }
    }

    const end = dates[6];
    weeks.push({
      index,
      start: dates[0],
      end,
      creditedMinutes: minutes,
      activeDays,
      met:
        minutes >= target.weeklyMinutes &&
        activeDays >= target.activeDaysPerWeek,
      closed: today > addDays(end, GRACE_DAYS),
    });
  }

  const weeksMet = weeks.filter((w) => w.met).length;
  const stillWinnable = weeks.filter((w) => !w.met && !w.closed).length;
  const status =
    weeksMet >= target.weeksRequired
      ? "achieved"
      : weeksMet + stillWinnable < target.weeksRequired
        ? "failed"
        : "in_progress";

  return {
    status,
    weeks,
    weeksMet,
    weeksRequired: target.weeksRequired,
    endDate: weeks[weeks.length - 1].end,
    paused: isPaused(today, pause),
    flags,
  };
}
