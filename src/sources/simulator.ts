import { addDays, daysBetween } from "@/engine/days";
import type { DailyActivity, Day } from "@/engine/types";
import type { ActivitySource } from "./types";

export const PERSONAS = {
  beginner: {
    label: "Beginner who starts training",
    description:
      "About one short session a week before joining, then four a week that slowly get longer.",
  },
  regular: {
    label: "Regular who steps it up",
    description:
      "Five 45-minute sessions a week before joining, then five longer ones.",
  },
  cheater: {
    label: "Cheater",
    description:
      "Types in two hours of exercise every day and shakes the tracker twice a week. No heart-rate data.",
  },
} as const;

export type Persona = keyof typeof PERSONAS;

export const isPersona = (s: string): s is Persona => s in PERSONAS;

/** Deterministic integer in [0, n) for a seed and a day. */
function jitter(seed: string, date: Day, n: number): number {
  let h = 2166136261;
  for (const ch of `${seed}:${date}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % n;
}

/** Position of `date` in a 7-day cycle anchored on the connect day. */
const cycleDay = (connectedOn: Day, date: Day) =>
  (((daysBetween(connectedOn, date) % 7) + 7) % 7);

const REST: Omit<DailyActivity, "date"> = {
  activeMinutes: 0,
  manualMinutes: 0,
  avgHeartRate: null,
};

/**
 * One simulated day. A pure function of its inputs, so the same member
 * always sees the same history however often it is fetched.
 */
export function simulateDay(
  persona: Persona,
  seed: string,
  connectedOn: Day,
  date: Day,
): DailyActivity {
  const joined = date >= connectedOn;
  const pos = cycleDay(connectedOn, date);
  const weeksIn = Math.floor(daysBetween(connectedOn, date) / 7);
  const j = (n: number) => jitter(seed, date, n);

  switch (persona) {
    case "beginner": {
      const trains = joined ? [0, 2, 4, 5].includes(pos) : pos === 1;
      if (!trains) return { date, ...REST };
      const minutes = joined ? 25 + Math.min(25, weeksIn * 2) + j(6) : 18 + j(6);
      return { date, activeMinutes: minutes, manualMinutes: 0, avgHeartRate: 118 + j(18) };
    }
    case "regular": {
      if (![0, 1, 3, 5, 6].includes(pos)) return { date, ...REST };
      const minutes = joined ? 62 + j(10) : 42 + j(10);
      return { date, activeMinutes: minutes, manualMinutes: 0, avgHeartRate: 128 + j(22) };
    }
    case "cheater": {
      if (!joined) return { date, ...REST };
      return {
        date,
        activeMinutes: [0, 3].includes(pos) ? 45 : 0,
        manualMinutes: 120,
        avgHeartRate: null,
      };
    }
  }
}

export const simulator: ActivitySource = {
  async fetchDaily(connection, from, to) {
    const persona = connection.simulatorPersona;
    if (!persona || !isPersona(persona)) {
      throw new Error("Simulator connection has no persona");
    }
    const days: DailyActivity[] = [];
    for (let date = from; date <= to; date = addDays(date, 1)) {
      days.push(simulateDay(persona, connection.memberId, connection.connectedOn, date));
    }
    return days;
  },
};
