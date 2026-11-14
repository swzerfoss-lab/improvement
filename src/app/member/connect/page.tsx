import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";
import { DAILY_CREDIT_CAP } from "@/engine/tiers";
import { getConnection } from "@/lib/activity";
import { requireRole } from "@/lib/auth";
import { simulatorEnabled } from "@/sources";
import { googleHealthEnabled } from "@/sources/google-health";
import { PERSONAS } from "@/sources/simulator";
import { connectGoogleHealth, connectSimulator } from "../actions";

const WE_READ = [
  "Minutes of activity each day, as recorded by your device",
  "Whether each entry was recorded by the device or typed in by hand",
  "Your average heart rate while active",
];

const BRANDS_SEE = [
  "Counts with no names attached: wishlists, units reserved, rewards earned",
  "That you earned a reward, once you redeem your code at their store",
  "Your sports and region, inside group totals of five or more people, only for brands you choose",
  "Your name and email, only for brands you choose to hear from",
];

const BRANDS_NEVER_SEE = [
  "Your workouts, minutes, heart rate or baseline",
  "Whether you personally are part-way through, paused, or missed a goal",
];

const CONNECT_ERRORS: Record<string, string> = {
  declined: "Google did not share access, so nothing was connected.",
  taken: "That Google account is already connected to another member.",
  failed: "We could not connect to Google. Please try again.",
};

const CONSENT_LABEL =
  "I have read what you read and what brands see, and I agree to my activity being used to set and check my goals.";

function List({ items }: { items: string[] }) {
  return (
    <ul className="mt-3 space-y-2 text-sm text-zinc-700">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-400" />
          {item}
        </li>
      ))}
    </ul>
  );
}

export default async function ConnectPage({ searchParams }: PageProps<"/member/connect">) {
  const user = await requireRole("member");
  if (await getConnection(user.id)) redirect("/member");
  const { error } = await searchParams;
  const connectError = typeof error === "string" ? CONNECT_ERRORS[error] : undefined;

  return (
    <>
      <PageHeader
        title="Connect your wearable"
        subtitle="We use your activity for one thing: working out your personal goals and checking when you reach them."
      />

      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <h2 className="font-semibold">What we read</h2>
          <List items={WE_READ} />
          <p className="mt-4 text-xs text-zinc-500">
            Only device-recorded minutes count, up to {DAILY_CREDIT_CAP} a day.
            We do not read location, weight, sleep or anything else.
          </p>
        </Card>
        <Card>
          <h2 className="font-semibold">What brands see</h2>
          <List items={BRANDS_SEE} />
        </Card>
        <Card>
          <h2 className="font-semibold">What brands never see</h2>
          <List items={BRANDS_NEVER_SEE} />
          <p className="mt-4 text-xs text-zinc-500">
            You can disconnect or delete everything at any time under Profile
            and privacy.
          </p>
        </Card>
      </div>

      {connectError && (
        <p role="alert" className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {connectError}
        </p>
      )}

      {googleHealthEnabled() && (
        <Card className="mt-6">
          <h2 className="font-semibold">Fitbit or Pixel Watch</h2>
          <p className="mt-1 text-sm text-zinc-600">
            Connects through Google Health. Google will ask you to approve
            read-only access to your exercise sessions, and nothing else.
          </p>
          <ActionForm action={connectGoogleHealth} className="mt-4">
            <label className="flex items-start gap-2 text-sm text-zinc-700">
              <input type="checkbox" name="consent" className="mt-0.5" required />
              {CONSENT_LABEL}
            </label>
            <SubmitButton className="mt-5">Continue to Google</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {simulatorEnabled() && (
        <Card className="mt-6">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold">Simulated wearable</h2>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
              Demo data
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-600">
            Invented activity for trying the product. You can skip ahead in
            time to watch a challenge play out.
          </p>
          <ActionForm action={connectSimulator} className="mt-4">
            <fieldset className="grid gap-3 sm:grid-cols-3">
              <legend className="sr-only">Simulated athlete</legend>
              {Object.entries(PERSONAS).map(([id, persona], i) => (
                <label
                  key={id}
                  className="flex cursor-pointer gap-3 rounded-xl border border-zinc-200 p-4 has-[:checked]:border-zinc-950 has-[:checked]:bg-zinc-50"
                >
                  <input type="radio" name="persona" value={id} defaultChecked={i === 0} className="mt-1" />
                  <span>
                    <span className="block text-sm font-semibold">{persona.label}</span>
                    <span className="mt-1 block text-xs text-zinc-600">{persona.description}</span>
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="mt-5 flex items-start gap-2 text-sm text-zinc-700">
              <input type="checkbox" name="consent" className="mt-0.5" required />
              {CONSENT_LABEL}
            </label>
            <SubmitButton className="mt-5">Connect simulated wearable</SubmitButton>
          </ActionForm>
        </Card>
      )}

      {!simulatorEnabled() && !googleHealthEnabled() && (
        <Card className="mt-6">
          <p className="text-sm text-zinc-600">
            No wearable connections are available yet.
          </p>
        </Card>
      )}
    </>
  );
}
