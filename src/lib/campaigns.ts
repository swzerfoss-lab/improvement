import "server-only";
import { and, count, eq, gte, inArray, lte } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  brands,
  campaignInventory,
  campaigns,
  challenges,
  products,
  redemptions,
} from "@/db/schema";
import type { Day } from "@/engine/types";
import { budgetUnits, isEligible, unitsLeft } from "./offers";

/** Challenge statuses that hold a reserved unit without a redemption yet. */
export const OPEN_STATUSES = ["active", "in_review"] as const;

export type Usage = { reserved: number; issued: number };

/**
 * Units in use per campaign and size: reserved by open challenges, or
 * already issued as redemption codes.
 */
export async function usageBySize(
  campaignIds: string[],
  tx: Tx | typeof db = db,
): Promise<Map<string, Map<string, Usage>>> {
  const usage = new Map<string, Map<string, Usage>>();
  if (campaignIds.length === 0) return usage;
  const entry = (campaignId: string, size: string) => {
    const sizes = usage.get(campaignId) ?? new Map<string, Usage>();
    usage.set(campaignId, sizes);
    const u = sizes.get(size) ?? { reserved: 0, issued: 0 };
    sizes.set(size, u);
    return u;
  };

  const reserved = await tx
    .select({ campaignId: challenges.campaignId, size: challenges.size, n: count() })
    .from(challenges)
    .where(
      and(
        inArray(challenges.campaignId, campaignIds),
        inArray(challenges.status, OPEN_STATUSES),
      ),
    )
    .groupBy(challenges.campaignId, challenges.size);
  for (const r of reserved) entry(r.campaignId, r.size).reserved = r.n;

  const issued = await tx
    .select({ campaignId: redemptions.campaignId, size: redemptions.size, n: count() })
    .from(redemptions)
    .where(inArray(redemptions.campaignId, campaignIds))
    .groupBy(redemptions.campaignId, redemptions.size);
  for (const r of issued) entry(r.campaignId, r.size).issued = r.n;

  return usage;
}

export type Offer = {
  campaign: typeof campaigns.$inferSelect;
  product: typeof products.$inferSelect;
  brand: { id: string; name: string };
  sizes: { size: string; left: number }[];
  totalLeft: number;
};

async function toOffers(
  rows: Pick<Offer, "campaign" | "product" | "brand">[],
  tx: Tx | typeof db = db,
): Promise<Offer[]> {
  const ids = rows.map((r) => r.campaign.id);
  if (ids.length === 0) return [];
  const inventory = await tx
    .select()
    .from(campaignInventory)
    .where(inArray(campaignInventory.campaignId, ids));
  const usage = await usageBySize(ids, tx);

  return rows.map((row) => {
    const used = usage.get(row.campaign.id) ?? new Map<string, Usage>();
    const usedOf = (size: string) => {
      const u = used.get(size);
      return u ? u.reserved + u.issued : 0;
    };
    const usedTotal = [...used.keys()].reduce((sum, size) => sum + usedOf(size), 0);
    const stock = inventory.filter((i) => i.campaignId === row.campaign.id);
    const sizes = stock.map((i) => ({
      size: i.size,
      left: unitsLeft({
        quantity: i.quantity,
        usedForSize: usedOf(i.size),
        usedTotal,
        unitCostCents: row.product.unitCostCents,
        budgetCapCents: row.campaign.budgetCapCents,
      }),
    }));
    const stockLeft = stock.reduce(
      (sum, i) => sum + Math.max(0, i.quantity - usedOf(i.size)),
      0,
    );
    const budgetLeft =
      budgetUnits(row.campaign.budgetCapCents, row.product.unitCostCents) - usedTotal;
    return { ...row, sizes, totalLeft: Math.max(0, Math.min(stockLeft, budgetLeft)) };
  });
}

const offerColumns = {
  campaign: campaigns,
  product: products,
  brand: { id: brands.id, name: brands.name },
};

/** Whether new members can still commit to this campaign on `today`. */
export function isOpen(campaign: Offer["campaign"], today: Day): boolean {
  return (
    campaign.status === "active" &&
    campaign.startsOn <= today &&
    campaign.endsOn >= today
  );
}

/** Open campaigns this member's declared profile is eligible for. */
export async function listOffers(
  today: Day,
  profile: { sports: string[]; region: string | null },
): Promise<Offer[]> {
  const rows = await db
    .select(offerColumns)
    .from(campaigns)
    .innerJoin(products, eq(products.id, campaigns.productId))
    .innerJoin(brands, eq(brands.id, campaigns.brandId))
    .where(
      and(
        eq(campaigns.status, "active"),
        lte(campaigns.startsOn, today),
        gte(campaigns.endsOn, today),
      ),
    )
    .orderBy(campaigns.tier, campaigns.createdAt);
  return toOffers(rows.filter((r) => isEligible(r.campaign, profile)));
}

export async function getOffers(
  campaignIds: string[],
  tx: Tx | typeof db = db,
): Promise<Offer[]> {
  if (campaignIds.length === 0) return [];
  const rows = await tx
    .select(offerColumns)
    .from(campaigns)
    .innerJoin(products, eq(products.id, campaigns.productId))
    .innerJoin(brands, eq(brands.id, campaigns.brandId))
    .where(inArray(campaigns.id, campaignIds))
    .orderBy(campaigns.tier, campaigns.createdAt);
  return toOffers(rows, tx);
}
