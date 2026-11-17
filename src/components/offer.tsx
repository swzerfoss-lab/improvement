import Link from "next/link";
import { ActionForm, SubmitButton, type FormAction } from "@/components/action-form";
import type { ChallengeTarget } from "@/engine/types";
import type { Offer } from "@/lib/campaigns";
import { isTierId } from "@/engine/tiers";
import { money, TierBadge } from "./ui";

/** A personal target in one plain sentence. */
export function targetSentence(target: ChallengeTarget): string {
  const weeks =
    target.weeksRequired === target.weeks
      ? `for ${target.weeks} weeks`
      : `in ${target.weeksRequired} of ${target.weeks} weeks`;
  return `${target.weeklyMinutes} active minutes across at least ${target.activeDaysPerWeek} days a week, ${weeks}`;
}

export function OfferCard({
  offer,
  target,
  footer,
}: {
  offer: Offer;
  target: ChallengeTarget;
  footer?: React.ReactNode;
}) {
  const { campaign, product, brand } = offer;
  return (
    <article className="flex flex-col rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{brand.name}</p>
        {isTierId(campaign.tier) && <TierBadge tier={campaign.tier} />}
      </div>
      <h3 className="mt-2 text-lg font-semibold leading-snug">
        <Link href={`/member/offers/${campaign.id}`} className="hover:underline">
          {product.name}
        </Link>
      </h3>
      <p className="mt-1 text-sm text-zinc-500">
        Worth {money(product.retailValueCents)}
        {offer.totalLeft === 0 ? " · None available" : ` · ${offer.totalLeft} left`}
      </p>
      <p className="mt-4 flex-1 rounded-xl bg-zinc-50 p-3 text-sm text-zinc-700">
        <span className="font-semibold text-zinc-950">Earn it: </span>
        {targetSentence(target)}.
      </p>
      {footer && <div className="mt-4 flex flex-wrap items-center gap-2">{footer}</div>}
    </article>
  );
}

export function ConsentForm({
  brand,
  consent,
  action,
}: {
  brand: { id: string; name: string };
  consent: { shareProfile: boolean; shareEmail: boolean } | undefined;
  action: FormAction;
}) {
  return (
    <ActionForm action={action}>
      <input type="hidden" name="brandId" value={brand.id} />
      <div className="space-y-2 text-sm text-zinc-700">
        <label className="flex items-start gap-2">
          <input type="checkbox" name="shareProfile" defaultChecked={consent?.shareProfile} className="mt-0.5" />
          <span>
            Count my sports and region in {brand.name}&apos;s group insights.
            They see totals for groups of five or more, never me individually.
          </span>
        </label>
        <label className="flex items-start gap-2">
          <input type="checkbox" name="shareEmail" defaultChecked={consent?.shareEmail} className="mt-0.5" />
          <span>Share my name and email with {brand.name} so they can contact me.</span>
        </label>
      </div>
      <SubmitButton variant="secondary" className="mt-3">Save sharing choices</SubmitButton>
    </ActionForm>
  );
}
