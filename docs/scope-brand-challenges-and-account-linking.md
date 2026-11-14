# Scope addendum: brand-designed challenges and customer account linking

Status: proposed. Nothing in this document is built. Researched 14 November 2026.

This extends the original plan with three requests:

1. Brands design their own challenges (for example a running challenge to promote a new shoe).
2. Brands link a member to their existing customer record, or get a new linked account created quickly, so they can measure revenue and engagement.
3. More challenge types: distance, minutes, activity, heart rate, consistency and others.

Two decisions in the original plan are reversed by this: "brands choose a tier; they do not write fitness goals", and "store integrations and customer-list matching are out of scope".

## Recommendations in brief

- **Brands design the shape of a challenge; the platform sets the amount for each member.** The brand picks the metric, the activity, the format, the length and the story. The number each member has to hit still comes from that member's own baseline, inside safety limits the brand cannot change. This keeps the premise ("personalized to them") and still gives brands a campaign they can call their own. A fixed target for everyone ("run 50 km in May") is offered as an option, not the default.
- **Heart-rate challenges use time in personal heart-rate zones, never a bpm number.** A fixed bpm is unfair and can be unsafe; zone minutes are already personalised by the device.
- **Link identities freely, with consent. Do not send wearable-derived facts into the brand's marketing tools.** Google's and Apple's rules cover derived data, not only raw data. Measurement works the other way round: the brand's order data flows in, and results go back as group totals.
- **Build the generic signed join link first, then a Shopify app.** The join link gives "create a linked account quickly" for any brand. The Shopify app adds one-click joining, automatic single-use codes and order data, and removes the current "codes are honoured by hand" limit.
- **A running-shoe campaign needs the watches runners wear.** Today only Fitbit and Pixel Watch connect. Garmin or Apple Watch support matters more to that brand than extra challenge types.

## 1. Brand-designed challenges

### What already exists elsewhere

