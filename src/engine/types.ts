/** A calendar day as "YYYY-MM-DD". All engine dates are UTC days. */
export type Day = string;

export type DailyActivity = {
  date: Day;
  /** Minutes recorded by the device. */
  activeMinutes: number;
  /** Minutes the member entered by hand. Never credited. */
  manualMinutes: number;
  /** Average heart rate while active, or null if the device recorded none. */
  avgHeartRate: number | null;
};

export type Baseline = {
  weeklyMinutes: number;
  activeDaysPerWeek: number;
  /** How many of the baseline window's days had any record at all. */
  daysWithData: number;
};

export type TierId = 1 | 2 | 3;

export type ChallengeTarget = {
  tier: TierId;
  weeks: number;
  weeksRequired: number;
  weeklyMinutes: number;
  activeDaysPerWeek: number;
  requiresHeartRate: boolean;
};

export type Pause = { start: Day; end: Day | null };

export type WeekResult = {
  index: number;
  start: Day;
  end: Day;
  creditedMinutes: number;
  activeDays: number;
  met: boolean;
  /** Over, including the grace period for late-syncing devices. */
  closed: boolean;
};

export type Evaluation = {
  status: "in_progress" | "achieved" | "failed";
  weeks: WeekResult[];
  weeksMet: number;
  weeksRequired: number;
  endDate: Day;
  paused: boolean;
  /** Signals for a human reviewer. None of them changes the outcome. */
  flags: {
    manualMinutesExcluded: number;
    daysOverCap: number;
    daysWithoutHeartRate: number;
  };
};
