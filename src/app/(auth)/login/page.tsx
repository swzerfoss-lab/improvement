import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, input, label } from "@/components/ui";
import { getUser, homeFor } from "@/lib/auth";
import { logIn } from "../actions";

export default async function LoginPage() {
  const user = await getUser();
  if (user) redirect(homeFor(user.role));

  return (
    <main className="mx-auto w-full max-w-md px-6 py-16">
      <Card>
        <h1 className="text-2xl font-bold tracking-tight">Log in</h1>
        <ActionForm action={logIn} className="mt-6 space-y-4">
          <div>
            <label className={label} htmlFor="email">Email</label>
            <input className={input} id="email" name="email" type="email" autoComplete="email" required />
          </div>
          <div>
            <label className={label} htmlFor="password">Password</label>
            <input className={input} id="password" name="password" type="password" autoComplete="current-password" required />
          </div>
          <SubmitButton className="w-full">Log in</SubmitButton>
        </ActionForm>
        <p className="mt-6 text-sm text-zinc-600">
          New here?{" "}
          <Link className="font-semibold text-zinc-950 underline" href="/signup">
            Create an account
          </Link>
        </p>
      </Card>
    </main>
  );
}
