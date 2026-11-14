import "server-only";
import { db, type Tx } from "@/db";
import { auditLog } from "@/db/schema";

/**
 * Records who did what. `detail` holds ids and outcomes only: never activity
 * data, emails or tokens, because this trail outlives account deletion.
 */
export async function audit(
  actorUserId: string | null,
  action: string,
  detail?: Record<string, unknown>,
  tx: Tx | typeof db = db,
): Promise<void> {
  await tx.insert(auditLog).values({ actorUserId, action, detail });
}
