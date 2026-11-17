import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { btn, Card, formatDay, money, PageHeader, Pill, TierBadge } from "@/components/ui";
import { db } from "@/db";
import { campaignInventory, products, redemptions } from "@/db/schema";
import { isTierId } from "@/engine/tiers";
import { campaignInsights, ownCampaign, requireBrand } from "@/lib/brand";
import { usageBySize } from "@/lib/campaigns";
import { MIN_COHORT } from "@/lib/constants";
import { budgetUnits } from "@/lib/offers";
import { markFulfilled, setCampaignStatus } from "../../actions";

const TOO_FEW = `Fewer than ${MIN_COHORT}`;
const showCount = (n: number | null) => (n === null ? TOO_FEW : String(n));
const showRate = (r: number | null) => (r === null ? "Not enough yet" : `${Math.round(r * 100)}%`);

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <dt className="text-sm text-zinc-500">{label}</dt>
      <dd className="mt-1 text-2xl font-bold">{value}</dd>
      {note && <p className="mt-1 text-xs text-zinc-500">{note}</p>}
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div>
      <h3 className="text-sm font-medium text-zinc-800">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-zinc-500">No group of {MIN_COHORT} or more yet.</p>
      ) : (
        <ul className="mt-1 space-y-1 text-sm">
          {rows.map(([name, n]) => (
            <li key={name} className="flex justify-between capitalize">
              <span>{name}</span>
              <span className="font-semibold">{n}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function CampaignPage({
  params,
}: PageProps<"/brand/campaigns/[id]">) {
  const { brand } = await requireBrand();
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const campaign = await ownCampaign(brand.id, id.data);
  if (!campaign) notFound();

  const [[product], inventory, usage, codes, insights] = await Promise.all([
    db.select().from(products).where(eq(products.id, campaign.productId)),
    db
      .select()
      .from(campaignInventory)
      .where(eq(campaignInventory.campaignId, campaign.id))
      .orderBy(campaignInventory.size),
    usageBySize([campaign.id]),
    db
      .select()
      .from(redemptions)
      .where(eq(redemptions.campaignId, campaign.id))
      .orderBy(desc(redemptions.issuedAt)),
    campaignInsights(brand.id, campaign.id),
  ]);

  const used = usage.get(campaign.id);
  const reserved = [...(used?.values() ?? [])].reduce((s, u) => s + u.reserved, 0);
  const earned = codes.length;
  const units = inventory.reduce((s, i) => s + i.quantity, 0);
  const maxRewards = Math.min(units, budgetUnits(campaign.budgetCapCents, product.unitCostCents));
  const audience = [
    campaign.audienceSports.length ? campaign.audienceSports.join(", ") : "any sport",
    campaign.audienceRegions.length ? campaign.audienceRegions.join(", ") : "any region",
  ].join(" · ");

  return (
    <>
      <Link href="/brand" className="text-sm font-medium text-zinc-500 hover:text-zinc-950">
        ← Campaigns
      </Link>
      <div className="mt-4">
        <PageHeader
          title={campaign.name}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              {product.name} {isTierId(campaign.tier) && <TierBadge tier={campaign.tier} />}
              <Pill tone={campaign.status === "active" ? "good" : campaign.status === "paused" ? "warn" : "neutral"}>
                {campaign.status}
              </Pill>
              <span className="text-sm">
                {formatDay(campaign.startsOn)} to {formatDay(campaign.endsOn)} · {audience}
              </span>
            </span>
          }
          action={
            campaign.status !== "ended" && (
              <form action={setCampaignStatus} className="flex gap-2">
                <input type="hidden" name="campaignId" value={campaign.id} />
                <button
                  name="status"
                  value={campaign.status === "active" ? "paused" : "active"}
                  className={btn("secondary")}
                >
                  {campaign.status === "active" ? "Pause new sign-ups" : "Resume"}
                </button>
                <button name="status" value="ended" className={btn("danger")}>End campaign</button>
              </form>
            )
          }
        />
      </div>

      <Card>
        <h2 className="font-semibold">Units and spend</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Exact counts, so you can plan stock. You are charged for a unit only
          when it is earned.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Reserved" value={String(reserved)} note="Held for members still working" />
          <Stat label="Earned" value={String(earned)} note="Goal verified, code issued" />
          <Stat
            label="Still available"
            value={String(Math.max(0, maxRewards - reserved - earned))}
            note={`Of ${maxRewards} rewards your units and cap allow`}
          />
          <Stat
            label="Spent"
            value={money(earned * product.unitCostCents)}
            note={`Cap ${money(campaign.budgetCapCents)} · ${money(product.unitCostCents)} per verified achiever`}
          />
        </dl>

        <table className="mt-6 w-full text-left text-sm">
          <thead className="text-zinc-500">
            <tr>
              <th className="py-2 font-medium">Size</th>
              <th className="py-2 font-medium">Offered</th>
              <th className="py-2 font-medium">Reserved</th>
              <th className="py-2 font-medium">Earned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {inventory.map((row) => (
              <tr key={row.size}>
                <td className="py-2 font-medium">{row.size}</td>
                <td className="py-2">{row.quantity}</td>
                <td className="py-2">{used?.get(row.size)?.reserved ?? 0}</td>
                <td className="py-2">{used?.get(row.size)?.issued ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="mt-6">
        <h2 className="font-semibold">Insights</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Group numbers only. Anything describing fewer than {MIN_COHORT}{" "}
          people is withheld, and no member&apos;s activity is ever shown.
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <Stat label="Wishlisted by" value={showCount(insights.wishlists)} />
          <Stat label="Commitments, all time" value={showCount(insights.commitments)} />
          <Stat
            label="Completion rate"
            value={showRate(insights.completionRate)}
            note={`Of finished challenges. Needs ${MIN_COHORT}.`}
          />
          <Stat
            label="Opt-in rate"
            value={showRate(insights.optInRate)}
            note={`Achievers who chose to hear from you. Needs ${MIN_COHORT}.`}
          />
        </dl>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <Breakdown title="Sports of interested members who opted in" rows={insights.bySport} />
          <Breakdown title="Regions of interested members who opted in" rows={insights.byRegion} />
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="font-semibold">Redemption codes</h2>
        <p className="mt-1 text-sm text-zinc-600">
          Each code is one earned reward. Create it in your store as a
          single-use code for this product at 100% off with free shipping.
          You learn who the member is when they check out with it.
        </p>
        {codes.length === 0 ? (
          <p className="mt-4 text-sm text-zinc-500">No rewards earned yet.</p>
        ) : (
          <table className="mt-4 w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 font-medium">Code</th>
                <th className="py-2 font-medium">Size</th>
                <th className="py-2 font-medium">Issued</th>
                <th className="py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {codes.map((code) => (
                <tr key={code.id}>
                  <td className="py-2 font-mono font-semibold">{code.code}</td>
                  <td className="py-2">{code.size}</td>
                  <td className="py-2">{formatDay(code.issuedAt.toISOString().slice(0, 10))}</td>
                  <td className="py-2">
                    {code.fulfilledAt ? (
                      <Pill tone="good">Fulfilled</Pill>
                    ) : (
                      <form action={markFulfilled}>
                        <input type="hidden" name="redemptionId" value={code.id} />
                        <button className="font-semibold underline">Mark fulfilled</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
