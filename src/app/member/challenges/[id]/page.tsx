import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { ConsentForm, targetSentence } from "@/components/offer";
import { SimulatorBar } from "@/components/simulator-bar";
import { btn, Card, formatDay, PageHeader, Pill, ProgressBar, TierBadge } from "@/components/ui";
import { db } from "@/db";
import { brandConsents, brands, challenges, redemptions } from "@/db/schema";
import { MAX_PAUSE_DAYS } from "@/engine/evaluate";
import { DAILY_CREDIT_CAP } from "@/engine/tiers";
import type { WeekResult } from "@/engine/types";
import { getConnection, memberToday } from "@/lib/activity";
import { requireRole } from "@/lib/auth";
import { getOffers } from "@/lib/campaigns";
import { evaluate, syncAndEvaluate } from "@/lib/challenges";
import {
  pauseChallenge,
  resumeChallenge,
  saveConsent,
  withdrawChallenge,
} from "../../actions";

function weekStatus(week: WeekResult, today: string) {
  if (week.met) return <Pill tone="good">Met</Pill>;
  if (week.closed) return <Pill tone="bad">Missed</Pill>;
  if (week.start > today) return <Pill>Upcoming</Pill>;
  return <Pill tone="warn">In progress</Pill>;
}

export default async function ChallengePage({
  params,
}: PageProps<"/member/challenges/[id]">) {
  const user = await requireRole("member");
  const id = z.uuid().safeParse((await params).id);
  if (!id.success) notFound();
  const synced = await syncAndEvaluate(user.id);

  const [challenge] = await db
    .select()
    .from(challenges)
    .where(and(eq(challenges.id, id.data), eq(challenges.memberId, user.id)));
  if (!challenge) notFound();

  const conn = await getConnection(user.id);
  const today = memberToday(conn);
  const [offer] = await getOffers([challenge.campaignId]);
  const { product, brand } = offer;
  const [[brandRow], [consent], [redemption]] = await Promise.all([
    db.select({ website: brands.website }).from(brands).where(eq(brands.id, brand.id)),
    db
      .select()
      .from(brandConsents)
      .where(and(eq(brandConsents.memberId, user.id), eq(brandConsents.brandId, brand.id))),
    db.select().from(redemptions).where(eq(redemptions.challengeId, challenge.id)),
  ]);

  const { target, status } = challenge;
  const evaluation =
    status === "active" ? await evaluate(challenge, today) : challenge.evidence;
  const canPause = status === "active" && !challenge.pauseStart;
  const pauseOpen = status === "active" && evaluation?.paused;

  return (
    <>
      <Link href="/member" className="text-sm font-medium text-zinc-500 hover:text-zinc-950">
        ← My gear
      </Link>
      <div className="mt-4">
        <PageHeader
          title={product.name}
          subtitle={
            <span className="flex flex-wrap items-center gap-2">
              {brand.name} · size {challenge.size} <TierBadge tier={target.tier} />
            </span>
          }
        />
      </div>

      {conn?.provider === "simulator" && <SimulatorBar conn={conn} today={today} />}

      {!synced && (
        <p role="alert" className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
          We could not reach your wearable just now, so this may be out of
          date. Nothing is decided until we can sync again.
        </p>
      )}

      {status === "achieved" && redemption && (
        <Card className="mb-6 border-emerald-200 bg-emerald-50">
          <h2 className="text-xl font-bold">You earned it.</h2>
          <p className="mt-2 text-sm text-zinc-700">
            Enter this code at checkout on {brand.name}&apos;s store
            {brandRow?.website ? ` (${brandRow.website})` : ""} for your{" "}
            {product.name} in size {challenge.size}. The gear and shipping are
            free. The code works once.
          </p>
          <p className="mt-4 inline-block rounded-xl bg-white px-5 py-3 font-mono text-2xl font-bold tracking-widest">
            {redemption.code}
          </p>
          <p className="mt-3 text-xs text-zinc-600">
            Redeeming tells {brand.name} that you earned this reward. It does
            not share your activity.
          </p>
        </Card>
      )}

      {status === "in_review" && (
        <Card className="mb-6 border-amber-200 bg-amber-50">
          <h2 className="text-xl font-bold">Goal reached.</h2>
          <p className="mt-2 text-sm text-zinc-700">
            For a reward this size, a person checks the data before the code
            is issued. Your unit stays reserved while they do.
          </p>
        </Card>
      )}

      {status === "failed" && (
        <Card className="mb-6">
          <h2 className="text-xl font-bold">This one got away.</h2>
          <p className="mt-2 text-sm text-zinc-700">
            Too many weeks were missed to reach the goal, so the unit was
            released. Your baseline is still yours: you can commit to this or
            another offer again whenever you are ready.
          </p>
        </Card>
      )}

      {status === "rejected" && (
        <Card className="mb-6">
          <h2 className="text-xl font-bold">We could not approve this reward.</h2>
          <p className="mt-2 text-sm text-zinc-700">
            The check found the recorded activity did not support the goal,
            so the unit was released.
          </p>
        </Card>
      )}

      {status === "withdrawn" && (
        <Card className="mb-6">
          <p className="text-sm text-zinc-700">You withdrew from this challenge.</p>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-2">
          <h2 className="font-semibold">Your goal</h2>
          <p className="mt-1 text-sm text-zinc-700">{targetSentence(target)}.</p>

          {evaluation && (
            <>
              <p className="mt-4 text-3xl font-bold">
                {evaluation.weeksMet}
                <span className="text-lg font-medium text-zinc-500">
                  {" "}of {evaluation.weeksRequired} weeks met
                </span>
              </p>
              <ol className="mt-5 space-y-4">
                {evaluation.weeks.map((week) => (
                  <li key={week.index}>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
                      <span className="font-medium">
                        Week {week.index + 1}{" "}
                        <span className="font-normal text-zinc-500">
                          {formatDay(week.start)} to {formatDay(week.end)}
                        </span>
                      </span>
                      {weekStatus(week, today)}
                    </div>
                    <div className="mt-2">
                      <ProgressBar value={week.creditedMinutes} max={target.weeklyMinutes} />
                    </div>
                    <p className="mt-1 text-xs text-zinc-600">
                      {week.creditedMinutes} of {target.weeklyMinutes} minutes ·{" "}
                      {week.activeDays} of {target.activeDaysPerWeek} active days
                    </p>
                  </li>
                ))}
              </ol>

              <ul className="mt-5 space-y-1 text-xs text-zinc-500">
                {evaluation.flags.manualMinutesExcluded > 0 && (
                  <li>
                    {evaluation.flags.manualMinutesExcluded} typed-in minutes
                    were not counted. Only device-recorded activity counts.
                  </li>
                )}
                {target.requiresHeartRate && evaluation.flags.daysWithoutHeartRate > 0 && (
                  <li>
                    {evaluation.flags.daysWithoutHeartRate} active days had no
                    supporting heart-rate data and were not counted.
                  </li>
                )}
                {evaluation.flags.daysOverCap > 0 && (
                  <li>
                    {evaluation.flags.daysOverCap} days went over the{" "}
                    {DAILY_CREDIT_CAP}-minute daily limit. The extra was not counted.
                  </li>
                )}
              </ul>
            </>
          )}
        </Card>

        <div className="space-y-6">
          {status === "active" && (
            <Card>
              <h2 className="font-semibold">Need a break?</h2>
              {pauseOpen ? (
                <>
                  <p className="mt-1 text-sm text-zinc-600">
                    Paused since {formatDay(challenge.pauseStart!)}. Paused
                    days do not count, and the pause ends by itself after{" "}
                    {MAX_PAUSE_DAYS} days.
                  </p>
                  <form action={resumeChallenge} className="mt-3">
                    <input type="hidden" name="challengeId" value={challenge.id} />
                    <button className={btn("primary")}>Resume</button>
                  </form>
                </>
              ) : canPause ? (
                <>
                  <p className="mt-1 text-sm text-zinc-600">
                    Injured or ill? Pause once for up to {MAX_PAUSE_DAYS} days.
                    Your weeks pick up where they left off.
                  </p>
                  <form action={pauseChallenge} className="mt-3">
                    <input type="hidden" name="challengeId" value={challenge.id} />
                    <button className={btn("secondary")}>Pause challenge</button>
                  </form>
                </>
              ) : (
                <p className="mt-1 text-sm text-zinc-600">
                  You have used this challenge&apos;s pause.
                </p>
              )}
              <form action={withdrawChallenge} className="mt-4 border-t border-zinc-200 pt-4">
                <button className={btn("danger")}>Withdraw and release my unit</button>
              </form>
            </Card>
          )}

          <Card>
            <h2 className="font-semibold">Sharing with {brand.name}</h2>
            <p className="mt-1 text-sm text-zinc-600">
              Both are off unless you turn them on. Your activity is never
              shared either way.
            </p>
            <div className="mt-3">
              <ConsentForm brand={brand} consent={consent} action={saveConsent} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
