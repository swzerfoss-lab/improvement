import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sourceConnections } from "@/db/schema";
import { addDays } from "@/engine/days";
import { decrypt, encrypt } from "@/lib/crypto";
import { fillDays, toDailyActivity, type ExercisePoint } from "./google-health-map";
import type { ActivitySource, SourceConnection } from "./types";

/**
 * Google Health API v4: Fitbit trackers and Pixel Watch.
 *
 * Reads exercise sessions only, under the single read-only activity scope.
 * Written from the published reference and discovery document; it has not
 * yet been run against a live Google account.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const API = "https://health.googleapis.com/v4";
const SCOPE = "https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly";
/** Exercise lists return 25 per page; this bounds a runaway pagination. */
const MAX_PAGES = 40;

export const CALLBACK_PATH = "/api/sources/google/callback";
export const STATE_COOKIE = "google_oauth_state";

export function googleHealthEnabled(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_CLIENT_SECRET &&
      process.env.APP_URL,
  );
}

const redirectUri = () => `${process.env.APP_URL}${CALLBACK_PATH}`;

export function authorizationUrl(state: string): string {
  const url = new URL(AUTH_URL);
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    // Both are needed for Google to return a refresh token.
    access_type: "offline",
    prompt: "consent",
    state,
  }).toString();
  return url.toString();
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
};

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...params,
    }),
  });
  if (!res.ok) throw new Error(`Google token request failed with ${res.status}`);
  return res.json();
}

export type GoogleTokens = {
  accessTokenEnc: string;
  refreshTokenEnc: string;
  tokenExpiresAt: Date;
};

const expiry = (expiresIn: number) => new Date(Date.now() + expiresIn * 1000);

/** Trades the OAuth code for tokens and the account's stable id. */
export async function completeAuthorization(
  code: string,
): Promise<{ tokens: GoogleTokens; healthUserId: string }> {
  const token = await tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(),
  });
  if (!token.refresh_token) throw new Error("Google returned no refresh token");

  const res = await fetch(`${API}/users/me/identity`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!res.ok) throw new Error(`Google identity request failed with ${res.status}`);
  const identity: { healthUserId?: string } = await res.json();
  if (!identity.healthUserId) throw new Error("Google returned no health user id");

  return {
    healthUserId: identity.healthUserId,
    tokens: {
      accessTokenEnc: encrypt(token.access_token),
      refreshTokenEnc: encrypt(token.refresh_token),
      tokenExpiresAt: expiry(token.expires_in),
    },
  };
}

async function accessToken(conn: SourceConnection): Promise<string> {
  if (!conn.accessTokenEnc || !conn.refreshTokenEnc) {
    throw new Error("Google Health connection has no tokens");
  }
  if (conn.tokenExpiresAt && conn.tokenExpiresAt.getTime() > Date.now() + 60_000) {
    return decrypt(conn.accessTokenEnc);
  }
  const token = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: decrypt(conn.refreshTokenEnc),
  });
  await db
    .update(sourceConnections)
    .set({
      accessTokenEnc: encrypt(token.access_token),
      tokenExpiresAt: expiry(token.expires_in),
    })
    .where(eq(sourceConnections.id, conn.id));
  return token.access_token;
}

async function listExercises(
  token: string,
  from: string,
  toExclusive: string,
  family: "google-wearables" | "all-sources",
): Promise<ExercisePoint[]> {
  const points: ExercisePoint[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const url = new URL(`${API}/users/me/dataTypes/exercise/dataPoints`);
    url.searchParams.set(
      "filter",
      `exercise.interval.civil_start_time >= "${from}" AND exercise.interval.civil_start_time < "${toExclusive}"`,
    );
    url.searchParams.set("dataSourceFamily", `users/me/dataSourceFamilies/${family}`);
    url.searchParams.set("pageSize", "25");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error(`Google Health API responded ${res.status}`);
    const body: { dataPoints?: ExercisePoint[]; nextPageToken?: string } = await res.json();
    points.push(...(body.dataPoints ?? []));
    pageToken = body.nextPageToken;
    if (!pageToken) return points;
  }
  throw new Error("Google Health API returned more pages than expected");
}

export const googleHealth: ActivitySource = {
  async fetchDaily(connection, from, to) {
    const token = await accessToken(connection);
    const toExclusive = addDays(to, 1);
    const [wearable, all] = await Promise.all([
      listExercises(token, from, toExclusive, "google-wearables"),
      listExercises(token, from, toExclusive, "all-sources"),
    ]);
    return fillDays(toDailyActivity(wearable, all), from, to);
  },
};

/** Best effort: tells Google to forget the grant when a member disconnects. */
export async function revokeGoogleAccess(conn: SourceConnection): Promise<void> {
  if (!conn.refreshTokenEnc) return;
  try {
    await fetch(REVOKE_URL, {
      method: "POST",
      body: new URLSearchParams({ token: decrypt(conn.refreshTokenEnc) }),
    });
  } catch (error) {
    console.error("Google token revocation failed", { connectionId: conn.id, error });
  }
}
