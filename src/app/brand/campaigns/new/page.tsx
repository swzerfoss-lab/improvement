import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, input, label, money, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { products } from "@/db/schema";
import { addDays, utcToday } from "@/engine/days";
import { minTierForValue, TIER_IDS, TIERS } from "@/engine/tiers";
import { requireBrand } from "@/lib/brand";
import { REGIONS, SIZES, SPORTS, type SizeType } from "@/lib/constants";
import { createCampaign } from "../../actions";

const chip =
  "cursor-pointer rounded-full border border-zinc-300 px-3 py-1 text-sm capitalize has-[:checked]:border-zinc-950 has-[:checked]:bg-zinc-950 has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lime-400";

export default async function NewCampaignPage({
  searchParams,
}: PageProps<"/brand/campaigns/new">) {
  const { brand } = await requireBrand();
  const productId = z.uuid().safeParse((await searchParams).product);
  if (!productId.success) notFound();
  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId.data), eq(products.brandId, brand.id)));
  if (!product) notFound();

  const minTier = minTierForValue(product.retailValueCents);
  const today = utcToday();

  return (
    <>
      <Link href="/brand/products" className="text-sm font-medium text-zinc-500 hover:text-zinc-950">
        ← Products
      </Link>
      <div className="mt-4">
        <PageHeader
          title="New campaign"
          subtitle={`Rewarding ${product.name} (retail ${money(product.retailValueCents)}, ${money(product.unitCostCents)} a reward to you).`}
        />
      </div>

      <ActionForm action={createCampaign} className="space-y-6">
        <input type="hidden" name="productId" value={product.id} />

        <Card>
          <label className={label} htmlFor="name">Campaign name</label>
          <input className={input} id="name" name="name" defaultValue={product.name} required />
          <p className="mt-1 text-xs text-zinc-500">Only you see this.</p>
        </Card>

        <Card>
          <h2 className="font-semibold">Effort tier</h2>
          <p className="mt-1 text-sm text-zinc-600">
            You choose how much effort the reward asks for. We turn that into
            a personal goal for each member, scaled from their own baseline,
            so a beginner and a regular both have to push.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {TIER_IDS.map((id) => {
              const tier = TIERS[id];
              const allowed = id >= minTier;
              return (
                <label
                  key={id}
                  className={`rounded-xl border p-4 ${
                    allowed
                      ? "cursor-pointer border-zinc-200 has-[:checked]:border-zinc-950 has-[:checked]:bg-zinc-50"
                      : "cursor-not-allowed border-zinc-100 text-zinc-400"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <input type="radio" name="tier" value={id} disabled={!allowed} defaultChecked={id === minTier} required />
                    <span className="font-semibold">{tier.name}</span>
                  </span>
                  <span className="mt-2 block text-sm">
                    {tier.weeks} weeks, {tier.weeksRequired} of them met.{" "}
                    {tier.minutesFloor} to {tier.minutesCeiling} active minutes
                    a week, depending on the member.
                  </span>
                  <span className="mt-2 block text-xs">
                    {allowed
                      ? tier.requiresReview
                        ? "Each goal reached is checked by a person before a code is issued."
                        : tier.requiresHeartRate
                          ? "Activity must be backed by heart-rate data."
                          : "Device-recorded activity only."
                      : "Too easy for an item of this value."}
                  </span>
                </label>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2 className="font-semibold">Audience</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Leave a group empty to include everyone. Members are matched on
            the sports and region they tell us about.
          </p>
          <fieldset className="mt-4">
            <legend className={label}>Sports</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {SPORTS.map((sport) => (
                <label key={sport} className={chip}>
                  <input type="checkbox" name="sports" value={sport} className="sr-only" />
                  {sport}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="mt-4">
            <legend className={label}>Regions you ship to</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {REGIONS.map((region) => (
                <label key={region} className={chip}>
                  <input type="checkbox" name="regions" value={region} className="sr-only" />
                  {region}
                </label>
              ))}
            </div>
          </fieldset>
        </Card>

        <Card>
          <h2 className="font-semibold">Units and budget</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Both are hard limits. A unit is held when a member commits and
            costs you {money(product.unitCostCents)} only if they reach their
            goal. If they miss or withdraw, it goes back on offer.
          </p>
          <fieldset className="mt-4">
            <legend className={label}>Units by size</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {SIZES[product.sizeType as SizeType].map((size) => (
                <label key={size} className="text-center text-sm">
                  <span className="block font-medium">{size}</span>
                  <input
                    className={`${input} w-20 text-center`}
                    name={`qty:${size}`}
                    type="number"
                    min="0"
                    step="1"
                    defaultValue="0"
                  />
                </label>
              ))}
            </div>
          </fieldset>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className={label} htmlFor="budgetCap">Budget cap ($)</label>
              <input className={input} id="budgetCap" name="budgetCap" type="number" min="1" step="0.01" required />
              <p className="mt-1 text-xs text-zinc-500">
                Rewards stop at whichever comes first: the units or this cap.
              </p>
            </div>
            <div>
              <label className={label} htmlFor="startsOn">Open from</label>
              <input className={input} id="startsOn" name="startsOn" type="date" defaultValue={today} required />
            </div>
            <div>
              <label className={label} htmlFor="endsOn">Last day to join</label>
              <input className={input} id="endsOn" name="endsOn" type="date" defaultValue={addDays(today, 60)} required />
              <p className="mt-1 text-xs text-zinc-500">
                Members who join by then can still finish and earn afterwards.
              </p>
            </div>
          </div>
        </Card>

        <SubmitButton variant="accent">Launch campaign</SubmitButton>
      </ActionForm>
    </>
  );
}
