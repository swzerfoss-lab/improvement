"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/action-form";
import { db } from "@/db";
import { brands, memberProfiles, users } from "@/db/schema";
import { audit } from "@/lib/audit";
import {
  createSession,
  destroySession,
  hashPassword,
  homeFor,
  verifyPassword,
} from "@/lib/auth";

const credentials = {
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email address.")),
  password: z.string().min(10, "Use a password of at least 10 characters."),
};

const memberSignup = z.object({
  ...credentials,
  displayName: z.string().trim().min(1, "Enter your name.").max(80),
  adult: z.literal("on", "You must be 18 or older to join."),
});

const brandSignup = z.object({
  ...credentials,
  brandName: z.string().trim().min(1, "Enter your brand's name.").max(80),
  website: z.string().trim().max(200).optional(),
});

const firstError = (error: z.ZodError) => ({ error: error.issues[0].message });

export async function signUp(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const fields = Object.fromEntries(formData);
  const role = fields.role === "brand" ? "brand" : "member";
  const parsed =
    role === "brand" ? brandSignup.safeParse(fields) : memberSignup.safeParse(fields);
  if (!parsed.success) return firstError(parsed.error);
  const data = parsed.data;

  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, data.email));
  if (existing) return { error: "An account with that email already exists." };

  const passwordHash = await hashPassword(data.password);
  const userId = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ email: data.email, passwordHash, role })
      .returning({ id: users.id });
    if ("brandName" in data) {
      await tx.insert(brands).values({
        ownerUserId: user.id,
        name: data.brandName,
        website: data.website || null,
      });
    } else {
      await tx.insert(memberProfiles).values({
        userId: user.id,
        displayName: data.displayName,
        adultConfirmedAt: new Date(),
      });
    }
    await audit(user.id, "account.created", { role }, tx);
    return user.id;
  });

  await createSession(userId);
  redirect(homeFor(role));
}

export async function logIn(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "That email and password do not match an account." };
  }
  await createSession(user.id);
  redirect(homeFor(user.role));
}

export async function logOut(): Promise<void> {
  await destroySession();
  redirect("/");
}
