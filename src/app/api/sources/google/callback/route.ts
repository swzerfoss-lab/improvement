import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { db } from "@/db";
import { sourceConnections } from "@/db/schema";
import { utcToday } from "@/engine/days";
import { getConnection, syncActivity } from "@/lib/activity";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import {
  CALLBACK_PATH,
  STATE_COOKIE,
  completeAuthorization,
  googleHealthEnabled,
} from "@/sources/google-health";

export async function GET(request: NextRequest) {
  const user = await requireRole("member");
  const store = await cookies();
  const expected = store.get(STATE_COOKIE)?.value;
  store.set(STATE_COOKIE, "", { path: CALLBACK_PATH, maxAge: 0 });

  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  if (!googleHealthEnabled() || !expected || params.get("state") !== expected) {
    redirect("/member/connect?error=failed");
  }
  // No code means the member declined on Google's screen.
  if (!code) redirect("/member/connect?error=declined");
  if (await getConnection(user.id)) redirect("/member");

  const auth = await completeAuthorization(code).catch((error) => {
    console.error("Google Health authorization failed", { memberId: user.id, error });
    return null;
  });
  if (!auth) redirect("/member/connect?error=failed");

  const [conn] = await db
    .insert(sourceConnections)
    .values({
      memberId: user.id,
      provider: "google_health",
      externalUserId: auth.healthUserId,
      connectedOn: utcToday(),
      ...auth.tokens,
    })
    .onConflictDoNothing()
    .returning();
  // The unique index refused it: this Google account already backs a member.
  if (!conn) redirect("/member/connect?error=taken");

  await audit(user.id, "source.connected", { provider: "google_health" });
  try {
    await syncActivity(conn);
  } catch (error) {
    // The connection stands; the next page load retries the sync.
    console.error("First Google Health sync failed", { memberId: user.id, error });
  }
  redirect("/member/settings?welcome=1");
}
