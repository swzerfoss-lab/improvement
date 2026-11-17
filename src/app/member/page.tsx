import { desc, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OfferCard } from "@/components/offer";
import { SimulatorBar } from "@/components/simulator-bar";
import { btn, Card, PageHeader, Pill, TierBadge } from "@/components/ui";
import { db } from "@/db";
import { challenges, redemptions, wishlistItems } from "@/db/schema";
import { buildTarget, isTierId } from "@/engine/tiers";
import { getConnection, memberToday } from "@/lib/activity";
import { requireRole } from "@/lib/auth";
import { getOffers, isOpen } from "@/lib/campaigns";
import { currentBaseline, evaluate, syncAndEvaluate } from "@/lib/challenges";
import { toggleWishlist } from "./actions";

const PAST_LABELS: Record<string, string> = {
  failed: "Goal missed",
  withdrawn: "Withdrawn",
  rejected: "Not approved",
};

export default async function MemberHome() {
  const user = await requireRole("member");
  if (!(await getConnection(user.id))) redirect("/member/connect");
  const synced = await syncAndEvaluate(user.id);
  // Read again: the sync above moves the connection's sync markers.
  const conn = await getConnection(user.id);
  const today = memberToday(conn);

  const [baseline, mine, wishlist] = await Promise.all([
    currentBaseline(user.id, today),
    db
      .select()
      .from(challenges)
      .where(eq(challenges.memberId, user.id))
      .orderBy(desc(challenges.createdAt)),
    db
      .select({ campaignId: wishlistItems.campaignId })
      .from(wishlistItems)
      .where(eq(wishlistItems.memberId, user.id)),
  ]);

  const offers = await getOffers([
    ...new Set([...mine.map((c) => c.campaignId), ...wishlist.map((w) => w.campaignId)]),
  ]);
  const offerById = new Map(offers.map((o) => [o.campaign.id, o]));

  const open = mine.find((c) => c.status === "active" || c.status === "in_review");
  const openEvaluation =
    open?.status === "active" ? await evaluate(open, today) : open?.evidence;
  const earned = mine.filter((c) => c.status === "achieved");
  const past = mine.filter((c) => c.status in PAST_LABELS);
  const codes = earned.length
    ? await db
        .select()
        .from(redemptions)
        .where(inArray(redemptions.challengeId, earned.map((c) => c.id)))
    : [];

  const earnedCampaigns = new Set(earned.map((c) => c.campaignId));
  const wanted = wishlist
    .map((w) => offerById.get(w.campaignId))
    .filter((o) => o !== undefined)
    .filter((o) => o.campaign.id !== open?.campaignId && !earnedCampaigns.has(o.campaign.id));

  return (
    <>
      <PageHeader
        title="My gear"
        subtitle="Pick what you want, see what earns it, and watch your progress."
        action={<Link href="/member/offers" className={btn("primary")}>Browse offers</Link>}
      />

      {conn?.provider === "simulator" && <SimulatorBar conn={conn} today={today} />}

      {!synced && (
        <p role="alert" className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          We could not reach your wearable just now, so your progress may be
          out of date. Nothing is decided until we can sync again.
        </p>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <h2 className="text-sm font-semibold text-zinc-500">Your baseline</h2>
          <p className="mt-2 text-3xl font-bold">{baseline.weeklyMinutes} min</p>
          <p className="text-sm text-zinc-600">
            a week, over {baseline.activeDaysPerWeek.toFixed(1).replace(".0", "")} active days
          </p>
          <p className="mt-3 text-xs text-zinc-500">
            {baseline.daysWithData < 14
              ? "We found little history from your device, so your goals start from each tier's minimum."
              : "Your last four weeks. Every goal is set from here, so it is yours alone."}
          </p>
        </Card>

        <Card className="md:col-span-2">
          <h2 className="text-sm font-semibold text-zinc-500">Current challenge</h2>
          {open ? (
            <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xl font-bold">{offerById.get(open.campaignId)?.product.name}</p>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
                  <TierBadge tier={open.target.tier} />
                  {open.status === "in_review" ? (
                    <Pill tone="warn">Goal reached, being checked</Pill>
                  ) : openEvaluation?.paused ? (
                    <Pill tone="warn">Paused</Pill>
                  ) : (
                    <span>
                      {openEvaluation?.weeksMet ?? 0} of {open.target.weeksRequired} weeks met
                    </span>
                  )}
                  <span>· size {open.size} reserved</span>
                </p>
              </div>
              <Link href={`/member/challenges/${open.id}`} className={btn("accent")}>
                View progress
              </Link>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-600">
              You have no challenge running. Choose something from your
              wishlist or browse the offers to start one.
            </p>
          )}
        </Card>
      </div>

      {earned.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold tracking-tight">Earned</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {earned.map((c) => (
              <li key={c.id} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <p className="font-semibold">{offerById.get(c.campaignId)?.product.name}</p>
                <p className="mt-1 text-sm text-zinc-600">
                  Size {c.size} · code{" "}
                  <span className="font-mono font-semibold text-zinc-950">
                    {codes.find((r) => r.challengeId === c.id)?.code}
                  </span>
                </p>
                <Link href={`/member/challenges/${c.id}`} className="mt-3 inline-block text-sm font-semibold underline">
                  How to redeem
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <h2 className="text-xl font-bold tracking-tight">Wishlist</h2>
        {wanted.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-600">
            Nothing here yet.{" "}
            <Link href="/member/offers" className="font-semibold underline">Browse offers</Link>{" "}
            and add the gear you want.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {wanted.map((offer) => (
              <OfferCard
                key={offer.campaign.id}
                offer={offer}
                target={buildTarget(isTierId(offer.campaign.tier) ? offer.campaign.tier : 1, baseline)}
                footer={
                  <>
                    {isOpen(offer.campaign, today) ? (
                      <Link href={`/member/offers/${offer.campaign.id}`} className={btn("primary")}>
                        Go for it
                      </Link>
                    ) : (
                      <Pill>No longer open</Pill>
                    )}
                    <form action={toggleWishlist}>
                      <input type="hidden" name="campaignId" value={offer.campaign.id} />
                      <button className={btn("secondary")}>Remove</button>
                    </form>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-bold tracking-tight">Past challenges</h2>
          <ul className="mt-4 divide-y divide-zinc-200 rounded-2xl border border-zinc-200 bg-white">
            {past.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <Link href={`/member/challenges/${c.id}`} className="font-medium hover:underline">
                  {offerById.get(c.campaignId)?.product.name}
                </Link>
                <Pill>{PAST_LABELS[c.status]}</Pill>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
