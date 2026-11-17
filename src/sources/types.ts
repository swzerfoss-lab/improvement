import type { sourceConnections } from "@/db/schema";
import type { DailyActivity, Day } from "@/engine/types";

export type SourceConnection = typeof sourceConnections.$inferSelect;

/**
 * Where a member's activity comes from. Every provider, simulated or real,
 * is reduced to the same per-day record so the goal engine never knows the
 * difference.
 */
export interface ActivitySource {
  /** One record per day with data, for `from` to `to` inclusive. */
  fetchDaily(
    connection: SourceConnection,
    from: Day,
    to: Day,
  ): Promise<DailyActivity[]>;
}
