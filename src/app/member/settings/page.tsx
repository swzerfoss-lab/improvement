import { eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { ConsentForm } from "@/components/offer";
import { btn, Card, formatDay, input, label, PageHeader } from "@/components/ui";
import { db } from "@/db";
import {
  brandConsents,
  brands,
  campaigns,
  challenges,
  memberProfiles,
  wishlistItems,
} from "@/db/schema";
import { getConnection } from "@/lib/activity";
import { requireRole } from "@/lib/auth";
import { REGIONS, SIZES, SPORTS } from "@/lib/constants";
import { isPersona, PERSONAS } from "@/sources/simulator";
import {
  deleteAccount,
  disconnectSource,
  saveConsent,
  saveProfile,
} from "../actions";

const PROVIDER_NAMES: Record<string, string> = {
  simulator: "Simulated wearable",
  google_health: "Google Health (Fitbit and Pixel Watch)",
};

/** Brands the member has a relationship with: a consent, a wish or a challenge. */
async function relatedBrands(memberId: string) {
  const [consents, wished, challenged] = await Promise.all([
    db.select().from(brandConsents).where(eq(brandConsents.memberId, memberId)),
    db
      .select({ brandId: campaigns.brandId })
      .from(wishlistItems)
      .innerJoin(campaigns, eq(campaigns.id, wishlistItems.campaignId))
      .where(eq(wishlistItems.memberId, memberId)),
    db
      .select({ brandId: campaigns.brandId })
      .from(challenges)
      .innerJoin(campaigns, eq(campaigns.id, challenges.campaignId))
      .where(eq(challenges.memberId, memberId)),
  ]);
  const ids = [
    ...new Set([...consents, ...wished, ...challenged].map((r) => r.brandId)),
  ];
  const list = ids.length
    ? await db
        .select({ id: brands.id, name: brands.name })
        .from(brands)
        .where(inArray(brands.id, ids))
        .orderBy(brands.name)
    : [];
  return list.map((brand) => ({
    brand,
    consent: consents.find((c) => c.brandId === brand.id),
  }));
}

export default async function SettingsPage({
  searchParams,
}: PageProps<"/member/settings">) {
  const user = await requireRole("member");
  const welcome = (await searchParams).welcome === "1";
  const [[profile], conn, related] = await Promise.all([
    db.select().from(memberProfiles).where(eq(memberProfiles.userId, user.id)),
    getConnection(user.id),
    relatedBrands(user.id),
  ]);

  return (
    <>
      <PageHeader
        title={welcome ? "Connected. Now tell us about you." : "Profile and privacy"}
        subtitle={
          welcome
            ? "Brands aim offers by sport and region, and your sizes are pre-selected when you commit. All of it is optional."
            : "What you tell us, what you share, and how to take it all back."
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="font-semibold">Your profile</h2>
          <ActionForm action={saveProfile} className="mt-4 space-y-4">
            {welcome && <input type="hidden" name="next" value="home" />}
            <div>
              <label className={label} htmlFor="displayName">Name</label>
              <input className={input} id="displayName" name="displayName" defaultValue={profile.displayName} required />
            </div>
            <fieldset>
              <legend className={label}>Sports you do</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {SPORTS.map((sport) => (
                  <label
                    key={sport}
                    className="cursor-pointer rounded-full border border-zinc-300 px-3 py-1 text-sm capitalize has-[:checked]:border-zinc-950 has-[:checked]:bg-zinc-950 has-[:checked]:text-white has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-lime-400"
                  >
                    <input
                      type="checkbox"
                      name="sports"
                      value={sport}
                      defaultChecked={profile.sports.includes(sport)}
                      className="sr-only"
                    />
                    {sport}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={label} htmlFor="region">Region</label>
                <select className={input} id="region" name="region" defaultValue={profile.region ?? ""}>
                  <option value="">Not set</option>
                  {REGIONS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="apparelSize">Clothing size</label>
                <select className={input} id="apparelSize" name="apparelSize" defaultValue={profile.apparelSize ?? ""}>
                  <option value="">Not set</option>
                  {SIZES.apparel.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="shoeSize">Shoe size (US)</label>
                <select className={input} id="shoeSize" name="shoeSize" defaultValue={profile.shoeSize ?? ""}>
                  <option value="">Not set</option>
                  {SIZES.shoe.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <SubmitButton>{welcome ? "Save and continue" : "Save profile"}</SubmitButton>
          </ActionForm>
        </Card>

        <div className="space-y-6">
          <Card>
            <h2 className="font-semibold">Your wearable</h2>
            {conn ? (
              <>
                <p className="mt-2 text-sm text-zinc-700">
                  {PROVIDER_NAMES[conn.provider] ?? conn.provider}
                  {conn.simulatorPersona && isPersona(conn.simulatorPersona)
                    ? ` · ${PERSONAS[conn.simulatorPersona].label}`
                    : ""}
                  , connected {formatDay(conn.connectedOn)}.
                </p>
                <p className="mt-2 text-sm text-zinc-600">
                  Disconnecting deletes the activity we hold and withdraws you
                  from any running challenge. Rewards you already earned stay
                  yours.
                </p>
                <form action={disconnectSource} className="mt-3">
                  <button className={btn("danger")}>Disconnect and delete activity</button>
                </form>
              </>
            ) : (
              <p className="mt-2 text-sm text-zinc-600">
                Nothing connected.{" "}
                <Link href="/member/connect" className="font-semibold underline">Connect a wearable</Link>
              </p>
            )}
          </Card>

          <Card>
            <h2 className="font-semibold">Sharing with brands</h2>
            {related.length === 0 ? (
              <p className="mt-2 text-sm text-zinc-600">
                You are not sharing anything with any brand. Sharing choices
                appear here once you wishlist or commit to a brand&apos;s offer.
              </p>
            ) : (
              <ul className="mt-3 space-y-5">
                {related.map(({ brand, consent }) => (
                  <li key={brand.id}>
                    <p className="text-sm font-semibold">{brand.name}</p>
                    <div className="mt-2">
                      <ConsentForm brand={brand} consent={consent} action={saveConsent} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <h2 className="font-semibold">Delete my account</h2>
            <p className="mt-2 text-sm text-zinc-600">
              Removes your profile, activity, goals, wishlist and sharing
              choices for good. Codes you were already issued keep working at
              the brand&apos;s store.
            </p>
            <ActionForm action={deleteAccount} className="mt-3">
              <label className={label} htmlFor="confirm">Type DELETE to confirm</label>
              <input className={input} id="confirm" name="confirm" autoComplete="off" />
              <SubmitButton variant="danger" className="mt-3">Delete everything</SubmitButton>
            </ActionForm>
          </Card>
        </div>
      </div>
    </>
  );
}
