import type { Day } from "./types";

const MS_PER_DAY = 86_400_000;

export function addDays(day: Day, n: number): Day {
  return new Date(Date.parse(day) + n * MS_PER_DAY).toISOString().slice(0, 10);
}

export function daysBetween(from: Day, to: Day): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY);
}

export function utcToday(now: Date = new Date()): Day {
  return now.toISOString().slice(0, 10);
}
