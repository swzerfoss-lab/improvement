# Legal first pass

Written 15 November 2026 by the AI agent working on this repository, at the owner's request.

**What this is.** An issue-spotting pass over the product as built and as scoped in [`scope-brand-challenges-and-account-linking.md`](scope-brand-challenges-and-account-linking.md). It is based on the platform terms and statutes linked below, read on the date above, and on the code in this repository.

**What this is not.** It is not legal advice and I am not a licensed attorney. Where a term is ambiguous I say so and give my reading; a platform reviewer, regulator or court may read it differently. Section 5 lists what has to go to a licensed attorney before launch. I assumed a United States launch with adult members only.

Ratings: **Blocker** (cannot ship as designed), **High** (likely enforcement, rejection or liability if unaddressed), **Medium**, **Low**.

## 1. Summary

| # | Issue | Rating | What to do |
| --- | --- | --- | --- |
| 1 | Sending per-member "earned" events to a brand's marketing tools | Blocker for Apple data as marketing, with a narrow form open to argument; High for Google; approval needed for Garmin | Route the "earned" signal through redemption; send other events directly; gate direct "earned" events per device source (section 2) |
| 2 | Apple's rule that the benefit provider must be the app's publisher | High | Contract so the platform grants the reward and the brand supplies and ships it (section 3) |
| 3 | Google's verification of the core use case | High | Describe brand-funded rewards and every data flow in the verification submission; do not rely on silence |
| 4 | State health-data laws (Washington, Nevada, others) | High | Separate consent to share, a signed authorization where data is exchanged for value, a health-data privacy policy (section 4) |
| 5 | FTC: privacy promises must match practice | High | Treat the "what brands see" screen as a binding promise; re-consent existing members before any change |
| 6 | No terms of service or privacy policy exist | Blocker | Write both before any real member signs up |
| 7 | A person reads member data during tier 3 review | Medium | Collect explicit consent at commit (section 4) |
| 8 | Brand contracts | High | Use limits, platform terms passed down, duty to honour codes, deletion on unlink |
| 9 | Tax reporting on rewards | Medium | Track yearly reward value per member; decide who the payer is (section 4) |
| 10 | Injury liability | Medium | Assumption-of-risk terms; keep the safety limits; no health-outcome goals |
| 11 | Promotion and prize law | Low while every finisher earns | No draws, no ranked prizes; publish rules per challenge |
| 12 | "Free" claims | Low to Medium | Gear and shipping must really be free; state conditions up front |
| 13 | California and other general privacy laws | Medium | Price the service as a rewards programme, not as data; revisit at scale |
| 14 | Age | Low to Medium | Keep 18+; self-declared age is weak evidence |
| 15 | Brand emails to members | Low | The brand is the sender and carries the unsubscribe duties |
| 16 | Shopify and Garmin integration requirements | Low, operational | Meet them as part of each integration |

## 2. Brands receiving "earned" events (decision of 15 November)

The owner decided brands should receive per-member events in their own marketing tools. This section sets out what the device platforms and the law allow, and a design that delivers the signal within them.

### What the terms say

