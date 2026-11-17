import "server-only";
import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  brandConsents,
  brands,
  campaigns,
  challenges,
  memberProfiles,
  wishlistItems,
} from "@/db/schema";
import { requireRole } from "./auth";
import { MIN_COHORT } from "./constants";
import { suppressSmall } from "./offers";

/** The signed-in brand user's brand. */
export async function requireBrand() {
  const user = await requireRole("brand");
  const [brand] = await db.select().from(brands).where(eq(brands.ownerUserId, user.id));
  if (!brand) throw new Error(`Brand user ${user.id} has no brand`);
  return { user, brand };
}

/** A campaign, only if it belongs to this brand. */
export async function ownCampaign(brandId: string, campaignId: string) {
  const [campaign] = await db
    .select()
    .from(campaigns)
    .where(and(eq(campaigns.id, campaignId), eq(campaigns.brandId, brandId)));
  return campaign ?? null;
}

export type Insights = {
  /** null means "between 1 and MIN_COHORT - 1": too few to show. */
  wishlists: number | null;
  commitments: number | null;
  /** Share of finished challenges that were achieved, once enough finished. */
  completionRate: number | null;
  /** Share of achievers who chose to hear from the brand. */
  optInRate: number | null;
  /** Only groups of at least MIN_COHORT, among members who opted in. */
  bySport: [string, number][];
  byRegion: [string, number][];
};

const rate = (part: number, whole: number) =>
  whole >= MIN_COHORT ? part / whole : null;

/**
 * Aggregate numbers a brand may see for a campaign. Nothing here describes
 * one person: small groups are withheld, and the sport and region
 * breakdowns count only members who opted in for this brand.
 */
export async function campaignInsights(
  brandId: string,
  campaignId: string,
): Promise<Insights> {
  const [[wish], byStatus, emailOptIns, profiles] = await Promise.all([
    db
      .select({ n: count() })
      .from(wishlistItems)
      .where(eq(wishlistItems.campaignId, campaignId)),
    db
      .select({ status: challenges.status, n: count() })
      .from(challenges)
      .where(eq(challenges.campaignId, campaignId))
      .groupBy(challenges.status),
    db
      .select({ n: count() })
      .from(challenges)
      .innerJoin(
        brandConsents,
        and(
          eq(brandConsents.memberId, challenges.memberId),
          eq(brandConsents.brandId, brandId),
          eq(brandConsents.shareEmail, true),
        ),
      )
      .where(and(eq(challenges.campaignId, campaignId), eq(challenges.status, "achieved"))),
    // Members who opted in for this brand and showed interest in this campaign.
    db
      .selectDistinct({
        memberId: memberProfiles.userId,
        sports: memberProfiles.sports,
        region: memberProfiles.region,
      })
      .from(memberProfiles)
      .innerJoin(
        brandConsents,
        and(
          eq(brandConsents.memberId, memberProfiles.userId),
          eq(brandConsents.brandId, brandId),
          eq(brandConsents.shareProfile, true),
        ),
      )
      .where(
        inArray(
          memberProfiles.userId,
          db
            .select({ id: wishlistItems.memberId })
            .from(wishlistItems)
            .where(eq(wishlistItems.campaignId, campaignId))
            .union(
              db
                .select({ id: challenges.memberId })
                .from(challenges)
                .where(eq(challenges.campaignId, campaignId)),
            ),
        ),
      ),
  ]);

  const n = (status: string) => byStatus.find((s) => s.status === status)?.n ?? 0;
  const achieved = n("achieved");
  const finished = achieved + n("failed") + n("withdrawn") + n("rejected");
  const commitments = byStatus.reduce((sum, s) => sum + s.n, 0);

  const tally = (values: string[]) => {
    const counts = new Map<string, number>();
    for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
    return [...counts].filter(([, c]) => c >= MIN_COHORT).sort((a, b) => b[1] - a[1]);
  };

  return {
    wishlists: suppressSmall(wish.n),
    commitments: suppressSmall(commitments),
    completionRate: rate(achieved, finished),
    optInRate: rate(emailOptIns[0].n, achieved),
    bySport: tally(profiles.flatMap((p) => p.sports)),
    byRegion: tally(profiles.flatMap((p) => (p.region ? [p.region] : []))),
  };
}
