"use server";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/action-form";
import { db } from "@/db";
import {
  brandConsents,
  brands,
  challenges,
  dailyActivity,
  memberProfiles,
  sourceConnections,
  users,
  wishlistItems,
} from "@/db/schema";
import { utcToday } from "@/engine/days";
import { getConnection, memberToday, syncActivity } from "@/lib/activity";
import { audit } from "@/lib/audit";
import { destroySession, requireRole } from "@/lib/auth";
import { commitToChallenge, withdrawOpenChallenge } from "@/lib/challenges";
import { REGIONS, SIZES, SPORTS } from "@/lib/constants";
import { simulatorEnabled } from "@/sources";
import { isPersona } from "@/sources/simulator";

const CONSENT_ERROR = "Please confirm you have read what we read and what brands see.";

export async function connectSimulator(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("member");
  if (!simulatorEnabled()) return { error: "The simulator is turned off." };
  if (formData.get("consent") !== "on") return { error: CONSENT_ERROR };
  const persona = String(formData.get("persona") ?? "");
  if (!isPersona(persona)) return { error: "Choose a simulated athlete." };
  if (await getConnection(user.id)) return { error: "A source is already connected." };

  const [conn] = await db
    .insert(sourceConnections)
    .values({
      memberId: user.id,
      provider: "simulator",
      simulatorPersona: persona,
      connectedOn: utcToday(),
    })
    .returning();
  await audit(user.id, "source.connected", { provider: "simulator" });
  await syncActivity(conn);
  redirect("/member/settings?welcome=1");
}

export async function disconnectSource(): Promise<void> {
  const user = await requireRole("member");
  await db.transaction(async (tx) => {
    await withdrawOpenChallenge(user.id, tx);
    await tx.delete(sourceConnections).where(eq(sourceConnections.memberId, user.id));
    await tx.delete(dailyActivity).where(eq(dailyActivity.memberId, user.id));
    await audit(user.id, "source.disconnected", undefined, tx);
  });
  redirect("/member/connect");
}

const profileSchema = z.object({
  displayName: z.string().trim().min(1, "Enter your name.").max(80),
  region: z.enum(REGIONS).nullable(),
  sports: z.array(z.enum(SPORTS)),
  apparelSize: z.enum(SIZES.apparel as [string, ...string[]]).nullable(),
  shoeSize: z.enum(SIZES.shoe as [string, ...string[]]).nullable(),
});

export async function saveProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("member");
  const optional = (name: string) => String(formData.get(name) ?? "") || null;
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    region: optional("region"),
    sports: formData.getAll("sports"),
    apparelSize: optional("apparelSize"),
    shoeSize: optional("shoeSize"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  await db
    .update(memberProfiles)
    .set(parsed.data)
    .where(eq(memberProfiles.userId, user.id));
  if (formData.get("next") === "home") redirect("/member");
  refresh();
  return { ok: "Profile saved." };
}

export async function toggleWishlist(formData: FormData): Promise<void> {
  const user = await requireRole("member");
  const campaignId = z.uuid().parse(formData.get("campaignId"));
  const key = and(
    eq(wishlistItems.memberId, user.id),
    eq(wishlistItems.campaignId, campaignId),
  );
  const removed = await db.delete(wishlistItems).where(key).returning();
  if (removed.length === 0) {
    await db.insert(wishlistItems).values({ memberId: user.id, campaignId });
  }
  refresh();
}

export async function commit(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("member");
  const campaignId = z.uuid().safeParse(formData.get("campaignId"));
  const size = String(formData.get("size") ?? "");
  if (!campaignId.success || !size) return { error: "Choose a size." };
  const result = await commitToChallenge(user.id, campaignId.data, size);
  if ("error" in result) return result;
  redirect(`/member/challenges/${result.challengeId}`);
}

/** The signed-in member's own active challenge, or nothing. */
const ownActive = (memberId: string, formData: FormData) =>
  and(
    eq(challenges.id, z.uuid().parse(formData.get("challengeId"))),
    eq(challenges.memberId, memberId),
    eq(challenges.status, "active"),
  );

export async function pauseChallenge(formData: FormData): Promise<void> {
  const user = await requireRole("member");
  const today = memberToday(await getConnection(user.id));
  // One pause per challenge: only a challenge never paused can start one.
  await db
    .update(challenges)
    .set({ pauseStart: today })
    .where(and(ownActive(user.id, formData), isNull(challenges.pauseStart)));
  refresh();
}

export async function resumeChallenge(formData: FormData): Promise<void> {
  const user = await requireRole("member");
  const today = memberToday(await getConnection(user.id));
  await db
    .update(challenges)
    .set({ pauseEnd: today })
    .where(
      and(
        ownActive(user.id, formData),
        isNotNull(challenges.pauseStart),
        isNull(challenges.pauseEnd),
      ),
    );
  refresh();
}

export async function withdrawChallenge(): Promise<void> {
  const user = await requireRole("member");
  await withdrawOpenChallenge(user.id);
  redirect("/member");
}

export async function saveConsent(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("member");
  const brandId = z.uuid().parse(formData.get("brandId"));
  const [brand] = await db.select({ id: brands.id }).from(brands).where(eq(brands.id, brandId));
  if (!brand) return { error: "That brand no longer exists." };
  const consent = {
    shareProfile: formData.get("shareProfile") === "on",
    shareEmail: formData.get("shareEmail") === "on",
    updatedAt: new Date(),
  };
  await db
    .insert(brandConsents)
    .values({ memberId: user.id, brandId, ...consent })
    .onConflictDoUpdate({
      target: [brandConsents.memberId, brandConsents.brandId],
      set: consent,
    });
  await audit(user.id, "consent.updated", {
    brandId,
    shareProfile: consent.shareProfile,
    shareEmail: consent.shareEmail,
  });
  refresh();
  return { ok: "Sharing choices saved." };
}

/** Simulator only: moves this member's clock forward so a demo can run. */
export async function skipAhead(formData: FormData): Promise<void> {
  const user = await requireRole("member");
  const days = z.coerce.number().int().min(1).max(28).parse(formData.get("days"));
  if (!simulatorEnabled()) return;
  await db
    .update(sourceConnections)
    .set({ clockOffsetDays: sql`${sourceConnections.clockOffsetDays} + ${days}` })
    .where(
      and(
        eq(sourceConnections.memberId, user.id),
        eq(sourceConnections.provider, "simulator"),
      ),
    );
  refresh();
}

export async function deleteAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireRole("member");
  if (formData.get("confirm") !== "DELETE") {
    return { error: 'Type "DELETE" to confirm.' };
  }
  // Cascades remove the profile, activity, baselines, challenges, wishlist,
  // consents and sessions. Issued redemption codes stay with the brand,
  // detached from the member.
  await db.delete(users).where(eq(users.id, user.id));
  await audit(user.id, "account.deleted");
  await destroySession();
  redirect("/");
}
