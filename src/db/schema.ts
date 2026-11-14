import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  date,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { ChallengeTarget, Evaluation } from "@/engine/types";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const day = (name: string) => date(name, { mode: "string" });

export const roleEnum = pgEnum("role", ["member", "brand"]);

export const users = pgTable("users", {
  id: id(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  createdAt: createdAt(),
});

export const sessions = pgTable("sessions", {
  // SHA-256 of the cookie token, so a database leak does not leak sessions.
  id: text("id").primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

// ---------------------------------------------------------------- members

export const memberProfiles = pgTable("member_profiles", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  displayName: text("display_name").notNull(),
  adultConfirmedAt: timestamp("adult_confirmed_at", {
    withTimezone: true,
  }).notNull(),
  region: text("region"),
  sports: text("sports").array().notNull().default([]),
  apparelSize: text("apparel_size"),
  shoeSize: text("shoe_size"),
});

export const sourceConnections = pgTable("source_connections", {
  id: id(),
  // One source per member, so two devices can never double-count a workout.
  memberId: uuid("member_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  simulatorPersona: text("simulator_persona"),
  // Simulator only: lets a demo skip ahead in time.
  clockOffsetDays: integer("clock_offset_days").notNull().default(0),
  accessTokenEnc: text("access_token_enc"),
  refreshTokenEnc: text("refresh_token_enc"),
  tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
  connectedOn: day("connected_on").notNull(),
  // Last day (on the member's clock) that activity was fetched for.
  syncedThrough: day("synced_through"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
});

export const dailyActivity = pgTable(
  "daily_activity",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    date: day("date").notNull(),
    // Minutes recorded by the device itself.
    activeMinutes: integer("active_minutes").notNull(),
    // Minutes the member typed in. Stored for review, never credited.
    manualMinutes: integer("manual_minutes").notNull().default(0),
    avgHeartRate: integer("avg_heart_rate"),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.date] })],
);

// A snapshot, so a challenge's targets never move after the member commits.
export const baselines = pgTable("baselines", {
  id: id(),
  memberId: uuid("member_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  computedOn: day("computed_on").notNull(),
  weeklyMinutes: integer("weekly_minutes").notNull(),
  activeDaysPerWeek: real("active_days_per_week").notNull(),
  daysWithData: integer("days_with_data").notNull(),
});

// ----------------------------------------------------------------- brands

export const brands = pgTable("brands", {
  id: id(),
  ownerUserId: uuid("owner_user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  website: text("website"),
  createdAt: createdAt(),
});

export const products = pgTable("products", {
  id: id(),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  sizeType: text("size_type").notNull(),
  retailValueCents: integer("retail_value_cents").notNull(),
  // What one reward costs the brand, shipping included.
  unitCostCents: integer("unit_cost_cents").notNull(),
  createdAt: createdAt(),
});

export const campaignStatusEnum = pgEnum("campaign_status", [
  "active",
  "paused",
  "ended",
]);

export const campaigns = pgTable("campaigns", {
  id: id(),
  brandId: uuid("brand_id")
    .notNull()
    .references(() => brands.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),
  name: text("name").notNull(),
  tier: integer("tier").notNull(),
  // Empty array means "anyone".
  audienceSports: text("audience_sports").array().notNull().default([]),
  audienceRegions: text("audience_regions").array().notNull().default([]),
  startsOn: day("starts_on").notNull(),
  endsOn: day("ends_on").notNull(),
  budgetCapCents: integer("budget_cap_cents").notNull(),
  status: campaignStatusEnum("status").notNull().default("active"),
  createdAt: createdAt(),
});

export const campaignInventory = pgTable(
  "campaign_inventory",
  {
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    size: text("size").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.size] })],
);

// ------------------------------------------------- wishlist to redemption

export const wishlistItems = pgTable(
  "wishlist_items",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.campaignId] })],
);

export const challengeStatusEnum = pgEnum("challenge_status", [
  "active", // holds a reserved unit
  "in_review", // goal met, waiting for a person to check it; still holds the unit
  "achieved", // a redemption exists
  "failed",
  "withdrawn",
  "rejected", // review found the data not credible
]);

export const challenges = pgTable(
  "challenges",
  {
    id: id(),
    memberId: uuid("member_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    campaignId: uuid("campaign_id")
      .notNull()
      .references(() => campaigns.id, { onDelete: "cascade" }),
    size: text("size").notNull(),
    baselineId: uuid("baseline_id")
      .notNull()
      .references(() => baselines.id, { onDelete: "cascade" }),
    target: jsonb("target").$type<ChallengeTarget>().notNull(),
    startDate: day("start_date").notNull(),
    pauseStart: day("pause_start"),
    pauseEnd: day("pause_end"),
    status: challengeStatusEnum("status").notNull().default("active"),
    // The evaluation at the moment the outcome was decided.
    evidence: jsonb("evidence").$type<Evaluation>(),
    createdAt: createdAt(),
  },
  (t) => [
    // At most one open challenge per member.
    uniqueIndex("one_open_challenge_per_member")
      .on(t.memberId)
      .where(sql`${t.status} in ('active', 'in_review')`),
  ],
);

// Carries its own campaign and size so the brand's record of an issued code
// survives the member deleting their account.
export const redemptions = pgTable("redemptions", {
  id: id(),
  challengeId: uuid("challenge_id")
    .unique()
    .references(() => challenges.id, { onDelete: "set null" }),
  campaignId: uuid("campaign_id")
    .notNull()
    .references(() => campaigns.id, { onDelete: "cascade" }),
  size: text("size").notNull(),
  code: text("code").notNull().unique(),
  issuedAt: timestamp("issued_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  fulfilledAt: timestamp("fulfilled_at", { withTimezone: true }),
});

export const brandConsents = pgTable(
  "brand_consents",
  {
    memberId: uuid("member_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    brandId: uuid("brand_id")
      .notNull()
      .references(() => brands.id, { onDelete: "cascade" }),
    // Declared profile (sports, sizes, region) counted in this brand's
    // aggregate insights.
    shareProfile: boolean("share_profile").notNull().default(false),
    // Email and name visible to this brand.
    shareEmail: boolean("share_email").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.memberId, t.brandId] })],
);

export const auditLog = pgTable("audit_log", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  // No foreign key: the trail must outlive a deleted account.
  actorUserId: uuid("actor_user_id"),
  action: text("action").notNull(),
  detail: jsonb("detail").$type<Record<string, unknown>>(),
});
