# Everyday Athlete

Brands sponsor everyday people the way they sponsor athletes. A member connects
a wearable, the app sets a goal based on that person's own recent activity, and
reaching it earns gear from a brand that chose to fund it.

Brands fund rewards and see consented, aggregate results. They never see a
member's workouts, heart rate or baseline.

## What is here

- **Members** connect a wearable, build a wishlist, commit to one challenge at a
  time (which reserves a unit in their size), track weekly progress, and get a
  redemption code when they earn it.
- **Brands** list products, launch campaigns with a tier, a unit count per size
  and a hard budget cap, mark codes as fulfilled, and see an aggregate
  dashboard.
- **Reviewers** (emails in `ADMIN_EMAILS`) approve or reject tier 3 rewards at
  `/admin/reviews` before a code is issued.

| Tier | Length | Weeks to hit | Target vs. own baseline | Heart rate needed | Reward value |
| --- | --- | --- | --- | --- | --- |
| 1 Starter | 2 weeks | 2 | same, 60 to 150 min/week | no | up to $40 |
| 2 Builder | 6 weeks | 5 | +15%, 90 to 240 min/week | yes | up to $120 |
| 3 Elite | 12 weeks | 10 | +30%, 150 to 300 min/week | yes, plus human review | any |

Only device-recorded minutes count, capped at 90 a day. Hand-typed entries are
stored but never credited. The rules live in `src/engine` as pure functions.

## Run it locally

Needs Node 22 and Postgres 16.

```bash
cp .env.example .env.local   # then edit DATABASE_URL if needed
npm install
set -a && . ./.env.local && set +a && npm run db:migrate
npm run dev
```

Open http://localhost:3000, sign up once as a brand and once as a member (use a
second browser profile). With `ENABLE_SIMULATOR=true` the member can connect a
simulated wearable and skip ahead in time to watch a challenge finish.

```bash
npm run typecheck
npm run lint
npm test          # database tests are skipped unless DATABASE_URL is set
```

## Configuration

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `TOKEN_ENCRYPTION_KEY` | Any long random string. Encrypts wearable tokens at rest. Changing it disconnects every Google Health member. |
| `ENABLE_SIMULATOR` | `true` shows the simulated wearable. Must be `false` once real rewards are funded: simulated data can earn real codes. |
| `ADMIN_EMAILS` | Comma-separated member emails allowed to review tier 3 rewards |
| `APP_URL` | Public base URL, used for the Google OAuth redirect |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Enable the Fitbit and Pixel Watch connection. Leave empty to hide it. |

## Wearable sources

Every source implements `ActivitySource` in `src/sources/types.ts` and is
registered in `src/sources/index.ts`.

- **Simulator** (`simulator.ts`): seeded, repeatable personas for demos and tests.
- **Google Health** (`google-health.ts`): Fitbit trackers and Pixel Watch through
  the Google Health API v4, which replaced the Fitbit Web API.

### Setting up Google Health

1. In Google Cloud, create a project, enable the Google Health API, and
   configure the OAuth consent screen with the scope
   `https://www.googleapis.com/auth/googlehealth.activity_and_fitness.readonly`.
2. Create an OAuth client of type "Web application" with the redirect URI
   `<APP_URL>/api/sources/google/callback`.
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `APP_URL`.

Things to know before relying on it:

- **It has not been run against a live Google account.** It is written from the
  published reference and tested against a stand-in for Google's endpoints. The
  first real connection should be checked by hand, in particular that tracker
  sessions arrive under the `google-wearables` source family and hand-logged
  ones do not.
- While the OAuth app is in "Testing" status, Google expires refresh tokens
  after 7 days and members must reconnect.
- An unverified app is limited to 100 users. Beyond that Google requires OAuth
  verification and a yearly security assessment for this restricted scope, and
  its user-data policy has to accept activity being used to grant rewards.
- It reads logged and auto-detected exercise sessions. Movement that the device
  never recorded as an exercise does not count.
- Apple Watch needs a native iOS app (HealthKit has no web API), and Garmin
  needs approval for its partner programme. Neither is built.

## Deploy on Render

`render.yaml` defines a web service and a Postgres database. Migrations run at
start. Set `ADMIN_EMAILS`, `APP_URL` and the Google values in the dashboard.

The Blueprint uses free plans, which suit a demo only: the free database is
deleted after 30 days and the web service sleeps when idle. It also ships with
`ENABLE_SIMULATOR=true`.

## What is proposed next

Brand-designed challenges, more challenge types and linking members to a brand's
customer records are scoped, not built, in
[`docs/scope-brand-challenges-and-account-linking.md`](docs/scope-brand-challenges-and-account-linking.md).

## Known limits

- Challenges are evaluated when the member opens the app. There is no scheduled
  job yet, so a finished challenge waits for the next visit.
- Redemption codes are generated here. The brand has to honour them in its own
  store by hand; there is no store integration or pre-loaded code pool.
- Tier 1 does not require heart rate, so a device shaken by hand could earn a
  low-value item. The 90 bpm threshold for tiers 2 and 3 is a placeholder.
- A rejected tier 3 review has no appeal path.
- Days are UTC and money is USD.
- Sign-in has no rate limiting or password reset.
- The consent wording and the health-data handling have not had legal review.
