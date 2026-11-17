import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, input, label } from "@/components/ui";
import { getUser, homeFor } from "@/lib/auth";
import { signUp } from "../actions";

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const user = await getUser();
  if (user) redirect(homeFor(user.role));
  const isBrand = (await searchParams).role === "brand";

  const tab = (active: boolean) =>
    `flex-1 rounded-full px-4 py-2 text-center text-sm font-semibold ${
      active ? "bg-zinc-950 text-white" : "text-zinc-600 hover:text-zinc-950"
    }`;

  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <Card>
        <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
        <div className="mt-6 flex rounded-full bg-zinc-100 p-1">
          <Link className={tab(!isBrand)} href="/signup">I want to earn gear</Link>
          <Link className={tab(isBrand)} href="/signup?role=brand">I represent a brand</Link>
        </div>

        <ActionForm action={signUp} className="mt-6 space-y-4">
          <input type="hidden" name="role" value={isBrand ? "brand" : "member"} />
          {isBrand ? (
            <>
              <div>
                <label className={label} htmlFor="brandName">Brand name</label>
                <input className={input} id="brandName" name="brandName" required />
              </div>
              <div>
                <label className={label} htmlFor="website">Store website (optional)</label>
                <input className={input} id="website" name="website" placeholder="https://" />
              </div>
            </>
          ) : (
            <div>
              <label className={label} htmlFor="displayName">Your name</label>
              <input className={input} id="displayName" name="displayName" autoComplete="name" required />
            </div>
          )}
          <div>
            <label className={label} htmlFor="email">Email</label>
            <input className={input} id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <label className={label} htmlFor="password">Password</label>
            <input className={input} id="password" name="password" type="password" autoComplete="new-password" minLength={10} required />
            <p className="mt-1 text-xs text-zinc-500">At least 10 characters.</p>
          </div>
          {!isBrand && (
            <label className="flex items-start gap-2 text-sm text-zinc-700">
              <input type="checkbox" name="adult" className="mt-0.5" required />
              I am 18 or older.
            </label>
          )}
          <SubmitButton className="w-full">Create account</SubmitButton>
        </ActionForm>

        <p className="mt-6 text-sm text-zinc-600">
          Already have an account?{" "}
          <Link className="font-semibold text-zinc-950 underline" href="/login">Log in</Link>
        </p>
      </Card>
    </main>
  );
}
