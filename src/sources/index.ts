import "server-only";
import { simulator } from "./simulator";
import type { ActivitySource } from "./types";

export const simulatorEnabled = () => process.env.ENABLE_SIMULATOR === "true";

export function getSource(provider: string): ActivitySource {
  if (provider === "simulator" && simulatorEnabled()) return simulator;
  throw new Error(`Activity source "${provider}" is not available`);
}
