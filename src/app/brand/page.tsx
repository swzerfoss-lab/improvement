import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { btn, Card, formatDay, money, PageHeader, Pill, TierBadge } from "@/components/ui";
import { db } from "@/db";
import { campaignInventory, campaigns, products } from "@/db/schema";
import { isTierId } from "@/engine/tiers";
import { requireBrand } from "@/lib/brand";
import { usageBySize } from "@/lib/campaigns";
import { budgetUnits } from "@/lib/offers";

const STATUS_TONE = { active: "good", paused: "warn", ended: "neutral" } as const;

export default async function BrandHome() {
  const { brand } = await requireBrand();
  const rows = await db
    .select({ campaign: campaigns, product: products })
    .from(campaigns)
    .innerJoin(products, eq(products.id, campaigns.productId))
    .where(eq(campaigns.brandId, brand.id))
    .orderBy(desc(campaigns.createdAt));
  const ids = rows.map((r) => r.campaign.id);
  const [usage, inventory] = await Promise.all([
    usageBySize(ids),
    ids.length
      ? db.select().from(campaignInventory).where(inArray(campaignInventory.campaignId, ids))
      : [],
  ]);

  return (
    <>
      <PageHeader
        title={brand.name}
        subtitle="Sponsor everyday athletes. You pay for a reward only when a member's goal has been verified."
        action={<Link href="/brand/products" className={btn("primary")}>New campaign</Link>}
      />

      {rows.length === 0 ? (
        <Card>
          <h2 className="font-semibold">Set up your first campaign</h2>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
            <li>Add a product and what one reward costs you, shipping included.</li>
            <li>Choose an effort tier, an audience, and how many units of each size.</li>
            <li>Set a budget cap. Members reserve units and earn them.</li>
          </ol>
          <Link href="/brand/products" className={`${btn("accent")} mt-5`}>Add a product</Link>
        </Card>
      ) : (
        <ul className="space-y-4">
          {rows.map(({ campaign, product }) => {
            const used = [...(usage.get(campaign.id)?.values() ?? [])];
            const reserved = used.reduce((sum, u) => sum + u.reserved, 0);
            const earned = used.reduce((sum, u) => sum + u.issued, 0);
            const units = inventory
              .filter((i) => i.campaignId === campaign.id)
              .reduce((sum, i) => sum + i.quantity, 0);
            const max = Math.min(units, budgetUnits(campaign.budgetCapCents, product.unitCostCents));
            return (
              <li key={campaign.id}>
                <Link
                  href={`/brand/campaigns/${campaign.id}`}
                  className="block rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:border-zinc-400"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold">{campaign.name}</h2>
                    <div className="flex items-center gap-2">
                      {isTierId(campaign.tier) && <TierBadge tier={campaign.tier} />}
                      <Pill tone={STATUS_TONE[campaign.status]}>{campaign.status}</Pill>
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600">
                    {product.name} · {formatDay(campaign.startsOn)} to {formatDay(campaign.endsOn)}
                  </p>
                  <dl className="mt-4 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-zinc-500">Reserved</dt>
                      <dd className="text-xl font-bold">{reserved}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Earned</dt>
                      <dd className="text-xl font-bold">{earned}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Still available</dt>
                      <dd className="text-xl font-bold">{Math.max(0, max - reserved - earned)}</dd>
                    </div>
                    <div>
                      <dt className="text-zinc-500">Spent of cap</dt>
                      <dd className="text-xl font-bold">
                        {money(earned * product.unitCostCents)}
                        <span className="text-sm font-medium text-zinc-500">
                          {" "}/ {money(campaign.budgetCapCents)}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
