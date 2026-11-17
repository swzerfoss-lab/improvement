CREATE TYPE "public"."campaign_status" AS ENUM('active', 'paused', 'ended');--> statement-breakpoint
CREATE TYPE "public"."challenge_status" AS ENUM('active', 'in_review', 'achieved', 'failed', 'withdrawn', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('member', 'brand');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"detail" jsonb
);
--> statement-breakpoint
CREATE TABLE "baselines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"computed_on" date NOT NULL,
	"weekly_minutes" integer NOT NULL,
	"active_days_per_week" real NOT NULL,
	"days_with_data" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "brand_consents" (
	"member_id" uuid NOT NULL,
	"brand_id" uuid NOT NULL,
	"share_profile" boolean DEFAULT false NOT NULL,
	"share_email" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brand_consents_member_id_brand_id_pk" PRIMARY KEY("member_id","brand_id")
);
--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"website" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_owner_user_id_unique" UNIQUE("owner_user_id")
);
--> statement-breakpoint
CREATE TABLE "campaign_inventory" (
	"campaign_id" uuid NOT NULL,
	"size" text NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "campaign_inventory_campaign_id_size_pk" PRIMARY KEY("campaign_id","size")
);
--> statement-breakpoint
CREATE TABLE "campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"name" text NOT NULL,
	"tier" integer NOT NULL,
	"audience_sports" text[] DEFAULT '{}' NOT NULL,
	"audience_regions" text[] DEFAULT '{}' NOT NULL,
	"starts_on" date NOT NULL,
	"ends_on" date NOT NULL,
	"budget_cap_cents" integer NOT NULL,
	"status" "campaign_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"size" text NOT NULL,
	"baseline_id" uuid NOT NULL,
	"target" jsonb NOT NULL,
	"start_date" date NOT NULL,
	"pause_start" date,
	"pause_end" date,
	"status" "challenge_status" DEFAULT 'active' NOT NULL,
	"evidence" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "daily_activity" (
	"member_id" uuid NOT NULL,
	"date" date NOT NULL,
	"active_minutes" integer NOT NULL,
	"manual_minutes" integer DEFAULT 0 NOT NULL,
	"avg_heart_rate" integer,
	CONSTRAINT "daily_activity_member_id_date_pk" PRIMARY KEY("member_id","date")
);
--> statement-breakpoint
CREATE TABLE "member_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"adult_confirmed_at" timestamp with time zone NOT NULL,
	"region" text,
	"sports" text[] DEFAULT '{}' NOT NULL,
	"apparel_size" text,
	"shoe_size" text
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"size_type" text NOT NULL,
	"retail_value_cents" integer NOT NULL,
	"unit_cost_cents" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "redemptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"challenge_id" uuid,
	"campaign_id" uuid NOT NULL,
	"size" text NOT NULL,
	"code" text NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fulfilled_at" timestamp with time zone,
	CONSTRAINT "redemptions_challenge_id_unique" UNIQUE("challenge_id"),
	CONSTRAINT "redemptions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "source_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"member_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"external_user_id" text,
	"simulator_persona" text,
	"clock_offset_days" integer DEFAULT 0 NOT NULL,
	"access_token_enc" text,
	"refresh_token_enc" text,
	"token_expires_at" timestamp with time zone,
	"connected_on" date NOT NULL,
	"synced_through" date,
	"last_synced_at" timestamp with time zone,
	CONSTRAINT "source_connections_member_id_unique" UNIQUE("member_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"member_id" uuid NOT NULL,
	"campaign_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_items_member_id_campaign_id_pk" PRIMARY KEY("member_id","campaign_id")
);
--> statement-breakpoint
ALTER TABLE "baselines" ADD CONSTRAINT "baselines_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_consents" ADD CONSTRAINT "brand_consents_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brand_consents" ADD CONSTRAINT "brand_consents_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "brands" ADD CONSTRAINT "brands_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaign_inventory" ADD CONSTRAINT "campaign_inventory_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "challenges" ADD CONSTRAINT "challenges_baseline_id_baselines_id_fk" FOREIGN KEY ("baseline_id") REFERENCES "public"."baselines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "daily_activity" ADD CONSTRAINT "daily_activity_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_profiles" ADD CONSTRAINT "member_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_challenge_id_challenges_id_fk" FOREIGN KEY ("challenge_id") REFERENCES "public"."challenges"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "redemptions" ADD CONSTRAINT "redemptions_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_connections" ADD CONSTRAINT "source_connections_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_member_id_users_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_campaign_id_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "one_open_challenge_per_member" ON "challenges" USING btree ("member_id") WHERE "challenges"."status" in ('active', 'in_review');--> statement-breakpoint
CREATE UNIQUE INDEX "one_member_per_external_account" ON "source_connections" USING btree ("provider","external_user_id");