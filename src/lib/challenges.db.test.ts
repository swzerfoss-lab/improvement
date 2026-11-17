/**
 * Runs against a real Postgres (DATABASE_URL) because the behaviour under
 * test is transactional. Skipped when no database is configured.
 */
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { TierId } from "@/engine/types";
import type { Persona } from "@/sources/simulator";

const hasDb = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDb)("challenges against Postgres", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let lib: typeof import("./challenges");
  let campaignsLib: typeof import("./campaigns");
  const userIds: string[] = [];
  let brandId: string;

  beforeAll(async () => {
    process.env.ENABLE_SIMULATOR = "true";
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    lib = await import("./challenges");
    campaignsLib = await import("./campaigns");

    const owner = await newUser("brand");
    [{ id: brandId }] = await db
      .insert(schema.brands)
      .values({ ownerUserId: owner, name: "Test Brand" })
      .returning({ id: schema.brands.id });
  });

  afterAll(async () => {
    // Deleting the users cascades to everything the tests created.
    await db.delete(schema.users).where(inArray(schema.users.id, userIds));
    await db.$client.end();
  });

  async function newUser(role: "member" | "brand"): Promise<string> {
    const [{ id }] = await db
      .insert(schema.users)
      .values({ email: `${randomUUID()}@test.invalid`, passwordHash: "x", role })
      .returning({ id: schema.users.id });
    userIds.push(id);
    return id;
  }

  async function newMember(persona: Persona): Promise<string> {
    const id = await newUser("member");
    await db.insert(schema.memberProfiles).values({
      userId: id,
      displayName: "Test Member",
      adultConfirmedAt: new Date(),
    });
    await db.insert(schema.sourceConnections).values({
      memberId: id,
      provider: "simulator",
      simulatorPersona: persona,
      connectedOn: new Date().toISOString().slice(0, 10),
    });
    return id;
  }

  async function newCampaign(opts: {
    tier: TierId;
    units: number;
    budgetCapCents?: number;
  }): Promise<string> {
    const [product] = await db
      .insert(schema.products)
      .values({
        brandId,
        name: "Test Tee",
        sizeType: "apparel",
        retailValueCents: 30_00,
        unitCostCents: 10_00,
      })
      .returning({ id: schema.products.id });
    const [campaign] = await db
      .insert(schema.campaigns)
      .values({
        brandId,
        productId: product.id,
        name: "Test campaign",
        tier: opts.tier,
        startsOn: "2000-01-01",
        endsOn: "2999-01-01",
        budgetCapCents: opts.budgetCapCents ?? 1000_00,
      })
      .returning({ id: schema.campaigns.id });
    await db
      .insert(schema.campaignInventory)
      .values({ campaignId: campaign.id, size: "M", quantity: opts.units });
    return campaign.id;
  }

  /** Moves a simulated member's clock forward and settles their challenge. */
  async function skip(memberId: string, days: number) {
    await db
      .update(schema.sourceConnections)
      .set({ clockOffsetDays: days })
      .where(eq(schema.sourceConnections.memberId, memberId));
    await lib.syncAndEvaluate(memberId);
  }

  const left = async (campaignId: string) =>
    (await campaignsLib.getOffers([campaignId]))[0].sizes[0].left;

  const statusOf = async (challengeId: string) =>
    (
      await db
        .select({ status: schema.challenges.status })
        .from(schema.challenges)
        .where(eq(schema.challenges.id, challengeId))
    )[0].status;

  const codesFor = (campaignId: string) =>
    db.select().from(schema.redemptions).where(eq(schema.redemptions.campaignId, campaignId));

  async function commitOk(memberId: string, campaignId: string): Promise<string> {
    const result = await lib.commitToChallenge(memberId, campaignId, "M");
    if ("error" in result) throw new Error(result.error);
    return result.challengeId;
  }

  it("reserves a unit on commit and issues one code when the goal is met", async () => {
    const campaign = await newCampaign({ tier: 1, units: 2 });
    const member = await newMember("beginner");

    const challenge = await commitOk(member, campaign);
    expect(await left(campaign)).toBe(1);

    await skip(member, 7);
    expect(await statusOf(challenge)).toBe("active");
    expect(await codesFor(campaign)).toHaveLength(0);

    await skip(member, 14);
    expect(await statusOf(challenge)).toBe("achieved");
    const codes = await codesFor(campaign);
    expect(codes).toHaveLength(1);
    expect(codes[0]).toMatchObject({ challengeId: challenge, size: "M" });
    expect(codes[0].code).toMatch(/^EA-[A-Z2-9]{5}-[A-Z2-9]{5}$/);

    // Settling again must not issue a second code, and the unit stays used.
    await lib.syncAndEvaluate(member);
    expect(await codesFor(campaign)).toHaveLength(1);
    expect(await left(campaign)).toBe(1);
  });

  it("gives the cheater nothing and puts the unit back on offer", async () => {
    const campaign = await newCampaign({ tier: 1, units: 1 });
    const member = await newMember("cheater");
    const challenge = await commitOk(member, campaign);
    expect(await left(campaign)).toBe(0);

    await skip(member, 30);
    expect(await statusOf(challenge)).toBe("failed");
    expect(await codesFor(campaign)).toHaveLength(0);
    expect(await left(campaign)).toBe(1);
  });

  it("never lets two members take the last unit", async () => {
    const campaign = await newCampaign({ tier: 1, units: 1 });
    const members = await Promise.all(
      Array.from({ length: 6 }, () => newMember("regular")),
    );
    const results = await Promise.all(
      members.map((m) => lib.commitToChallenge(m, campaign, "M")),
    );
    expect(results.filter((r) => "challengeId" in r)).toHaveLength(1);
    expect(results.filter((r) => "error" in r)).toHaveLength(5);
    expect(await left(campaign)).toBe(0);
  });

  it("stops at the budget cap even when units remain", async () => {
    // Ten units offered, but the cap pays for two at $10 each.
    const campaign = await newCampaign({ tier: 1, units: 10, budgetCapCents: 25_00 });
    await commitOk(await newMember("regular"), campaign);
    await commitOk(await newMember("regular"), campaign);
    const third = await lib.commitToChallenge(await newMember("regular"), campaign, "M");
    expect(third).toEqual({ error: "That size has just run out." });
  });

  it("allows one open challenge per member", async () => {
    const member = await newMember("regular");
    await commitOk(member, await newCampaign({ tier: 1, units: 1 }));
    const second = await lib.commitToChallenge(
      member,
      await newCampaign({ tier: 1, units: 1 }),
      "M",
    );
    expect(second).toEqual({
      error: "Finish or withdraw from your current challenge first.",
    });
  });

  it("holds top-tier goals for review and issues the code only on approval", async () => {
    const campaign = await newCampaign({ tier: 3, units: 2 });
    const reviewer = await newUser("member");

    const approved = await newMember("regular");
    const approvedChallenge = await commitOk(approved, campaign);
    await skip(approved, 84);
    expect(await statusOf(approvedChallenge)).toBe("in_review");
    expect(await codesFor(campaign)).toHaveLength(0);
    expect(await left(campaign)).toBe(1);

    await lib.decideReview(reviewer, approvedChallenge, true);
    expect(await statusOf(approvedChallenge)).toBe("achieved");
    expect(await codesFor(campaign)).toHaveLength(1);

    const rejected = await newMember("regular");
    const rejectedChallenge = await commitOk(rejected, campaign);
    await skip(rejected, 84);
    await lib.decideReview(reviewer, rejectedChallenge, false);
    expect(await statusOf(rejectedChallenge)).toBe("rejected");
    expect(await codesFor(campaign)).toHaveLength(1);
    expect(await left(campaign)).toBe(1);
  });

  it("keeps the brand's issued code when the member deletes their account", async () => {
    const campaign = await newCampaign({ tier: 1, units: 1 });
    const member = await newMember("regular");
    await commitOk(member, campaign);
    await skip(member, 14);
    expect(await codesFor(campaign)).toHaveLength(1);

    await db.delete(schema.users).where(eq(schema.users.id, member));
    const codes = await codesFor(campaign);
    expect(codes).toHaveLength(1);
    expect(codes[0].challengeId).toBeNull();
    expect(await left(campaign)).toBe(0);
  });
});
