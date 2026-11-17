import { describe, expect, it } from "vitest";
import { isEligible, suppressSmall, unitsLeft } from "./offers";

describe("isEligible", () => {
  const profile = { sports: ["running"], region: "US" };

  it("accepts everyone when the campaign names no audience", () => {
    expect(isEligible({ audienceSports: [], audienceRegions: [] }, profile)).toBe(true);
    expect(
      isEligible({ audienceSports: [], audienceRegions: [] }, { sports: [], region: null }),
    ).toBe(true);
  });

  it("needs one shared sport and a matching region", () => {
    const campaign = { audienceSports: ["cycling", "running"], audienceRegions: ["US"] };
    expect(isEligible(campaign, profile)).toBe(true);
    expect(isEligible(campaign, { sports: ["yoga"], region: "US" })).toBe(false);
    expect(isEligible(campaign, { sports: ["running"], region: "UK" })).toBe(false);
    expect(isEligible(campaign, { sports: ["running"], region: null })).toBe(false);
  });
});

describe("unitsLeft", () => {
  const base = { quantity: 10, usedForSize: 0, usedTotal: 0, unitCostCents: 20_00, budgetCapCents: 1000_00 };

  it("is limited by the size's own quantity", () => {
    expect(unitsLeft({ ...base, usedForSize: 7, usedTotal: 7 })).toBe(3);
  });

  it("is limited by the budget across all sizes", () => {
    // The budget pays for 5 rewards and other sizes have used 4 of them.
    expect(unitsLeft({ ...base, budgetCapCents: 100_00, usedTotal: 4 })).toBe(1);
    expect(unitsLeft({ ...base, budgetCapCents: 100_00, usedTotal: 5 })).toBe(0);
  });

  it("does not round a partly affordable reward up", () => {
    expect(unitsLeft({ ...base, budgetCapCents: 39_99 })).toBe(1);
  });

  it("never goes negative", () => {
    expect(unitsLeft({ ...base, usedForSize: 12, usedTotal: 12 })).toBe(0);
  });
});

describe("suppressSmall", () => {
  it("hides counts from 1 to 4 and shows the rest", () => {
    expect([0, 1, 4, 5, 60].map(suppressSmall)).toEqual([0, null, null, 5, 60]);
  });
});
