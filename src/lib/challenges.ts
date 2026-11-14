import "server-only";
import { randomInt } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  baselines,
  campaigns,
  challenges,
  memberProfiles,
  redemptions,
} from "@/db/schema";
import { addDays } from "@/engine/days";
import {
  BASELINE_WINDOW_DAYS,
  computeBaseline,
  evaluateChallenge,
} from "@/engine/evaluate";
import { buildTarget, isTierId, TIERS } from "@/engine/tiers";
import type { Baseline, Day, Evaluation } from "@/engine/types";
import { getConnection, loadDays, memberToday, syncActivity } from "./activity";
import { audit } from "./audit";
import { getOffers, isOpen, OPEN_STATUSES } from "./campaigns";
import { isEligible } from "./offers";

export type Challenge = typeof challenges.$inferSelect;

export async function currentBaseline(
  memberId: string,
  today: Day,
): Promise<Baseline> {
  const days = await loadDays(memberId, addDays(today, -BASELINE_WINDOW_DAYS));
  return computeBaseline(days, today);
}

export async function evaluate(
  challenge: Challenge,
  today: Day,
): Promise<Evaluation> {
  return evaluateChallenge({
    target: challenge.target,
    startDate: challenge.startDate,
    pause: challenge.pauseStart
      ? { start: challenge.pauseStart, end: challenge.pauseEnd }
      : null,
    days: await loadDays(challenge.memberId, challenge.startDate),
    today,
  });
}

// No 0/O or 1/I/L, so a code survives being read aloud or retyped.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function newCode(): string {
  const block = () =>
    Array.from({ length: 5 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("");
  return `EA-${block()}-${block()}`;
}

async function issueRedemption(tx: Tx, challenge: Challenge): Promise<void> {
  await tx.insert(redemptions).values({
    challengeId: challenge.id,
    campaignId: challenge.campaignId,
    size: challenge.size,
    code: newCode(),
  });
}

/**
 * Reserves one unit of `size` for this member and starts their challenge.
 * The member's baseline is frozen here so the target cannot move later.
 */
export async function commitToChallenge(
  memberId: string,
  campaignId: string,
  size: string,
): Promise<{ error: string } | { challengeId: string }> {
  const conn = await getConnection(memberId);
  if (!conn) return { error: "Connect a wearable first." };
  await syncActivity(conn);
  const today = memberToday(conn);
  const baseline = await currentBaseline(memberId, today);
  const [profile] = await db
    .select()
    .from(memberProfiles)
    .where(eq(memberProfiles.userId, memberId));

  return db.transaction(async (tx) => {
    // Locking the campaign row serialises its reservations, so two members
    // can never both take the last unit or the last of the budget.
    const [locked] = await tx
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .for("update");
    if (!locked) return { error: "That offer no longer exists." };

    const [offer] = await getOffers([campaignId], tx);
    const tier = offer.campaign.tier;
    if (!isTierId(tier)) throw new Error(`Campaign ${campaignId} has no valid tier`);
    if (!isOpen(offer.campaign, today)) {
      return { error: "This offer is not open right now." };
    }
    if (!isEligible(offer.campaign, profile)) {
      return { error: "This offer is for a different audience." };
    }

    const mine = await tx
      .select({ campaignId: challenges.campaignId, status: challenges.status })
      .from(challenges)
      .where(eq(challenges.memberId, memberId));
    if (mine.some((c) => c.status === "active" || c.status === "in_review")) {
      return { error: "Finish or withdraw from your current challenge first." };
    }
    if (mine.some((c) => c.campaignId === campaignId && c.status === "achieved")) {
      return { error: "You have already earned this reward." };
    }

    const left = offer.sizes.find((s) => s.size === size)?.left ?? 0;
    if (left < 1) return { error: "That size has just run out." };

    const [savedBaseline] = await tx
      .insert(baselines)
      .values({ memberId, computedOn: today, ...baseline })
      .returning({ id: baselines.id });
    const [challenge] = await tx
      .insert(challenges)
      .values({
        memberId,
        campaignId,
        size,
        baselineId: savedBaseline.id,
        target: buildTarget(tier, baseline),
        startDate: today,
      })
      .returning({ id: challenges.id });
    await audit(memberId, "challenge.committed", { challengeId: challenge.id, campaignId, size }, tx);
    return { challengeId: challenge.id };
  });
}

/**
 * Fetches fresh activity and settles the member's active challenge if it
 * has been won or lost. Returns false when the wearable could not be
 * reached; nothing is decided on stale data.
 */
export async function syncAndEvaluate(memberId: string): Promise<boolean> {
  const conn = await getConnection(memberId);
  if (!conn) return true;
  try {
    await syncActivity(conn);
  } catch (error) {
    console.error("Activity sync failed", { memberId, error });
    return false;
  }

  const [challenge] = await db
    .select()
    .from(challenges)
    .where(and(eq(challenges.memberId, memberId), eq(challenges.status, "active")));
  if (!challenge) return true;

  const evaluation = await evaluate(challenge, memberToday(conn));
  if (evaluation.status === "in_progress") return true;
  const next =
    evaluation.status === "failed"
      ? "failed"
      : TIERS[challenge.target.tier].requiresReview
        ? "in_review"
        : "achieved";

  await db.transaction(async (tx) => {
    const [settled] = await tx
      .update(challenges)
      .set({ status: next, evidence: evaluation })
      .where(and(eq(challenges.id, challenge.id), eq(challenges.status, "active")))
      .returning({ id: challenges.id });
    if (!settled) return; // a concurrent request settled it first
    if (next === "achieved") await issueRedemption(tx, challenge);
    await audit(null, `challenge.${next}`, { challengeId: challenge.id }, tx);
  });
  return true;
}

/** A reviewer's decision on a goal that needed a human check. */
export async function decideReview(
  reviewerId: string,
  challengeId: string,
  approve: boolean,
): Promise<void> {
  await db.transaction(async (tx) => {
    const [challenge] = await tx
      .update(challenges)
      .set({ status: approve ? "achieved" : "rejected" })
      .where(and(eq(challenges.id, challengeId), eq(challenges.status, "in_review")))
      .returning();
    if (!challenge) return;
    if (approve) await issueRedemption(tx, challenge);
    await audit(
      reviewerId,
      approve ? "review.approved" : "review.rejected",
      { challengeId },
      tx,
    );
  });
}

/** Gives up the member's open challenge, releasing its reserved unit. */
export async function withdrawOpenChallenge(
  memberId: string,
  tx: Tx | typeof db = db,
): Promise<void> {
  const withdrawn = await tx
    .update(challenges)
    .set({ status: "withdrawn" })
    .where(
      and(eq(challenges.memberId, memberId), inArray(challenges.status, OPEN_STATUSES)),
    )
    .returning({ id: challenges.id });
  for (const { id } of withdrawn) {
    await audit(memberId, "challenge.withdrawn", { challengeId: id }, tx);
  }
}
