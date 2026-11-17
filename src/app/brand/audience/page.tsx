import { and, desc, eq } from "drizzle-orm";
import { Card, formatDay, PageHeader } from "@/components/ui";
import { db } from "@/db";
import { brandConsents, memberProfiles, users } from "@/db/schema";
import { requireBrand } from "@/lib/brand";

export default async function AudiencePage() {
  const { brand } = await requireBrand();
  const contacts = await db
    .select({
      name: memberProfiles.displayName,
      email: users.email,
      since: brandConsents.updatedAt,
    })
    .from(brandConsents)
    .innerJoin(users, eq(users.id, brandConsents.memberId))
    .innerJoin(memberProfiles, eq(memberProfiles.userId, brandConsents.memberId))
    .where(and(eq(brandConsents.brandId, brand.id), eq(brandConsents.shareEmail, true)))
    .orderBy(desc(brandConsents.updatedAt));

  return (
    <>
      <PageHeader
        title="Audience"
        subtitle="Members who chose to share their name and email with you. They can withdraw at any time, and then they leave this list."
      />
      <Card>
        {contacts.length === 0 ? (
          <p className="text-sm text-zinc-600">
            Nobody has opted in yet. Members are offered the choice when they
            commit to one of your campaigns and again when they earn the reward.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Email</th>
                <th className="py-2 font-medium">Choice updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {contacts.map((c) => (
                <tr key={c.email}>
                  <td className="py-2 font-medium">{c.name}</td>
                  <td className="py-2">{c.email}</td>
                  <td className="py-2">{formatDay(c.since.toISOString().slice(0, 10))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-4 text-xs text-zinc-500">
          This list says nothing about anyone&apos;s activity or whether they
          earned a reward.
        </p>
      </Card>
    </>
  );
}
