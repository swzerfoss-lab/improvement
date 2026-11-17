import { eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OfferCard } from "@/components/offer";
import { btn, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { memberProfiles, wishlistItems } from "@/db/schema";
import { buildTarget, isTierId } from "@/engine/tiers";
import { getConnection, memberToday } from "@/lib/activity";
import { requireRole } from "@/lib/auth";
import { listOffers } from "@/lib/campaigns";
import { currentBaseline } from "@/lib/challenges";
import { toggleWishlist } from "../actions";

export default async function OffersPage() {
  const user = await requireRole("member");
  const conn = await getConnection(user.id);
  if (!conn) redirect("/member/connect");
  const today = memberToday(conn);

  const [[profile], baseline, wishlist] = await Promise.all([
    db.select().from(memberProfiles).where(eq(memberProfiles.userId, user.id)),
    currentBaseline(user.id, today),
    db
      .select({ campaignId: wishlistItems.campaignId })
      .from(wishlistItems)
      .where(eq(wishlistItems.memberId, user.id)),
  ]);
  const offers = await listOffers(today, profile);
  const wished = new Set(wishlist.map((w) => w.campaignId));

  return (
    <>
      <PageHeader
        title="Offers"
        subtitle="Gear that brands will give you for reaching a goal set from your own baseline. Bigger rewards take longer and ask for more."
      />
      {offers.length === 0 ? (
        <p className="text-sm text-zinc-600">
          No offers match your profile right now. Adding your sports and
          region under{" "}
          <Link href="/member/settings" className="font-semibold underline">Profile and privacy</Link>{" "}
          can unlock more.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <OfferCard
              key={offer.campaign.id}
              offer={offer}
              target={buildTarget(isTierId(offer.campaign.tier) ? offer.campaign.tier : 1, baseline)}
              footer={
                <>
                  <Link href={`/member/offers/${offer.campaign.id}`} className={btn("primary")}>
                    Details
                  </Link>
                  <form action={toggleWishlist}>
                    <input type="hidden" name="campaignId" value={offer.campaign.id} />
                    <button className={btn("secondary")}>
                      {wished.has(offer.campaign.id) ? "On your wishlist" : "Add to wishlist"}
                    </button>
                  </form>
                </>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
