"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getUser, isAdmin } from "@/lib/auth";
import { decideReview } from "@/lib/challenges";

export async function decide(formData: FormData): Promise<void> {
  const user = await getUser();
  if (!user || !isAdmin(user)) redirect("/");
  const challengeId = z.uuid().parse(formData.get("challengeId"));
  const decision = z.enum(["approve", "reject"]).parse(formData.get("decision"));
  await decideReview(user.id, challengeId, decision === "approve");
  refresh();
}