- **Strava Sponsored Challenges** are the closest model. A brand sets a goal (distance, duration, elevation, streak), members join, and finishers click through to the brand's page to claim a discount or prize. Strava gives brands aggregate reporting only and does not pass on email addresses. Every finisher has to opt in to the reward on the brand's site. Goals are the same for everyone. Pricing starts at $30,000, so small brands are priced out. ([Strava for Business](https://business.strava.com/challenges), [asset guide](https://business.strava.com/resources/creating-assets-sponsored-challenge-2), [FAQ](https://business.strava.com/why-strava/faqs))
- **Paceline** rewards a fixed weekly goal (150 elevated-heart-rate minutes on at least three days) with points spent on partner brands, and excludes manual entries. It connects Apple Watch, Garmin and Fitbit, which shows this category of product can get wearable access. ([Paceline help](https://help.paceline.fit/support/solutions/articles/150000216422-streak-overview))

The gap this product can fill: goals personal to each member, free gear instead of discounts, and a price small brands can afford.

### Design: the brand picks the shape, the platform sets the amount

The builder is a set of templates with bounded parameters, not free-form rules.

The brand chooses:

- **Metric**: one of the types in the table below.
- **Activities that count**: for example running only, or running and walking.
- **Format**: a weekly goal met in N of M weeks (what exists today), a total over the whole period, or a number of sessions.
- **Length**, within limits.
- **Goal mode**: personal (default) or fixed.
- **Name, story, imagery** and the reward.

The platform keeps, and the brand cannot override:

- The amount in personal mode, computed from each member's baseline for that metric.
- The daily credit cap, free rest days, the injury pause and the late-sync grace period.
- A limit on how far above a member's baseline any target may sit.
- The effort-for-value rule. Each design is rated on length and load relative to baseline, and the builder shows the highest reward value that design can carry. The three tiers remain as value bands.
- Device-recorded data only, and human review before high-value rewards.
- No weight, body-shape or health-outcome goals. Adults only.

While volume is low, every brand-designed challenge is approved by a person before it goes live, to catch health claims and unsafe framing.

**Fixed mode.** Brands will ask for "50 km in May" because it is easy to market. It is allowed inside the same safety limit: a member whose baseline makes the target an unsafe jump is shown the personal version instead, if the brand enabled one, or is not shown the challenge. The builder shows what share of the audience can attempt it.

### Challenge types

Field names are from the Google Health API v4 `exercise` data type, which the app already reads. Today it keeps only duration and average heart rate and discards the rest.

| Type | Example | Measured from | Main cheating risk and check | Recommendation |
| --- | --- | --- | --- | --- |
| Minutes | 150 active minutes a week | `activeDuration` | Typed-in entries; already excluded | Built |
| Consistency | Active on 4 days a week; 12 sessions this month | Session count and days | Many tiny sessions; minimum session length | Partly built, extend |
| Distance | Run 25 km a week | `metricsSummary.distanceMillimeters` | A drive or bike ride logged as a run; require `hasGps` or steps, and a plausible pace for the activity | Build first |
| Activity-specific | Three swims a week | `exerciseType` (182 values) | The type is a label the member can change; cross-check pace and heart rate | Build first, as a filter on other types |
| Intensity ("bpm") | 90 zone minutes a week | `metricsSummary.activeZoneMinutes`, `heartRateZoneDurations` | Needs a heart-rate device; hard to fake | Build second |
| Elevation | Climb 2,000 m this month | `metricsSummary.elevationGainMillimeters` | Barometer noise; cap per session | Later |
| Variety | Try three different activities | `exerciseType` | Mislabelled sessions | Later |
| Comeback | Three active weeks after a month off | Baseline gap, then minutes | Deliberate lapse; needs imported history | Later. Fits the brand's reactivation goal |
| Single effort | First 10 km run | One session's distance | Highest fraud risk per reward; needs GPS | Later, low values only |
| Health outcome | Lower resting heart rate, higher VO2 max, weight | Other data types and scopes | Not a behaviour; noisy; medical | Do not build |
| Ranked or drawn prizes | Top 10 win; prize draw | Leaderboard | Contest and sweepstakes law; contradicts "everyone can earn" | Do not build now |

**Why zone minutes and not bpm.** Heart rate at a given effort varies with age, fitness and medication, so "20 minutes above 150 bpm" is trivial for one person and dangerous for another. Fitbit and Pixel devices already compute personal zones from age and resting heart rate, and award one zone minute per minute of moderate effort and two per minute of vigorous effort. ([Google Health help](https://support.google.com/googlehealth/answer/14236509?hl=en)) Other devices have equivalents (Garmin intensity minutes, Apple exercise minutes) that would map to the same challenge type.

### The running-shoe example

- **The app cannot verify which shoe was worn.** Google's data has no gear field. The honest versions of this campaign are: the shoe is the reward for a running challenge; or members who earned the shoe are offered a follow-on challenge.
- **Device coverage is the real limit.** Committed runners mostly record on Garmin or Apple Watch. Garmin requires a business application, and reportedly now charges new partners a $1,000 entry fee plus a negotiated fee per active user (reported by DC Rainmaker, [summarised here](https://sahha.ai/blog/garmin-connect-api-reopened-fees/); Garmin publishes no prices). Apple Watch needs a native iOS app. Strava's API terms rule it out as a source.

### What changes in the code

- **Activity storage**: store one record per exercise session (type, duration, distance, zone minutes, elevation, GPS flag, heart rate, device-recorded or not) instead of one row of minutes per day. Daily totals become derived.
- **Engine** (`src/engine`): `ChallengeTarget` becomes a description of metric, activities, format, amount and goal mode. Baselines are computed per metric. Evaluation stays a pure function with tests. A rating function replaces picking a tier directly.
- **Simulator**: personas produce sessions with distance and zones, plus new cheats (a drive logged as a run, a ride labelled as a run).
- **Brand builder**: template form with a live preview ("for a beginner this means 8 km a week; for a regular, 30 km") and the reach and maximum reward value.
- **Member pages**: progress in the challenge's own unit.
- **Existing campaigns** map onto the minutes-plus-consistency template unchanged.
- **Google scopes**: distance and zone fields sit inside the exercise record under the scope already requested. Whether Google fills the heart-rate fields without the separate heart-rate scope is unverified and has to be checked on the first live connection.

## 2. Linking to the brand's customer records

### The rules that shape it

- **Google Health API policy** (effective 24 March 2026). The limits apply to raw data and to data "aggregated, anonymized, de-identified, or derived from the raw data". Transfer to a third party is allowed only "to provide or improve your appropriate use case or features that are clear from the requesting application's user interface and only with the user's consent". Prohibited outright: transfer "to third parties like advertising platforms, data brokers, or any information resellers even if aggregated or anonymized", and any use "for serving ads, including contextual, personalized or interest-based advertising". ([policy](https://developers.google.com/health/policies/health-api-developer-user-data-policy))
- **Apple guideline 5.1.3(i)** bars using or disclosing health and fitness data to third parties "for advertising, marketing, or other use-based data mining purposes". This applies once Apple Watch is supported.
- **Washington's My Health My Data Act** requires consent to share that is separate from consent to collect, and a signed authorization for any "sale", which includes exchange for valuable consideration. A brand paying for rewards and receiving health-derived data in return could be read as a sale. The FTC's Health Breach Notification Rule treats a disclosure the user did not authorize as a breach. ([RCW 19.373](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373))

"This member completed a running challenge" is derived from wearable data. Sent into a brand's email or ad platform to target that person, it is the pattern these rules are aimed at. This is my reading, not legal advice, and it needs counsel before any brand integration ships.

### What may cross to the brand

| Data | Comes from the wearable? | To the brand |
| --- | --- | --- |
| The link itself: member and customer id | No | Yes, with per-brand consent |
| That the member joined the brand's challenge | No, it is a choice | Yes, with consent |
| Declared profile: sports, sizes, wishlist | No | With consent (group totals only today) |
| That a reward was earned | Yes, derived | Only what delivering the reward needs: the member presents a code. Not pushed into marketing tools |
| Progress, minutes, distance, heart rate, baseline, pauses, misses | Yes | Never |
| Orders and revenue | No, the brand's own data | Flows in; reported back as group totals |

### Options for linking

| Option | How it works | Brand effort | Proves the member owns the customer account? | Recommendation |
| --- | --- | --- | --- | --- |
| A. Redemption | The single-use code is used at checkout, so the brand sees which customer earned it | None | Yes | Exists. Links achievers only, after the fact |
| B. Signed join link | The brand emails or embeds a link carrying a short-lived token it signed (customer id, email). The member lands on a pre-filled sign-up, sees the link consent, and is linked | Low: sign a token, or paste a snippet | Yes, if the token is single-use and the email is confirmed | Build first. Works with any stack |
| C. Shopify app | A "Get sponsored" block inside the brand's customer account page. Shopify's session token identifies the signed-in customer. The app also creates single-use codes and receives order webhooks | Install an app | Yes | Build second. Needs Shopify app review and approval for protected customer data |
| D. Sign in with the brand | OpenID Connect against the brand's own login | High, per brand | Yes | Later, for larger brands |
| E. Customer list match | The brand uploads hashed emails; matches flag "existing customer" | Low | No | Only for members who already opted in to that brand. Never link silently on an email match |
| F. Loyalty or marketing connector | Post "completed" events to Yotpo, Smile or Klaviyo | Low | n/a | Not without legal sign-off. A member-initiated "claim your points" link is the safer form |

Notes:

- **Shopify.** Customer account UI extensions give the app a signed token whose `sub` claim is the customer id once the app is approved for protected customer data. ([session token API](https://shopify.dev/docs/api/customer-account-ui-extensions/latest/target-apis/platform-apis/session-token-api)) Reading names and emails needs level 2 approval, which brings security requirements (encrypted backups, access logs, an incident-response policy). ([protected customer data](https://shopify.dev/docs/apps/launch/protected-customer-data)) Codes are created with `discountCodeBasicCreate`; the `orders/create` webhook lists the codes used.
- **Linking safely.** Link on the provider's stable id, not on a matching email, and require the member to be signed in when the link is made. ([OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html))

### Measuring revenue and engagement

- **Inbound orders.** Order events arrive by Shopify webhook, a generic signed webhook or file upload, keyed by the linked customer id. The brand dashboard gains an impact section per campaign: repeat-purchase rate, revenue per linked member, time to second order, new versus existing customers, and cost per verified achiever. Groups under five stay withheld.
- **Brand-side analysis.** With consent, the brand may tag the customer as "joined Everyday Athlete" in its own system and run its own cohorts. The tag says joined, not earned.
- **Cause versus correlation.** People who join fitness challenges already differ from those who do not, so a raw comparison flatters the campaign. A random holdout (some invited customers are not shown the campaign) gives a real lift figure. It needs volume, and its mechanics should be designed with the first brand. Small campaigns get descriptive numbers, labelled as such.
- **Per-member view.** For a linked member a brand sees: linked on, challenges joined, rewards redeemed. Not progress, pauses or misses.

### Consent and trust

- A per-brand link screen, separate from the wearable consent, listing exactly what that brand receives.
- Unlink at any time: the mapping is deleted, order intake for that customer stops, and the brand is told to remove its tag.
- The "what brands see" copy is updated to match.
- Brand terms: no use for ad audiences, deletion on unlink.
- A dedicated health-data privacy policy and Google's required Limited Use statement.

### What changes in the code

- **Schema**: brand links (member, brand, external customer id, method, consent version), brand integrations (type, encrypted credentials), order events, holdout assignments.
- **Join link**: per-brand signing secret, token verification, pre-filled sign-up, link consent.
- **Inbound webhooks** with signature checks. These and challenge evaluation need a background worker, which also closes the current "challenges only update when the member opens the app" limit.
- **Shopify app**: a separate Shopify CLI project for the extension, with this app as its backend.
- **Brand dashboard**: impact section, integration settings, linked-member list.

## 3. Risks and open questions

- **Platform policy.** Google has to accept brand-funded rewards as a permitted use during OAuth verification. Paceline is precedent, not a guarantee.
- **Legal review** of the link consent, the brand terms and whether brand funding plus reporting could count as a sale of health data.
- **Challenge quality.** Brand-written challenges can be unsafe or misleading. Approval by a person does not scale; it needs clear rules before volume grows.
- **Fraud per type.** Distance and single-effort challenges are easier to fake than sustained minutes. Reward values for them should start low.
- **Device coverage.** See the running-shoe example.

## 4. Suggested build order

Each step is usable on its own.

1. **Session-level activity and the generalised engine**, with distance, consistency and activity filters in personal mode. Touches storage, the engine, the simulator, the Google mapping, the brand builder and member progress pages. The largest change, and everything else in section 1 depends on it.
2. **Signed join link and per-brand link consent.** New tables, one endpoint and one consent screen. Independent of step 1.
3. **Intensity challenges and fixed mode** with the reach preview. Small once step 1 exists.
4. **Background worker**: scheduled evaluation and webhook intake. Required by step 5.
5. **Shopify app**: one-click join, automatic codes, order intake, impact dashboard. Gated on Shopify's review.
6. **Second wearable source**: Garmin, or a native iOS app for Apple Watch. Gated on Garmin's approval or on building a native app.

Before any real brand goes live: legal review, and Google OAuth verification.

## 5. Decisions needed

1. **Personal or fixed goals as the default** for brand-designed challenges. I recommend personal.
2. **Which commerce platform the first brands use.** If it is not Shopify, step 5 changes.
3. **Whether brands may receive per-member "earned" events in their own marketing tools.** I recommend no until counsel has reviewed it.
4. **More challenge types or more devices first.** For a running-shoe brand I would put Garmin or Apple Watch ahead of steps 3 and 5.
5. **Who provides legal review.**
