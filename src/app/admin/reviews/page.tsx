import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { targetSentence } from "@/components/offer";
import { btn, Card, formatDay, PageHeader, TierBadge } from "@/components/ui";
import { db } from "@/db";
import { baselines, brands, campaigns, challenges, products } from "@/db/schema";
import { DAILY_CREDIT_CAP } from "@/engine/tiers";
import { getUser, isAdmin } from "@/lib/auth";
import { decide } from "./actions";

/**
 * The human check for high-value rewards. The reviewer sees the evidence
 * the engine recorded, not who the member is.
 */
export default async function ReviewsPage() {
  const user = await getUser();
  if (!user || !isAdmin(user)) notFound();

  const queue = await db
    .select({
      challenge: challenges,
      baseline: baselines,
      productName: products.name,
      brandName: brands.name,
    })
    .from(challenges)
    .innerJoin(baselines, eq(baselines.id, challenges.baselineId))
    .innerJoin(campaigns, eq(campaigns.id, challenges.campaignId))
    .innerJoin(products, eq(products.id, campaigns.productId))
    .innerJoin(brands, eq(brands.id, campaigns.brandId))
    .where(eq(challenges.status, "in_review"))
    .orderBy(asc(challenges.createdAt));

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <PageHeader
        title="Reviews"
        subtitle="Goals reached on the top tier wait here until a person confirms the data looks like real training."
      />
      {queue.length === 0 && <p className="text-sm text-zinc-600">Nothing is waiting for review.</p>}
      <div className="space-y-6">
        {queue.map(({ challenge, baseline, productName, brandName }) => {
          const evidence = challenge.evidence;
          return (
            <Card key={challenge.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-semibold">
                  {productName} <span className="font-normal text-zinc-500">· {brandName}</span>
                </h2>
                <TierBadge tier={challenge.target.tier} />
              </div>
              <p className="mt-2 text-sm text-zinc-700">
                Goal: {targetSentence(challenge.target)}. Baseline at commit:{" "}
                {baseline.weeklyMinutes} minutes a week over{" "}
                {baseline.activeDaysPerWeek.toFixed(1)} active days, from{" "}
                {baseline.daysWithData} days of history.
              </p>

              {evidence && (
                <>
                  <table className="mt-4 w-full text-left text-sm">
                    <thead className="text-zinc-500">
                      <tr>
                        <th className="py-1 font-medium">Week</th>
                        <th className="py-1 font-medium">Dates</th>
                        <th className="py-1 font-medium">Credited minutes</th>
                        <th className="py-1 font-medium">Active days</th>
                        <th className="py-1 font-medium">Met</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {evidence.weeks.map((week) => (
                        <tr key={week.index}>
                          <td className="py-1">{week.index + 1}</td>
                          <td className="py-1">{formatDay(week.start)} to {formatDay(week.end)}</td>
                          <td className="py-1">{week.creditedMinutes}</td>
                          <td className="py-1">{week.activeDays}</td>
                          <td className="py-1">{week.met ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <ul className="mt-4 space-y-1 text-sm text-zinc-700">
                    <li>Typed-in minutes excluded: {evidence.flags.manualMinutesExcluded}</li>
                    <li>Days over the {DAILY_CREDIT_CAP}-minute cap: {evidence.flags.daysOverCap}</li>
                    <li>Active days without heart-rate support: {evidence.flags.daysWithoutHeartRate}</li>
                  </ul>
                </>
              )}

              <form action={decide} className="mt-5 flex gap-2">
                <input type="hidden" name="challengeId" value={challenge.id} />
                <button name="decision" value="approve" className={btn("primary")}>
                  Approve and issue code
                </button>
                <button name="decision" value="reject" className={btn("danger")}>
                  Reject
                </button>
              </form>
            </Card>
          );
        })}
      </div>
    </main>
  );
}
