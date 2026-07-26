import { stateTone } from "../_lib/format";

export function StatusBadge({
  state,
  tone,
}: {
  state: string;
  tone?: "good" | "warning" | "bad" | "active" | "muted";
}) {
  return <span className={`statusBadge ${tone ?? stateTone(state)}`}>{state.replaceAll("_", " ")}</span>;
}
