/**
 * Exercises the Google Health client against a stand-in for Google's
 * endpoints. It proves our side of the exchange (token storage, refresh,
 * paging, the request we send); it cannot prove Google answers this way.
 * Needs Postgres (DATABASE_URL) and is skipped without it.
 */
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const hasDb = Boolean(process.env.DATABASE_URL);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });

const run = (name: string, day: number, minutes: number) => ({
  name: `users/1/dataTypes/exercise/dataPoints/${name}`,
  exercise: {
    exerciseType: "RUNNING",
    activeDuration: `${minutes * 60}s`,
    interval: { civilStartTime: { date: { year: 2026, month: 3, day } } },
    metricsSummary: { averageHeartRateBeatsPerMinute: "140" },
  },
});

describe.skipIf(!hasDb)("Google Health client", () => {
  let db: typeof import("@/db").db;
  let schema: typeof import("@/db/schema");
  let google: typeof import("./google-health");
  let crypto: typeof import("@/lib/crypto");
  const userIds: string[] = [];

  beforeAll(async () => {
    process.env.GOOGLE_CLIENT_ID = "client-id";
    process.env.GOOGLE_CLIENT_SECRET = "client-secret";
    process.env.APP_URL = "https://app.test";
    process.env.TOKEN_ENCRYPTION_KEY = "test-key";
    ({ db } = await import("@/db"));
    schema = await import("@/db/schema");
    google = await import("./google-health");
    crypto = await import("@/lib/crypto");
  });

  afterEach(() => vi.unstubAllGlobals());

  afterAll(async () => {
    await db.delete(schema.users).where(inArray(schema.users.id, userIds));
    await db.$client.end();
  });

  async function newConnection(tokenExpiresAt: Date) {
    const [{ id }] = await db
      .insert(schema.users)
      .values({ email: `${randomUUID()}@test.invalid`, passwordHash: "x", role: "member" })
      .returning({ id: schema.users.id });
    userIds.push(id);
    const [conn] = await db
      .insert(schema.sourceConnections)
      .values({
        memberId: id,
        provider: "google_health",
        externalUserId: randomUUID(),
        connectedOn: "2026-03-01",
        accessTokenEnc: crypto.encrypt("old-access"),
        refreshTokenEnc: crypto.encrypt("refresh-1"),
        tokenExpiresAt,
      })
      .returning();
    return conn;
  }

  it("stores tokens encrypted and reads them back", () => {
    const sealed = crypto.encrypt("secret-token");
    expect(sealed).not.toContain("secret-token");
    expect(crypto.decrypt(sealed)).toBe("secret-token");
    expect(crypto.encrypt("secret-token")).not.toBe(sealed);
  });

  it("asks Google for offline, read-only access to activity", () => {
    const url = new URL(google.authorizationUrl("state-1"));
    expect(Object.fromEntries(url.searchParams)).toEqual({
      client_id: "client-id",
      redirect_uri: "https://app.test/api/sources/google/callback",
      response_type: "code",
      scope: "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly",
      access_type: "offline",
      prompt: "consent",
      state: "state-1",
    });
  });

  it("exchanges the code and returns encrypted tokens with the account id", async () => {
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "https://oauth2.googleapis.com/token") {
        const body = init!.body as URLSearchParams;
        expect(body.get("grant_type")).toBe("authorization_code");
        expect(body.get("code")).toBe("code-1");
        return json({ access_token: "access-1", refresh_token: "refresh-1", expires_in: 3600 });
      }
      expect(url).toBe("https://health.googleapis.com/v4/users/me/identity");
      expect(new Headers(init!.headers).get("authorization")).toBe("Bearer access-1");
      return json({ name: "users/me/identity", healthUserId: "health-user-1" });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { tokens, healthUserId } = await google.completeAuthorization("code-1");
    expect(healthUserId).toBe("health-user-1");
    expect(crypto.decrypt(tokens.accessTokenEnc)).toBe("access-1");
    expect(crypto.decrypt(tokens.refreshTokenEnc)).toBe("refresh-1");
    expect(tokens.tokenExpiresAt.getTime()).toBeGreaterThan(Date.now() + 3_500_000);
  });

  it("refuses a grant that comes without a refresh token", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ access_token: "a", expires_in: 3600 })));
    await expect(google.completeAuthorization("code-1")).rejects.toThrow("refresh token");
  });

  it("refreshes an expired token, saves it, and follows every page", async () => {
    const conn = await newConnection(new Date(Date.now() - 1000));
    const requests: URL[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL, init?: RequestInit) => {
        const url = new URL(String(input));
        if (url.href === "https://oauth2.googleapis.com/token") {
          const body = init!.body as URLSearchParams;
          expect(body.get("grant_type")).toBe("refresh_token");
          expect(body.get("refresh_token")).toBe("refresh-1");
          return json({ access_token: "new-access", expires_in: 3600 });
        }
        expect(new Headers(init!.headers).get("authorization")).toBe("Bearer new-access");
        requests.push(url);
        const wearable = url.searchParams.get("dataSourceFamily")!.endsWith("google-wearables");
        const second = url.searchParams.get("pageToken") === "page-2";
        if (second) return json({ dataPoints: [run("b", 3, 20)] });
        return json({
          dataPoints: wearable ? [run("a", 2, 30)] : [run("a", 2, 30), run("typed", 2, 60)],
          nextPageToken: "page-2",
        });
      }),
    );

    const days = await google.googleHealth.fetchDaily(conn, "2026-03-01", "2026-03-03");
    expect(days).toEqual([
      { date: "2026-03-01", activeMinutes: 0, manualMinutes: 0, avgHeartRate: null },
      { date: "2026-03-02", activeMinutes: 30, manualMinutes: 60, avgHeartRate: 140 },
      { date: "2026-03-03", activeMinutes: 20, manualMinutes: 0, avgHeartRate: 140 },
    ]);

    expect(requests).toHaveLength(4);
    expect(requests[0].pathname).toBe("/v4/users/me/dataTypes/exercise/dataPoints");
    expect(requests[0].searchParams.get("filter")).toBe(
      'exercise.interval.civil_start_time >= "2026-03-01" AND exercise.interval.civil_start_time < "2026-03-04"',
    );

    const [saved] = await db
      .select()
      .from(schema.sourceConnections)
      .where(eq(schema.sourceConnections.id, conn.id));
    expect(crypto.decrypt(saved.accessTokenEnc!)).toBe("new-access");
    expect(crypto.decrypt(saved.refreshTokenEnc!)).toBe("refresh-1");
    expect(saved.tokenExpiresAt!.getTime()).toBeGreaterThan(Date.now());
  });

  it("uses a token that is still valid without refreshing", async () => {
    const conn = await newConnection(new Date(Date.now() + 30 * 60_000));
    const fetchMock = vi.fn(async (input: string | URL, init?: RequestInit) => {
      expect(String(input)).toContain("health.googleapis.com");
      expect(new Headers(init!.headers).get("authorization")).toBe("Bearer old-access");
      return json({});
    });
    vi.stubGlobal("fetch", fetchMock);
    await google.googleHealth.fetchDaily(conn, "2026-03-01", "2026-03-01");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("fails the sync rather than guessing when Google rejects the request", async () => {
    const conn = await newConnection(new Date(Date.now() + 30 * 60_000));
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: {} }, 403)));
    await expect(
      google.googleHealth.fetchDaily(conn, "2026-03-01", "2026-03-01"),
    ).rejects.toThrow("403");
  });

  it("lets one Google account back only one member", async () => {
    const first = await newConnection(new Date());
    const [{ id }] = await db
      .insert(schema.users)
      .values({ email: `${randomUUID()}@test.invalid`, passwordHash: "x", role: "member" })
      .returning({ id: schema.users.id });
    userIds.push(id);
    const inserted = await db
      .insert(schema.sourceConnections)
      .values({
        memberId: id,
        provider: "google_health",
        externalUserId: first.externalUserId,
        connectedOn: "2026-03-01",
      })
      .onConflictDoNothing()
      .returning();
    expect(inserted).toEqual([]);
  });
});
