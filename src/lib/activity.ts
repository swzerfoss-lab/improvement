import "server-only";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { dailyActivity, sourceConnections } from "@/db/schema";
import { addDays, utcToday } from "@/engine/days";
import { BASELINE_WINDOW_DAYS } from "@/engine/evaluate";
import type { DailyActivity, Day } from "@/engine/types";
import { getSource } from "@/sources";
import type { SourceConnection } from "@/sources/types";

/** History imported at connect: the baseline window plus a margin. */
const HISTORY_DAYS = BASELINE_WINDOW_DAYS + 7;
/** Days re-fetched on every sync, because devices upload late. */
const RESYNC_DAYS = 7;
/** Real providers are not asked again within this many minutes. */
const SYNC_THROTTLE_MINUTES = 15;

export async function getConnection(
  memberId: string,
): Promise<SourceConnection | null> {
  const [conn] = await db
    .select()
    .from(sourceConnections)
    .where(eq(sourceConnections.memberId, memberId));
  return conn ?? null;
}

/** "Today" for this member. Only a simulator connection can shift it. */
export function memberToday(conn: SourceConnection | null): Day {
  return addDays(utcToday(), conn?.clockOffsetDays ?? 0);
}

export async function syncActivity(conn: SourceConnection): Promise<void> {
  const today = memberToday(conn);
  if (
    conn.provider !== "simulator" &&
    conn.lastSyncedAt &&
    Date.now() - conn.lastSyncedAt.getTime() < SYNC_THROTTLE_MINUTES * 60_000
  ) {
    return;
  }

  const from = conn.syncedThrough
    ? addDays(conn.syncedThrough, -RESYNC_DAYS)
    : addDays(today, -HISTORY_DAYS);
  const days = await getSource(conn.provider).fetchDaily(conn, from, today);

  await db.transaction(async (tx) => {
    if (days.length > 0) {
      await tx
        .insert(dailyActivity)
        .values(days.map((d) => ({ memberId: conn.memberId, ...d })))
        .onConflictDoUpdate({
          target: [dailyActivity.memberId, dailyActivity.date],
          set: {
            activeMinutes: sql`excluded.active_minutes`,
            manualMinutes: sql`excluded.manual_minutes`,
            avgHeartRate: sql`excluded.avg_heart_rate`,
          },
        });
    }
    await tx
      .update(sourceConnections)
      .set({ syncedThrough: today, lastSyncedAt: new Date() })
      .where(eq(sourceConnections.id, conn.id));
  });
}

export async function loadDays(
  memberId: string,
  from: Day,
): Promise<DailyActivity[]> {
  return db
    .select({
      date: dailyActivity.date,
      activeMinutes: dailyActivity.activeMinutes,
      manualMinutes: dailyActivity.manualMinutes,
      avgHeartRate: dailyActivity.avgHeartRate,
    })
    .from(dailyActivity)
    .where(and(eq(dailyActivity.memberId, memberId), gte(dailyActivity.date, from)))
    .orderBy(asc(dailyActivity.date));
}
