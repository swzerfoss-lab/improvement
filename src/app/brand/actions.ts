"use server";

import { and, eq, isNull } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/action-form";
import { db } from "@/db";
import { campaignInventory, campaigns, products, redemptions } from "@/db/schema";
import { utcToday } from "@/engine/days";
import { isTierId, minTierForValue, TIERS } from "@/engine/tiers";
import { audit } from "@/lib/audit";
import { ownCampaign, requireBrand } from "@/lib/brand";
import { REGIONS, SIZE_TYPES, SIZES, SPORTS, type SizeType } from "@/lib/constants";

/** Dollars typed into a form, as whole cents. */
const dollars = (message: string) =>
  z.coerce
    .number(message)
    .positive(message)
    .max(100_000, "That amount is too large.")
    .transform((n) => Math.round(n * 100));

const productSchema = z.object({
  name: z.string().trim().min(1, "Name the product.").max(120),
  description: z.string().trim().max(1000),
  sizeType: z.enum(SIZE_TYPES),
  retailValueCents: dollars("Enter the retail value in dollars."),
  unitCostCents: dollars("Enter what one reward costs you, shipping included."),
});

export async function createProduct(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { brand } = await requireBrand();
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") ?? "",
    sizeType: formData.get("sizeType"),
    retailValueCents: formData.get("retailValue"),
    unitCostCents: formData.get("unitCost"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const [product] = await db
    .insert(products)
    .values({ brandId: brand.id, ...parsed.data })
    .returning({ id: products.id });
  redirect(`/brand/campaigns/new?product=${product.id}`);
}

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose both dates.");

const campaignSchema = z.object({
  productId: z.uuid(),
  name: z.string().trim().min(1, "Name the campaign.").max(120),
  tier: z.coerce.number().int(),
  audienceSports: z.array(z.enum(SPORTS)),
  audienceRegions: z.array(z.enum(REGIONS)),
  startsOn: day,
  endsOn: day,
  budgetCapCents: dollars("Enter a budget cap in dollars."),
});

export async function createCampaign(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, brand } = await requireBrand();
  const parsed = campaignSchema.safeParse({
    productId: formData.get("productId"),
    name: formData.get("name"),
    tier: formData.get("tier"),
    audienceSports: formData.getAll("sports"),
    audienceRegions: formData.getAll("regions"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
    budgetCapCents: formData.get("budgetCap"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, data.productId), eq(products.brandId, brand.id)));
  if (!product) return { error: "Choose one of your products." };

  if (!isTierId(data.tier)) return { error: "Choose an effort tier." };
  const minTier = minTierForValue(product.retailValueCents);
  if (data.tier < minTier) {
    return {
      error: `An item of this value needs the ${TIERS[minTier].name} tier or higher.`,
    };
  }
  if (data.endsOn < data.startsOn) return { error: "The end date is before the start date." };
  if (data.endsOn < utcToday()) return { error: "The end date is in the past." };
  if (data.budgetCapCents < product.unitCostCents) {
    return { error: "The budget cap does not cover a single reward." };
  }

  const inventory = SIZES[product.sizeType as SizeType]
    .map((size) => ({
      size,
      quantity: z.coerce.number().int().min(0).max(100_000).catch(0).parse(formData.get(`qty:${size}`)),
    }))
    .filter((i) => i.quantity > 0);
  if (inventory.length === 0) return { error: "Offer at least one unit." };

  const campaignId = await db.transaction(async (tx) => {
    const [campaign] = await tx
      .insert(campaigns)
      .values({ brandId: brand.id, ...data })
      .returning({ id: campaigns.id });
    await tx
      .insert(campaignInventory)
      .values(inventory.map((i) => ({ campaignId: campaign.id, ...i })));
    await audit(user.id, "campaign.created", { campaignId: campaign.id }, tx);
    return campaign.id;
  });
  redirect(`/brand/campaigns/${campaignId}`);
}

export async function setCampaignStatus(formData: FormData): Promise<void> {
  const { user, brand } = await requireBrand();
  const campaignId = z.uuid().parse(formData.get("campaignId"));
  const status = z.enum(["active", "paused", "ended"]).parse(formData.get("status"));
  const campaign = await ownCampaign(brand.id, campaignId);
  // Ending is final. Members already committed keep their reserved units.
  if (!campaign || campaign.status === "ended") return;
  await db.update(campaigns).set({ status }).where(eq(campaigns.id, campaignId));
  await audit(user.id, "campaign.status", { campaignId, status });
  refresh();
}

export async function markFulfilled(formData: FormData): Promise<void> {
  const { brand } = await requireBrand();
  const redemptionId = z.uuid().parse(formData.get("redemptionId"));
  const [row] = await db
    .select({ campaignId: redemptions.campaignId })
    .from(redemptions)
    .where(eq(redemptions.id, redemptionId));
  if (!row || !(await ownCampaign(brand.id, row.campaignId))) return;
  await db
    .update(redemptions)
    .set({ fulfilledAt: new Date() })
    .where(and(eq(redemptions.id, redemptionId), isNull(redemptions.fulfilledAt)));
  refresh();
}
