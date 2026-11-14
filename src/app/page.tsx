import Link from "next/link";
import { btn } from "@/components/ui";
import { TIERS, TIER_IDS } from "@/engine/tiers";

const STEPS = [
  {
    title: "Connect your wearable",
    body: "We read your activity history to learn your own starting point. A beginner and a marathoner get different goals.",
  },
  {
    title: "Pick the gear you want",
    body: "Build a wishlist from brands that want to back you. Each item shows exactly what earns it, and your size is held when you commit.",
  },
  {
    title: "Earn it",
    body: "Hit your personal goal and the gear is yours. Free, shipping included. The reward is the gear itself, not a discount.",
  },
];

const BRAND_POINTS = [
  {
    title: "Pay only for verified effort",
    body: "A reward costs you something only when a member's goal is verified. Unit and budget caps are hard limits.",
  },
  {
    title: "Earn the relationship",
    body: "See what members want through wishlists and reservations, and reach the ones who choose to hear from you.",
  },
  {
    title: "Move inventory with meaning",
    body: "Turn odd sizes and last season's stock into something a person worked for, instead of a markdown.",
  },
];

export default function Home() {
  return (
    <main>
      <section className="bg-zinc-950 text-white">
        <div className="mx-auto max-w-5xl px-6 py-24">
          <p className="text-sm font-semibold uppercase tracking-widest text-lime-300">
            Sponsorship for the rest of us
          </p>
          <h1 className="mt-4 max-w-3xl text-5xl font-bold tracking-tight sm:text-6xl">
            Pro athletes get sponsored. Now you can too.
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-zinc-300">
            Brands reward you with free gear for real progress against your own
            baseline. Not the fastest person. The person who showed up.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href="/signup" className={btn("accent")}>Start earning gear</Link>
            <Link href="/signup?role=brand" className={`${btn("secondary")} border-zinc-700 bg-transparent text-white hover:bg-zinc-900`}>
              Sponsor as a brand
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-2xl font-bold tracking-tight">How it works</h2>
        <ol className="mt-8 grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <li key={step.title} className="rounded-2xl border border-zinc-200 bg-white p-6">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-lime-300 text-sm font-bold">
                {i + 1}
              </span>
              <h3 className="mt-4 font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-zinc-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-zinc-200 bg-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-2xl font-bold tracking-tight">Bigger goals, bigger rewards</h2>
          <p className="mt-2 max-w-2xl text-zinc-600">
            Every goal is scaled to your own baseline. Rest days never count
            against you, and you can pause for an injury.
          </p>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {TIER_IDS.map((id) => {
              const tier = TIERS[id];
              return (
                <div key={id} className="rounded-2xl bg-zinc-50 p-6">
                  <p className="text-sm font-semibold text-zinc-500">Tier {id}</p>
                  <h3 className="mt-1 text-xl font-bold">{tier.name}</h3>
                  <p className="mt-2 text-sm text-zinc-600">{tier.summary}.</p>
                  <p className="mt-4 text-sm font-medium">
                    {tier.maxRetailCents === null
                      ? "Premium gear"
                      : `Gear worth up to $${tier.maxRetailCents / 100}`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-2xl font-bold tracking-tight">Your data stays yours</h2>
        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h3 className="font-semibold">What brands never see</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Your workouts, heart rate, minutes, or anything else from your
              wearable. We check your goal privately and tell the brand only
              that a reward was earned.
            </p>
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h3 className="font-semibold">What you can choose to share</h3>
            <p className="mt-2 text-sm text-zinc-600">
              Your sports and region, counted only inside group totals, and
              your email if you want to hear from a brand. Brand by brand,
              and you can change your mind.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-zinc-950 text-white">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-2xl font-bold tracking-tight">For brands</h2>
          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            {BRAND_POINTS.map((point) => (
              <div key={point.title}>
                <h3 className="font-semibold text-lime-300">{point.title}</h3>
                <p className="mt-2 text-sm text-zinc-300">{point.body}</p>
              </div>
            ))}
          </div>
          <Link href="/signup?role=brand" className={`${btn("accent")} mt-10`}>
            Create a campaign
          </Link>
        </div>
      </section>
    </main>
  );
}
