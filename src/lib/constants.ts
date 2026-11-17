export const SPORTS = [
  "running",
  "walking",
  "cycling",
  "strength",
  "swimming",
  "yoga",
  "team sports",
] as const;

export const REGIONS = ["US", "Canada", "UK", "EU", "Australia"] as const;

export const SIZE_TYPES = ["apparel", "shoe", "one_size"] as const;
export type SizeType = (typeof SIZE_TYPES)[number];

export const SIZES: Record<SizeType, readonly string[]> = {
  apparel: ["XS", "S", "M", "L", "XL", "XXL"],
  shoe: ["6", "7", "8", "9", "10", "11", "12", "13"],
  one_size: ["One size"],
};

// Aggregate brand insights never show a group smaller than this.
export const MIN_COHORT = 5;
