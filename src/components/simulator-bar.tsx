import { skipAhead } from "@/app/member/actions";
import type { Day } from "@/engine/types";
import { isPersona, PERSONAS } from "@/sources/simulator";
import type { SourceConnection } from "@/sources/types";
import { btn, formatDay } from "./ui";

/** Demo-only controls for a simulated wearable. */
export function SimulatorBar({ conn, today }: { conn: SourceConnection; today: Day }) {
  const persona = conn.simulatorPersona ?? "";
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p>
        <span className="font-semibold">Simulated wearable.</span>{" "}
        {isPersona(persona) ? PERSONAS[persona].label : persona}. Today is{" "}
        {formatDay(today)}.
      </p>
      <form action={skipAhead} className="flex gap-2">
        <button name="days" value="1" className={btn("secondary")}>Skip 1 day</button>
        <button name="days" value="7" className={btn("secondary")}>Skip 7 days</button>
      </form>
    </div>
  );
}