- **Apple.** HealthKit's rules: "You must not disclose any information gained through HealthKit to a third party without express permission from the user. Even with permission, you can only share information to a third party if they also provide a health or fitness service to the user", and the data may not be used "for advertising or similar services". ([Protecting user privacy](https://developer.apple.com/documentation/healthkit/protecting-user-privacy)) Guideline 5.1.3(i) bars disclosure to third parties "for advertising, marketing, or other use-based data mining purposes". ([App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/#health-and-health-research)) An apparel brand's marketing platform is not a health or fitness service. On the text, consent does not cure this. **Rating: Blocker** for sending achievements verified from Apple Watch data into marketing tools. A narrower form is discussed below.
- **Google.** The limits cover data "derived from the raw data". Transfer needs the user's consent and must serve a feature "clear from the requesting application's user interface". Prohibited regardless of consent: transfer to "advertising platforms, data brokers, or any information resellers" and use "for serving ads, including contextual, personalized or interest-based advertising". ([policy](https://developers.google.com/health/policies/health-api-developer-user-data-policy)) Whether a brand's email tool counts is not stated. A brand that syncs the event into an ad audience plainly breaches it, and the breach would be attributed to this app. **Rating: High**; resolvable only by asking Google during verification.
- **Garmin.** Personal data under the agreement "includes information derived from these or other data", so an achievement is covered. Data is licensed "solely for internal business purposes" (4.1). Providing user data to third-party "platforms, services, or products that have not been approved by Garmin in writing" is barred (5.2(o)), and data may not be sold "without the End User's lawful consent" (15.5). ([agreement](https://developerportal.garmin.com/sites/default/files/Garmin%20Connect%20Developer%20Program%20Agreement.pdf)) **Rating: needs written approval.** Two further Garmin clauses affect the business itself, not only events: earning income from use of the API needs Garmin's "prior written permission" (5.2(e)), and the app may not show Garmin users advertising for products that compete with Garmin's (5.2(t)), which rules out sponsors that sell sports watches or bike computers.

### What the law says

- **Washington** treats data that identifies "past, present, or future physical or mental health status", including inferences, as consumer health data. Sharing needs consent "separate and distinct" from consent to collect. If data is exchanged "for monetary or other valuable consideration" it is a sale, which needs a signed authorization naming the data, the buyer and the purpose, expiring after one year, and stating that goods or services "may not be conditioned" on signing. Consumers can sue. ([RCW 19.373](https://app.leg.wa.gov/RCW/default.aspx?cite=19.373)) Nevada has a similar law without the private lawsuit.
- Washington allows sharing without that separate consent "to the extent necessary to provide a product or service that the consumer ... has requested". A member redeeming a code they asked for fits this. A marketing event does not.
- Whether "earned a running reward" identifies health status is arguable. I would assume it does.
- **Consequence:** a member must be able to earn rewards without agreeing to events being sent. Events can never be a condition of taking part.

### A design that delivers the signal

Sort events by where they come from, not by what the brand wants to do with them.

| Class | Events | Derived from wearable data? | How the brand gets it | Allowed for |
| --- | --- | --- | --- | --- |
| 1 | Linked, joined a challenge, wishlisted, unlinked | No. These are the member's choices | Sent directly to the brand's tools, with per-brand consent | All sources |
| 2 | Reward redeemed | The member discloses it by using the code | Arises in the brand's own store at checkout, where the order carries the code. The Shopify app can also tag the customer | All sources, with the Apple caveat below |
| 3 | Reward earned, sent at the moment of achievement | Yes | Sent directly, with a separate signed authorization per brand | Google only after Google confirms; Garmin only with written approval; Apple only in the narrow form below, and only if Apple agrees |

Because the reward is free gear, nearly every member who earns will redeem. Class 2 therefore gives the brand the "earned" signal for almost all achievers, inside its own systems, for every device. Class 3 adds only earlier timing and the few who never redeem. I recommend building classes 1 and 2 first and treating class 3 as a per-source switch that stays off until each platform has agreed.

Apple caveat for class 2: my reading is that the member, not the app, makes the disclosure by presenting the code, which is how any reward has to be delivered. A reviewer could disagree. To stay on the safe side of that line, the app should not write a customer tag for achievements verified from Apple Watch data; the brand already holds the order with the code on it.

For every class: no progress, minutes, distance, heart rate, baseline, pauses or misses. Brand terms must forbid loading any of these events into advertising platforms.

### Could the brand count as a fitness service? (owner's argument, 16 November)

The owner's argument: rewarding exercise with free gear is itself a health and fitness service, so sharing "earned" with the brand meets Apple's condition.

- **The test is about the recipient.** Apple asks whether the third party receiving the data "also provide[s] a health or fitness service to the user". That this app provides one does not answer it. A brand that only funds gear and receives a signal is hard to describe that way. A brand that designed the challenge the member chose to join is easier: it is running a fitness programme for that member. Brand-designed challenges make this the strongest form of the argument.
- **A second rule turns on purpose, not on who receives.** Guideline 5.1.3(i) bars disclosure "for advertising, marketing, or other use-based data mining purposes other than improving health management", and HealthKit data may not be used "for advertising or similar services". So a qualifying brand may use the event to run the programme: confirm the reward, congratulate, offer the next challenge. Adding the member to a promotional segment or an ad audience is marketing, whoever the brand is.
- **It pulls against section 3.** The reward itself is allowed only if the app's publisher provides the benefit and "the data is not shared with a third party". The more the brand is presented as the fitness service provider, the weaker the claim that the platform provides the benefit.
- **Apple decides, after the app is built.** The cost of being wrong is rejection or removal of the iOS app. Apple offers 30-minute App Review appointments to discuss the guidelines; this question should be put to Apple there before the native app is written.

Result: for Apple Watch data, class 3 changes from "never" to an open question in a narrow form. The event goes only to the brand whose challenge the member joined, only with the member's permission, and only for running that programme, not for promotional or advertising use. It stays off until Apple has been asked. The limit on use would be a contract term the platform cannot police, which is the weak point. Class 2 already gives the brand the signal for Apple Watch members who redeem.

## 3. Who provides the benefit (Apple)

Guideline 5.1.3(i) permits using fitness data "to provide a benefit directly to that user (such as a reduced insurance premium), provided that the app is submitted by the entity providing the benefit, and the data is not shared with a third party".

The whole product rests on this sentence once Apple Watch is supported. If the brand is seen as the benefit provider, the app's publisher is not, and the carve-out fails. My recommendation is to structure it so the platform is unambiguously the provider:

- The brand pays the platform; the platform grants the reward to the member.
- The brand supplies and ships the goods under a fulfilment agreement.
- In-app wording says the reward comes from Everyday Athlete, funded by the brand.

This is a judgement call an App Review reviewer will make, and it should be raised with an attorney and, if possible, with Apple before the native app is built. **Rating: High.**

## 4. Other findings

**Health-data privacy policy and consents (High).** Washington requires a separate consumer health data privacy policy linked from the homepage. Google requires an in-app disclosure, shown in normal use and not only in a policy page, and a public statement that use complies with its Limited Use requirements. The connect screen is a good start on the disclosure, though Google asks for "a separate dialog window" on websites and the screen says nothing yet about linking. The policies do not exist.

**Promises already made in the app (High).** The connect screen tells members that brands never see "whether you personally are part-way through, paused, or missed a goal", and learn that a reward was earned "once you redeem your code at their store". The FTC treats a disclosure that contradicts such a promise as deceptive. Under the Health Breach Notification Rule as amended in 2024, a breach "includes unauthorized disclosures", not only break-ins; I would assume the rule covers this app, since it holds identifiable health data drawn from members' devices. ([Federal Register](https://www.federalregister.gov/documents/2024/05/30/2024-10855/health-breach-notification-rule)) Classes 1 and 2 are consistent with the current wording once linking is disclosed. Class 3 is not: the wording must change first and existing members must agree again.

**A person reads member data in tier 3 review (Medium).** Google's policy says "do not allow humans to read user data" without "the user's explicit consent to read specific data", or for security purposes such as investigating abuse. `/admin/reviews` shows a reviewer a member's weekly minutes, active days and baseline, without the member's name. Fraud review may fit the security exception, and withholding the name helps, but the safer course is a consent checkbox at commit for tier 3 challenges. The offer page already states that a person checks the data; it does not yet ask for agreement.

**Athlete level from history (Medium, added 16 November).** The scope now has the app read up to six months of history and place each member in an athlete level. The level is derived from wearable data, so the same rules apply to it as to any other derived fact. Three points follow. The connect screen must say that six months is read and why. Showing brands the mix of levels as group totals is still a use of "aggregated" data under Google's policy, so it needs the member's consent and has to be part of the disclosed feature. A challenge open only to some levels reveals a linked member's rough level to the brand when they join, so the link consent must say so. Reading more history is also more data to protect; keeping weekly totals instead of every old session limits that.

**Brand contracts (High).** There are none. They need: permitted uses of each event class; a ban on ad-platform use; the device platforms' terms passed down; deletion when a member unlinks; a duty to honour every issued code and hold the stock, since the app promises free gear on the brand's behalf; and responsibility for product safety and recalls.

**Tax (Medium).** A reward is income to the member at fair market value. From 2026 the payer files Form 1099-MISC when prizes to one person total $2,000 or more in a year. ([IRS instructions](https://www.irs.gov/instructions/i1099mec)) If the platform is the grantor, as section 3 recommends, it is probably the payer and would need each such member's taxpayer number. The simplest control is a yearly cap per member below the threshold. Needs a tax adviser.

**Injury (Medium).** Rewarding exercise invites a claim when someone is hurt. The existing limits help: targets tied to the member's own baseline, a daily cap, free rest days, an injury pause. Terms should say this is not medical advice and that the member takes part at their own risk; how far such terms hold varies by state. Heart-rate challenges should use personal zones and health-outcome goals should stay out, as scoped.

**Promotions (Low while the design holds).** A reward that every finisher receives is not a lottery or sweepstakes, because nothing depends on chance. Reserving the unit at commit is what keeps it that way: no one finishes and then loses out. Prize draws and ranked prizes would bring state registration rules and should stay out of scope. Each brand-designed challenge needs published rules: who may join, dates, what earns the reward, limits.

**"Free" (Low to Medium).** The FTC's guide on "free" offers requires conditions to be stated clearly at the outset and the item to be truly free. Shipping charges or a required purchase would break this.

**General privacy laws (Medium).** California's law applies to a business of any size that earns half or more of its revenue from selling or sharing personal information. If brands are understood to be paying for linked member data, that test could be met early. Price and describe the service as a rewards programme with reporting.

**Brand emails (Low).** When a member opts in to hear from a brand and the brand emails them, the brand is the sender under federal email marketing law and must offer and honour an unsubscribe. The brand agreement should say so.

**Integration requirements (Low, operational).** Shopify requires approval and security controls (encrypted backups, access logs, an incident-response policy) before an app may read customer names and emails. Garmin's agreement has rules on displaying its name and logo, which I have not reviewed in detail; read them when access is granted.

**Age (Low to Medium).** Sign-up asks members to confirm they are adults. That is acceptable for a first launch and weak against a determined minor.

## 5. For a licensed attorney before launch

1. Terms of service, privacy policy and the separate health-data privacy policy.
2. The per-brand link consent and the signed authorization for class 3 events.
3. Whether the Apple benefit-provider structure in section 3 holds, the wording that supports it, and whether a brand that designs a challenge counts as providing a fitness service (section 2).
4. The brand agreement.
5. Whether brand funding makes any data flow a "sale" under Washington, Nevada or California law.
6. The injury waiver and its enforceability in the launch states.
7. Tax treatment of rewards and who files.
8. Breach-notification duties and an incident plan.

## 6. Not covered

Law outside the United States; employment, corporate and securities matters; trademark clearance for the name; accessibility; sales tax on goods given away, which falls on the brand.
