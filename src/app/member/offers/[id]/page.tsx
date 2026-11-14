import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { targetSentence } from "@/components/offer";
import { Card, money, PageHeader, TierBadge } from "@/components/ui";
import { db } from "@/db";
import { challenges, memberProfiles } from "@/db/schema";
import { GRACE_DAYS, MAX_PAUSE_DAYS } from "@/engine/evaluate";
import { buildTarget, DAILY_CREDIT_CAP, isTierId, TIERS } from "@/engine/tiers";
import { getConnection, memberToday } from "@/lib/activity";
import { requireRole } from "@/lib/auth";
import { getOffers, isOpen } from "@/lib/campaigns";
import { currentBaseline } from "@/lib/challenges";
import { isEligible } from "@/lib/offers";
import { commit } from "../../actions";

export default async function OfferPage({ params }: PageProps<"/member/offers/[id]">) {
  const user = await requireRole("member");
  const conn = await getConnection(user.id);
  if (!conn) redirect("/member/connect");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const [offer] = await getOffers([id.data]);
  if (!offer || !isTierId(offer.campaign.tier)) notFound();

  const today = memberToday(conn);
  const [[profile], baseline, mine] = await Promise.all([
    db.select().from(memberProfiles).where(eq(memberProfiles.userId, user.id)),
    currentBaseline(user.id, today),
    db
      .select({ campaignId: challenges.campaignId, status: challenges.status })
      .from(challenges)
      .where(eq(challenges.memberId, user.id)),
  ]);

  const { campaign, product, brand } = offer;
  const tier = TIERS[offer.campaign.tier];
  const target = buildTarget(tier.id, baseline);
  const mySize = product.sizeType === "shoe" ? profile.shoeSize : profile.apparelSize;
  const preselected =
    offer.sizes.find((s) => s.size === mySize && s.left > 0) ??
    (offer.sizes.length === 1 && offer.sizes[0].left > 0 ? offer.sizes[0] : undefined);

  const blocked = mine.some((c) => c.campaignId === campaign.id && c.status === "achieved")
    ? "You have already earned this reward."
    : !isOpen(campaign, today)
      ? "This offer is not open right now."
      : !isEligible(campaign, profile)
        ? "This offer is for a different audience."
        : mine.some((c) => c.status === "active" || c.status === "in_review")
          ? "You already have a challenge running. Finish or withdraw from it to start another."
          : offer.totalLeft === 0
            ? "Every unit is reserved right now. One may free up if someone withdraws."
            : null;

  const rules = [
    `Only minutes your device records count, up to ${DAILY_CREDIT_CAP} a day. Typed-in entries do not.`,
    tier.requiresHeartRate
      ? "Activity needs heart-rate data from your device to count."
      : null,
    "Rest days never count against you.",
    `You can pause once, for up to ${MAX_PAUSE_DAYS} days, if you are injured or ill.`,
    `A week only counts as missed ${GRACE_DAYS} days after it ends, so a late sync is fine.`,
    tier.requiresReview
      ? "For a reward this size, a person checks the data before your code is issued."
      : null,
  ].filter((r) => r !== null);

  return (
    <>
      <Link href="/member/offers" className="text-sm font-medium text-zinc-500 hover:text-zinc-950">
        ← All offers
      </Link>
      <div className="mt-4">
        <PageHeader
          title={product.name}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              {brand.name} · worth {money(product.retailValueCents)} <TierBadge tier={tier.id} />
            </span>
          }
        />
      </div>

      <div className="grid gap-6 md:grid-cols-5">
        <div className="space-y-6 md:col-span-3">
          {product.description && (
            <Card>
              <p className="text-sm text-zinc-700">{product.description}</p>
            </Card>
          )}
          <Card>
            <h2 className="font-semibold">What earns it, for you</h2>
            <p className="mt-2 text-lg font-semibold">{targetSentence(target)}.</p>
            <p className="mt-2 text-sm text-zinc-600">
              Set from your baseline of {baseline.weeklyMinutes} minutes a
              week. Someone with a different baseline gets a different goal.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-zinc-700">
              {rules.map((rule) => (
                <li key={rule} className="flex gap-2">
                  <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
                  {rule}
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <Card className="h-fit md:col-span-2">
          <h2 className="font-semibold">Commit and reserve your size</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Your unit is held for you from the moment you commit. The gear
            and shipping are free.
          </p>
          {blocked ? (
            <p className="mt-4 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700">{blocked}</p>
          ) : (
            <ActionForm action={commit} className="mt-4">
              <input type="hidden" name="campaignId" value={campaign.id} />
              <fieldset>
                <legend className="text-sm font-medium text-zinc-800">Size</legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {offer.sizes.map((s) => (
                    <label
                      key={s.size}
                      className={`rounded-lg border px-3 py-2 text-sm font-medium ${
                        s.left === 0
                          ? "cursor-not-allowed border-zinc-200 text-zinc-400 line-through"
                          : "cursor-pointer border-zinc-300 has-[:checked]:border-zinc-950 has-[:checked]:bg-zinc-950 has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lime-400"
                      }`}
                    >
                      <input
                        type="radio"
                        name="size"
                        value={s.size}
                        disabled={s.left === 0}
                        defaultChecked={preselected?.size === s.size}
                        required
                        className="sr-only"
                      />
                      {s.size}
                    </label>
                  ))}
                </div>
              </fieldset>
              <SubmitButton variant="accent" className="mt-5 w-full">
                Commit to this goal
              </SubmitButton>
              <p className="mt-2 text-xs text-zinc-500">
                Your {tier.weeks} weeks start today. You can withdraw at any time.
              </p>
            </ActionForm>
          )}
        </Card>
      </div>
    </>
  );
}
